import type { User, GameState, CardInstance, PlayerGameState, GamePhase } from '../types';
import { CARD_DEFS, ANCIENTS } from '../game/constants';
import {
  createInitialGameState, getPlayerState, getOpponentState,
  advancePhase, playCard, declareAttacker, declareBlocker,
  sacrificeLandscape, useAncient, selectAncient,
  resolveEntireStack, sacrificeAncient, addToRitualZone, removeFromRitualZone,
  addSpellToRitualZone, resolveRitualTarget, getPartialRitualMatches,
  isCardValidForRitualZone,
  cultivate, study, evolve, nourish, lastBreath, sacAncientAndLandscapes,
  chooseCombatDamageMode,
  beginPriorityWindow, recordPriorityPass, resetPriority
} from '../game/engine';
import { WillowAI } from '../game/ai';
const BOT_SP_REWARD = 10;
const BOT_WIN_LIMIT = 3;

// ── Timing ───────────────────────────────────────────────────────────────────
/** How long the player gets to act while holding priority. */
const PLAYER_PRIORITY_MS = 30000;
/** How long the player gets to declare blockers. */
const PLAYER_BLOCK_MS = 30000;
/** How long the bot "thinks" before responding to or passing on a priority window. */
const BOT_RESPONSE_MS = 1200;
/** How long the bot holds priority before auto-passing it back on an empty stack. */
const BOT_AUTO_PASS_MS = 1500;
/** Auto-advance delay for the mechanical replenish / draw steps. */
const EARLY_PHASE_AUTO_MS = 1000;
/** Watchdog interval for the "bot is stuck holding priority" safety net. */
const SANITY_CHECK_MS = 3000;

/** What ended a wait for the player during a priority window. */
type PlayerWaitOutcome = 'passed' | 'acted' | 'timeout';
/** Which kind of wait is in progress — drives the label on the countdown. */
type PlayerWaitKind = 'stack' | 'predamage' | 'blocks';

/**
 * Append a UI-side line to the game log. Mirrors the engine's own private `addLog`
 * cap so the log cannot grow without bound.
 */
function addScreenLog(gs: GameState, msg: string): GameState {
  return { ...gs, log: [...(gs.log || []).slice(-49), msg] };
}

const BOT_UID = 'bot_opponent';
const BOT_USER: User = {
  uid: BOT_UID,
  username: 'ScapeBot',
  rank: 100,
  wins: 0,
  losses: 0,
  online: true,
  lastSeen: Date.now(),
  friends: [],
  avatarColor: '#ff2d55'
};

type NavCallback = (screen: string, data?: Record<string, unknown>) => void;

export class BotGameScreen {
  private container: HTMLElement;
  private currentUser: User;
  private readonly onNav: NavCallback;
  private gameState: GameState;
  private selectedCard: string | null = null;
  private botRunning = false;
  private blockDragPos: { x: number; y: number } | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

  // SP award tracking (bot wins)
  private spAwarded = false;

  // ── Priority state ────────────────────────────────────────────────────────
  // Exactly one wait for the player can be outstanding at a time. `playerWait`
  // holds its resolver; `settlePlayerWait` is the only way it completes, so a pass,
  // a response and a timeout can never all fire against the same window.
  private playerWait: {
    kind: PlayerWaitKind;
    resolve: (o: PlayerWaitOutcome) => void;
    /** Absolute deadline while the clock is running. */
    deadlineMs: number;
    /** Time banked by a pause; null while the clock is running. */
    frozenMs: number | null;
  } | null = null;
  private playerWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private waitingOnPlayer = false;  // bot is waiting for player to pass priority
  // Guard so only one stack-priority loop drives the stack at a time.
  private stackLoopRunning = false;
  // Set by destroy(); halts every loop so an abandoned screen stops acting.
  private destroyed = false;

  // Player inactivity auto-pass timer
  private playerInactivityTimerId: ReturnType<typeof setTimeout> | null = null;
  private botAutoPassScheduled = false;

  // Every setTimeout this screen schedules is registered here so `destroy()` can
  // cancel all of them. Previously several were fire-and-forget and kept firing
  // against a screen the player had already left.
  private pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  // Bot priority sanity-check watchdog: periodically ensures the bot isn't stuck
  private botSanityTimerId: ReturnType<typeof setInterval> | null = null;

  // UI state
  private gamePhase: 'ancient-selection' | 'playing' = 'ancient-selection';
  private showGraveyard: 'mine' | 'opp' | null = null;
  private showNewAncient = false;
  private showRitualModal = false;
  private showSettings = false;
  private dragCardId: string | null = null;
  private handOrder: string[] = [];
  private phaseBreakpoint: GamePhase | null = null;
  private showBreakpointPicker = false;
  private breakpointHitPhase: string | null = null;
  private gamePaused = false;

  // Ritual popup dismiss timer
  private ritualPopupTimerId: ReturnType<typeof setTimeout> | null = null;

  // Priority countdown timer. `priorityTimerOwner` is what the clock is waiting on,
  // so the player can see whose clock is running instead of an unlabelled number.
  private priorityTimerEndMs: number | null = null;
  private priorityTimerOwner: 'you' | 'bot' | 'blocks' | null = null;
  private priorityCountdownInterval: ReturnType<typeof setInterval> | null = null;

  // Turn popup state
  private turnPopupVisible = false;
  private turnPopupIsMyTurn = false;
  private turnPopupTimerId: ReturnType<typeof setTimeout> | null = null;

  // Spacebar listener
  private spacebarHandler: ((e: KeyboardEvent) => void) | null = null;

  // Willow AI
  private willow: WillowAI;

  constructor(currentUser: User, onNav: NavCallback) {
    this.currentUser = currentUser;
    this.onNav = onNav;
    this.container = document.createElement('div');
    this.container.className = 'game-screen';

    this.gameState = createInitialGameState('local_bot_game', currentUser.uid, BOT_UID);
    // Initialize hand order
    this.handOrder = getPlayerState(this.gameState, currentUser.uid).hand.map(c => c.id);

    // Initialize Willow AI
    this.willow = new WillowAI();
    this.willow.startGame(BOT_UID, currentUser.uid);
    this.prevPlayerHand = new Set(getPlayerState(this.gameState, currentUser.uid).hand.map(c => c.id));

    // Track mouse position for block drag-line
    this.mouseMoveHandler = (e: MouseEvent) => {
      this.blockDragPos = { x: e.clientX, y: e.clientY };
      this.updateBlockLinesSVG();
    };
    document.addEventListener('mousemove', this.mouseMoveHandler);

    // Spacebar passes priority (or dismisses turn popup)
    this.spacebarHandler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      if (this.turnPopupVisible) {
        this.dismissTurnPopup();
        return;
      }
      // A paused game and an open modal both mean the player is not looking at the
      // board; passing priority from under them was how the target picker ended up
      // confirming into a state that had already moved on.
      if (this.isHalted()) return;
      if (this.hasOpenModal()) return;
      if (!this.botRunning || this.waitingOnPlayer) {
        this.handlePassPriority();
      }
    };
    document.addEventListener('keydown', this.spacebarHandler);

    // Bot priority sanity-check watchdog: periodically verify that if the bot holds
    // priority something is actually driving it. If not, kick-start the right flow.
    this.botSanityTimerId = setInterval(() => this.botPrioritySanityCheck(), SANITY_CHECK_MS);

    this.render();
  }

  getElement(): HTMLElement {
    return this.container;
  }

  private setState(newState: GameState): void {
    const myUid = this.currentUser.uid;
    const oldHand = getPlayerState(this.gameState, myUid).hand.map(c => c.id);
    const newHand = getPlayerState(newState, myUid).hand.map(c => c.id);

    // Add new cards to handOrder
    for (const id of newHand) {
      if (!this.handOrder.includes(id)) this.handOrder.push(id);
    }
    // Remove played cards
    this.handOrder = this.handOrder.filter(id => newHand.includes(id));

    // Keep old order for preserved cards
    const preserved = this.handOrder.filter(id => oldHand.includes(id) && newHand.includes(id));
    const newCards = this.handOrder.filter(id => !preserved.includes(id));
    this.handOrder = [...preserved, ...newCards];

    // Clear player inactivity timer on every state change (action resets it)
    this.clearPlayerInactivityTimer();

    // If a priority window was open for the player and their action handed priority
    // away (they responded on the stack, or used their ancient), the window is over:
    // report it as 'acted' so the driving loop gives the *bot* its response window
    // rather than resolving immediately.
    const playerReleasedPriority = this.waitingOnPlayer
      && this.gameState.priorityPlayer === myUid
      && newState.priorityPlayer !== myUid;

    // Detect turn change — show popup
    const turnChanged = this.gameState.currentTurn !== newState.currentTurn;
    // Detect phase breakpoint hit
    const phaseChanged = this.gameState.phase !== newState.phase;
    const wasNotOver = !this.gameState.winner;

    this.gameState = newState;
    // Settle BEFORE rendering: settling clears `waitingOnPlayer`, and rendering first
    // would paint the player's "Pass Priority" button for a window they have already
    // given up. The awaiting loop resumes on a microtask, i.e. after this render.
    if (playerReleasedPriority) this.settlePlayerWait('acted');
    this.render();
    this.updateTimerDisplay();

    // Notify Willow of player actions (detect cards leaving player's hand)
    this.willowDetectPlayerActions(myUid, newState);

    // Notify Willow when game ends
    if (newState.winner && wasNotOver) {
      this.willow.onGameEnd(newState.winner, BOT_UID);
    }

    // Phase breakpoint notification
    if (phaseChanged && this.phaseBreakpoint && newState.phase === this.phaseBreakpoint &&
        newState.currentTurn === myUid && !newState.winner) {
      this.breakpointHitPhase = newState.phase;
      this.clearPlayerInactivityTimer();
      this.haltPlayerWaitClock();
      this.clearPriorityCountdown();
      this.render();
    }

    // Show ritual popup if one was set
    if (newState.pendingRitualPopup) {
      this.showRitualPopupToast(newState.pendingRitualPopup);
      // Clear the popup from state so it doesn't show again
      this.gameState = { ...newState, pendingRitualPopup: undefined };
    }

    // Show turn popup on turn switch
    if (turnChanged && !newState.winner) {
      this.showTurnPopupFor(newState);
    }

    if (newState.winner) {
      this.settlePlayerWait('acted');
      this.clearPriorityCountdown();
      return;
    }

    if (!this.botRunning && !this.waitingOnPlayer && !this.stackLoopRunning) {
      this.maybeBotTurn();
    }

    // Anything on the stack is driven by the one stack-priority loop, on either
    // turn. The loop is idempotent, so calling it here is the only entry point
    // needed — this replaces the two separate schedulers that used to race.
    if (newState.stack.length > 0 && !this.stackLoopRunning &&
        !this.botRunning && !this.waitingOnPlayer) {
      void this.driveStackPriority();
      return;
    }

    // If player's combat blocks step: trigger bot blocking
    if (!this.botRunning && !this.waitingOnPlayer && !this.stackLoopRunning &&
        newState.currentTurn === myUid &&
        newState.phase === 'combat' && newState.combatStep === 'blocks') {
      void this.botDeclareBlockersAndAdvance();
      return;
    }

    // Bot briefly holds priority during the player's turn (e.g. after ancient use)
    // with nothing on the stack — hand it back after a beat.
    if (!this.botRunning && !this.waitingOnPlayer && !this.stackLoopRunning &&
        newState.currentTurn === myUid &&
        newState.priorityPlayer !== myUid &&
        newState.combatStep !== 'blocks' &&
        newState.stack.length === 0) {
      this.botAutoPassPriority();
      return;
    }

    // Start turn timer when player has priority on their own turn
    // (handles both auto-advance for replenish/draw and 30s inactivity for other phases)
    this.startPlayerInactivityTimer();
  }

  /**
   * Re-arm whichever priority window was live after a pause or breakpoint ends.
   * The bot and stack loops resume on their own (they park on `isHalted()`); this
   * only has to restore the player-side clock and restart the loop if nothing is
   * driving a stack that is still sitting there.
   */
  private resumeAfterHalt(): void {
    if (this.isHalted() || this.gameState.winner) return;

    // A window that was open when we halted just picks up where it left off.
    if (this.playerWait) {
      this.resumePlayerWaitClock();
      this.render();
      return;
    }
    if (this.gameState.stack.length > 0 && !this.stackLoopRunning
        && !this.botRunning && !this.waitingOnPlayer) {
      void this.driveStackPriority();
      return;
    }
    // Bot was left holding priority on an empty stack during the player's turn.
    const gs = this.gameState;
    if (!this.botRunning && !this.stackLoopRunning
        && gs.currentTurn === this.currentUser.uid && gs.priorityPlayer !== this.currentUser.uid) {
      this.botAutoPassPriority();
      return;
    }
    this.startPlayerInactivityTimer();
  }

  /** True when any blocking modal/overlay is currently on screen. */
  private hasOpenModal(): boolean {
    return !!this.container.querySelector('.overlay')
      || this.showBreakpointPicker
      || this.breakpointHitPhase !== null
      || this.showRitualModal
      || this.showSettings;
  }

  private showRitualPopupToast(msg: string): void {
    // Remove any existing popup
    this.container.querySelector('#ritual-toast')?.remove();
    if (this.ritualPopupTimerId !== null) clearTimeout(this.ritualPopupTimerId);

    const popup = document.createElement('div');
    popup.id = 'ritual-toast';
    popup.className = 'ritual-toast';
    popup.innerHTML = `
      <div class="ritual-toast-icon">🔮</div>
      <div class="ritual-toast-msg">${msg}</div>
      <div class="ritual-toast-sub">RITUAL ACTIVATED</div>
    `;
    this.container.appendChild(popup);

    this.ritualPopupTimerId = this.later(() => {
      popup.classList.add('ritual-toast-fade');
      this.later(() => popup.remove(), 600);
      this.ritualPopupTimerId = null;
    }, 3500);
  }

  // Show ritual popup toast if one is pending in state and return state with it cleared
  private maybeShowRitualPopup(gs: GameState): GameState {
    if (gs.pendingRitualPopup) {
      this.showRitualPopupToast(gs.pendingRitualPopup);
      return { ...gs, pendingRitualPopup: undefined };
    }
    return gs;
  }

  private showTurnPopupFor(gs: GameState): void {
    const myUid = this.currentUser.uid;
    if (this.turnPopupTimerId !== null) clearTimeout(this.turnPopupTimerId);
    this.turnPopupVisible = true;
    this.turnPopupIsMyTurn = gs.currentTurn === myUid;
    this.render();
    this.turnPopupTimerId = this.later(() => {
      this.dismissTurnPopup();
    }, 3000);
  }

  private dismissTurnPopup(): void {
    if (this.turnPopupTimerId !== null) {
      clearTimeout(this.turnPopupTimerId);
      this.turnPopupTimerId = null;
    }
    this.turnPopupVisible = false;
    this.render();
  }

  private buildTurnPopup(): string {
    const titleClass = this.turnPopupIsMyTurn ? 'yours' : 'bots';
    const titleText = this.turnPopupIsMyTurn ? '⚔ YOUR TURN' : '🤖 BOT\'S TURN';
    const yieldBtn = this.turnPopupIsMyTurn
      ? `<button id="btn-turn-popup-yield" class="btn-gold" style="font-size:8px;padding:5px 10px">🔴 Stop at Play 1</button>`
      : '';
    return `
      <div class="turn-popup-overlay" id="turn-popup-overlay">
        <div class="turn-popup">
          <div class="turn-popup-title ${titleClass}">${titleText}</div>
          <div class="turn-popup-hint">SPACE or click Okay to continue</div>
          <div class="turn-popup-buttons">
            <button id="btn-turn-popup-okay" class="btn-green" style="font-size:9px;padding:6px 14px">Okay</button>
            ${yieldBtn}
          </div>
        </div>
      </div>
    `;
  }

  // ── Bot AI ──────────────────────────────────────────────────────────────────

  private maybeBotTurn(): void {
    if (this.gameState.currentTurn !== BOT_UID) return;
    if (this.gameState.winner) return;
    if (this.botRunning) return;
    this.botRunning = true;
    this.later(() => this.runBotTurnAsync(), 600);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => { this.later(resolve, ms); });
  }

  // ── Timeout bookkeeping ────────────────────────────────────────────────────

  /**
   * `setTimeout` that registers itself so `destroy()` can cancel it. Every deferred
   * action in this screen goes through here; otherwise a screen the player has left
   * keeps mutating state behind a new game.
   */
  private later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this.pendingTimeouts.delete(id);
      fn();
    }, ms);
    this.pendingTimeouts.add(id);
    return id;
  }

  private clearLater(id: ReturnType<typeof setTimeout> | null): void {
    if (id === null) return;
    clearTimeout(id);
    this.pendingTimeouts.delete(id);
  }

  private clearAllTimeouts(): void {
    for (const id of this.pendingTimeouts) clearTimeout(id);
    this.pendingTimeouts.clear();
  }

  // ── Halting (pause / phase breakpoint) ─────────────────────────────────────

  /** True while the game is deliberately stopped and nothing should act. */
  private isHalted(): boolean {
    return this.destroyed || this.gamePaused || this.breakpointHitPhase !== null;
  }

  /**
   * Park until the game is un-halted. Pause and phase breakpoints previously stopped
   * only the player's inactivity timer, so the bot kept playing through them.
   * Returns immediately once the screen is destroyed so loops can unwind.
   */
  private async awaitUnhalted(): Promise<void> {
    while (this.isHalted() && !this.destroyed && !this.gameState.winner) {
      await this.delay(250);
    }
  }

  // ── State commit ───────────────────────────────────────────────────────────

  /**
   * Assign game state from a priority/bot path and refresh the view.
   *
   * Unlike `setState` this does not re-enter the bot/priority scheduling — the
   * caller is already inside that flow. It exists so no priority path can leave a
   * stale action bar or a stale clock behind, which is what happened when these
   * paths did `this.gameState = …; this.render();` by hand.
   */
  private commit(gs: GameState): void {
    this.gameState = gs;
    this.render();
    this.updateTimerDisplay();
  }

  /**
   * Record that `uid` passed priority in the current window and show the result.
   * Returns true when this pass closed the window (both players have now passed).
   */
  private passPriorityFor(uid: string): boolean {
    const { state, bothPassed } = recordPriorityPass(this.gameState, uid);
    this.commit(state);
    return bothPassed;
  }

  // ── Waiting on the player ──────────────────────────────────────────────────

  /**
   * Hand the player a priority window and wait for them to close it. Resolves with
   * 'passed' when they pass, 'acted' when they instead respond (which opens a new
   * window for the bot), or 'timeout' when the clock runs out.
   */
  private awaitPlayerWait(kind: PlayerWaitKind, timeoutMs: number): Promise<PlayerWaitOutcome> {
    // Never leave an earlier wait dangling.
    this.settlePlayerWait('acted');
    return new Promise<PlayerWaitOutcome>((resolve) => {
      this.waitingOnPlayer = true;
      this.playerWait = { kind, resolve, deadlineMs: Date.now() + timeoutMs, frozenMs: null };
      this.startPriorityCountdown(timeoutMs, kind === 'blocks' ? 'blocks' : 'you');
      this.playerWaitTimeoutId = this.later(() => this.settlePlayerWait('timeout'), timeoutMs);
      this.render();
    });
  }

  /** The single exit for a player wait — idempotent, so a late timer is harmless. */
  private settlePlayerWait(outcome: PlayerWaitOutcome): void {
    const wait = this.playerWait;
    if (!wait) return;
    this.playerWait = null;
    this.clearLater(this.playerWaitTimeoutId);
    this.playerWaitTimeoutId = null;
    this.clearPriorityCountdown();
    this.waitingOnPlayer = false;
    wait.resolve(outcome);
  }

  /** True when a wait of this kind is currently outstanding. */
  private isWaitingFor(kind: PlayerWaitKind): boolean {
    return this.playerWait?.kind === kind;
  }

  /**
   * Freeze an open player wait. Pause used to clear only the visible countdown, so a
   * 30s window still timed out — and auto-passed — while the game sat paused.
   */
  private haltPlayerWaitClock(): void {
    const wait = this.playerWait;
    if (!wait || this.playerWaitTimeoutId === null) return;
    // Bank what is left; resume re-arms with exactly that.
    wait.frozenMs = Math.max(0, wait.deadlineMs - Date.now());
    this.clearLater(this.playerWaitTimeoutId);
    this.playerWaitTimeoutId = null;
    this.clearPriorityCountdown();
  }

  /** Restore a frozen player wait with the time it had left. */
  private resumePlayerWaitClock(): void {
    const wait = this.playerWait;
    if (!wait || this.playerWaitTimeoutId !== null) return;
    // Always give at least a second back, so resuming never instantly times out.
    const remaining = Math.max(1000, wait.frozenMs ?? (wait.deadlineMs - Date.now()));
    wait.frozenMs = null;
    wait.deadlineMs = Date.now() + remaining;
    this.startPriorityCountdown(remaining, wait.kind === 'blocks' ? 'blocks' : 'you');
    this.playerWaitTimeoutId = this.later(() => this.settlePlayerWait('timeout'), remaining);
  }

  // ── Stack priority ─────────────────────────────────────────────────────────

  /**
   * Drive priority over a non-empty stack until it resolves.
   *
   * This is the single implementation for both turns. Previously the player's turn
   * used an event-driven tracker while the bot's turn awaited one player pass and
   * then resolved the whole stack unconditionally — so the bot never got a response
   * window on its own turn, and two different code paths could record passes for
   * the same window.
   *
   * Whoever holds priority acts or passes; a response opens a fresh window for the
   * opponent; the stack resolves only once both players have passed in succession.
   */
  private async driveStackPriority(): Promise<void> {
    if (this.stackLoopRunning) return;
    this.stackLoopRunning = true;
    this.render();
    try {
      // Bounded so a logic error degrades into "stack resolves" rather than a hang.
      for (let guard = 0; guard < 64; guard++) {
        await this.awaitUnhalted();
        if (this.destroyed) break;
        const gs = this.gameState;
        if (gs.winner || gs.stack.length === 0) break;

        if (gs.priorityPlayer === BOT_UID) {
          this.startPriorityCountdown(BOT_RESPONSE_MS, 'bot');
          await this.delay(BOT_RESPONSE_MS);
          this.clearPriorityCountdown();
          // The game may have been paused during the think delay.
          if (this.isHalted()) continue;
          if (this.gameState.winner) break;
          if (this.gameState.priorityPlayer !== BOT_UID || this.gameState.stack.length === 0) continue;
          // A response puts a card on the stack, which opens a new window for the
          // player — so loop rather than recording a pass.
          if (this.botTryRespond()) continue;
          if (this.passPriorityFor(BOT_UID)) this.setState(resolveEntireStack(this.gameState));
          continue;
        }

        const outcome = await this.awaitPlayerWait('stack', PLAYER_PRIORITY_MS);
        if (this.gameState.winner) break;
        if (outcome === 'acted') continue;   // player responded; bot now holds priority
        if (outcome === 'timeout') {
          this.commit(addScreenLog(this.gameState, 'Priority timed out — auto-passed.'));
        }
        if (this.gameState.priorityPlayer !== this.currentUser.uid) continue;
        if (this.passPriorityFor(this.currentUser.uid)) this.setState(resolveEntireStack(this.gameState));
      }
    } catch (e) {
      console.warn('Stack priority error:', e);
    } finally {
      this.stackLoopRunning = false;
      this.settlePlayerWait('acted');
      this.clearPriorityCountdown();
      this.render();
      this.startPlayerInactivityTimer();
    }
  }

  /**
   * Run the pre-damage priority window: the active player passes, then the defender,
   * and only then does combat damage resolve. A spell cast during the window opens a
   * stack window first and the gate restarts, because the board may have changed.
   */
  private async runPreDamageGate(): Promise<GameState> {
    const myUid = this.currentUser.uid;
    for (let guard = 0; guard < 16; guard++) {
      await this.awaitUnhalted();
      if (this.destroyed) return this.gameState;
      let gs = this.gameState;
      if (gs.winner || gs.combatStep !== 'pre-damage' || gs.pendingDamageChoice) return gs;

      if (gs.stack.length > 0) {
        await this.driveStackPriority();
        // The stack window reset priority, so the gate starts over.
        this.commit(beginPriorityWindow(this.gameState, this.gameState.currentTurn));
        continue;
      }

      if (gs.priorityPlayer === BOT_UID) {
        this.startPriorityCountdown(BOT_RESPONSE_MS, 'bot');
        await this.delay(BOT_RESPONSE_MS);
        this.clearPriorityCountdown();
        if (this.isHalted()) continue;
        gs = this.gameState;
        if (gs.winner || gs.combatStep !== 'pre-damage' || gs.stack.length > 0) continue;
        if (this.passPriorityFor(BOT_UID)) {
          this.commit(advancePhase(this.gameState, this.gameState.currentTurn));
          return this.gameState;
        }
        continue;
      }

      const outcome = await this.awaitPlayerWait('predamage', PLAYER_PRIORITY_MS);
      gs = this.gameState;
      if (gs.winner) return gs;
      if (outcome === 'acted') continue;
      if (gs.combatStep !== 'pre-damage' || gs.stack.length > 0) continue;
      if (gs.priorityPlayer !== myUid) continue;
      if (this.passPriorityFor(myUid)) {
        this.commit(advancePhase(this.gameState, this.gameState.currentTurn));
        return this.gameState;
      }
    }
    return this.gameState;
  }

  // ── Player turn timer ──────────────────────────────────────────────────────

  /**
   * Start the player's own clock: a short auto-advance through the mechanical
   * replenish / draw steps, otherwise the 30s inactivity window.
   *
   * Safe to call unconditionally — it clears any previous clock and returns without
   * arming one when it is not the player's window to hold.
   */
  private startPlayerInactivityTimer(): void {
    this.clearPlayerInactivityTimer();
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    if (gs.winner) return;
    if (this.isHalted()) return;
    if (this.waitingOnPlayer || this.botRunning || this.stackLoopRunning) return;
    if (gs.currentTurn !== myUid || gs.priorityPlayer !== myUid) return;

    const isEarlyPhase = gs.phase === 'replenish' || gs.phase === 'draw';

    if (isEarlyPhase) {
      // Auto-advance the mechanical steps.
      this.playerInactivityTimerId = this.later(() => {
        this.playerInactivityTimerId = null;
        const curGs = this.gameState;
        if (curGs.currentTurn !== myUid || curGs.winner) return;
        if (this.isHalted()) return;
        const next = advancePhase(curGs, myUid);
        if (next !== curGs) this.setState(next);
      }, EARLY_PHASE_AUTO_MS);
      return;
    }

    this.startPriorityCountdown(PLAYER_PRIORITY_MS, 'you');
    this.playerInactivityTimerId = this.later(() => {
      this.playerInactivityTimerId = null;
      this.clearPriorityCountdown();
      const curGs = this.gameState;
      if (curGs.currentTurn !== myUid || curGs.winner) return;
      if (curGs.priorityPlayer !== myUid || this.waitingOnPlayer || this.botRunning) return;
      if (this.isHalted()) return;

      // A pending damage choice is a decision, not a phase — resolve it, don't skip it.
      if (curGs.pendingDamageChoice) {
        const resolved = chooseCombatDamageMode(curGs, myUid, 'additive');
        if (resolved !== curGs) this.setState(resolved);
        return;
      }

      // With cards on the stack, timing out means passing priority — not skipping the
      // phase, which would resolve the stack without giving the bot its window.
      if (curGs.stack.length > 0) {
        this.handlePassPriority();
        return;
      }

      const next = advancePhase(curGs, myUid);
      if (next !== curGs) this.setState(next);
    }, PLAYER_PRIORITY_MS);
  }

  private clearPlayerInactivityTimer(): void {
    this.clearLater(this.playerInactivityTimerId);
    this.playerInactivityTimerId = null;
  }

  // ── Priority countdown ─────────────────────────────────────────────────────

  private startPriorityCountdown(durationMs: number, owner: 'you' | 'bot' | 'blocks'): void {
    this.clearPriorityCountdown();
    this.priorityTimerEndMs = Date.now() + durationMs;
    this.priorityTimerOwner = owner;
    // Paint immediately: the clock used to be started by paths that run after the
    // last render, leaving it running but hidden.
    this.updateTimerDisplay();
    this.priorityCountdownInterval = setInterval(() => this.updateTimerDisplay(), 250);
  }

  private clearPriorityCountdown(): void {
    if (this.priorityCountdownInterval !== null) {
      clearInterval(this.priorityCountdownInterval);
      this.priorityCountdownInterval = null;
    }
    this.priorityTimerEndMs = null;
    this.priorityTimerOwner = null;
    this.updateTimerDisplay();
  }

  /**
   * The only writer for the countdown element. Owns text, colour *and* visibility,
   * so the clock is never left hidden by a render that happened before it started.
   */
  private updateTimerDisplay(): void {
    const el = this.container.querySelector<HTMLElement>('#priority-timer');
    if (!el) return;
    if (this.priorityTimerEndMs === null) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    const remaining = Math.max(0, this.priorityTimerEndMs - Date.now());
    const secs = Math.ceil(remaining / 1000);
    const label = this.priorityTimerOwner === 'bot' ? 'bot'
      : this.priorityTimerOwner === 'blocks' ? 'blocks'
      : 'you';
    el.style.display = '';
    el.textContent = `⏱ ${secs}s · ${label}`;
    el.style.color = remaining <= 5000 ? 'var(--red)' : 'var(--gold)';
  }

  // ── Bot auto-pass on an empty stack ────────────────────────────────────────

  /**
   * The bot briefly holds priority during the player's turn (after the player used
   * an ancient, say) and then hands it back. Pre-damage is excluded: that window is
   * owned by `runPreDamageGate` / `handlePassPriority`.
   */
  private botAutoPassPriority(): void {
    if (this.botAutoPassScheduled) return;
    if (this.isHalted()) return;
    this.botAutoPassScheduled = true;
    this.startPriorityCountdown(BOT_AUTO_PASS_MS, 'bot');
    this.later(() => {
      this.botAutoPassScheduled = false;
      this.clearPriorityCountdown();
      if (this.isHalted()) return;
      const gs = this.gameState;
      const myUid = this.currentUser.uid;
      if (gs.currentTurn !== myUid || gs.priorityPlayer === myUid || gs.winner) return;
      if (this.botRunning || this.waitingOnPlayer || this.stackLoopRunning) return;

      if (gs.combatStep === 'pre-damage') {
        // Bot passing here may close the pre-damage window and resolve damage.
        if (this.passPriorityFor(BOT_UID)) {
          const next = advancePhase(this.gameState, this.gameState.currentTurn);
          if (next !== this.gameState) this.setState(next);
        } else {
          this.startPlayerInactivityTimer();
        }
        return;
      }

      // Empty-stack window outside combat: nothing to respond to, hand it straight back.
      this.commit(resetPriority(gs, myUid));
      this.startPlayerInactivityTimer();
    }, BOT_AUTO_PASS_MS);
  }

  /**
   * Safety net: if the bot ends up holding priority during the player's turn with
   * nothing driving it, restart the right flow. Halted games are left alone.
   */
  private botPrioritySanityCheck(): void {
    const gs = this.gameState;
    if (gs.winner || this.gamePhase !== 'playing') return;
    if (this.isHalted()) return;
    const myUid = this.currentUser.uid;

    if (gs.currentTurn !== myUid) return;                 // bot's turn: runBotTurnAsync owns it
    if (gs.priorityPlayer === myUid) return;              // player has priority
    if (this.botRunning || this.waitingOnPlayer) return;  // already in progress
    if (this.stackLoopRunning) return;                    // stack loop owns it
    if (this.botAutoPassScheduled) return;                // auto-pass already scheduled

    if (gs.stack.length > 0) {
      console.warn('[SanityCheck] Bot has priority with stack items — driving stack priority');
      void this.driveStackPriority();
    } else {
      console.warn('[SanityCheck] Bot has priority with empty stack — triggering auto-pass');
      this.botAutoPassPriority();
    }
  }

  // ── Willow AI: detect player actions from state diffs ─────────────────────
  private prevPlayerHand: Set<string> = new Set();
  private willowDetectPlayerActions(playerUid: string, gs: GameState): void {
    const ps = getPlayerState(gs, playerUid);
    const newHand = new Set(ps.hand.map(c => c.id));
    // Cards that left the hand = player played them
    for (const id of this.prevPlayerHand) {
      if (!newHand.has(id)) {
        // Try to find what the card was from the old game state
        const oldPs = getPlayerState(this.gameState, playerUid);
        const card = oldPs?.hand?.find(c => c.id === id);
        if (card) {
          const def = CARD_DEFS[card.defId];
          const action = def ? `play_${def.type}_${def.spellType ?? def.id}` : 'play_unknown';
          this.willow.recordPlayerAction(gs, BOT_UID, action);
        }
      }
    }
    this.prevPlayerHand = newHand;
  }

  private botChooseDamageMode(gs: GameState): 'additive' | 'multiplicative' {
    const atkPs = getPlayerState(gs, BOT_UID);
    const defPs = getOpponentState(gs, BOT_UID);
    const unblockedPowers: number[] = atkPs.attackers
      .filter(atkId => !Object.values(defPs.blockers).includes(atkId))
      .map(atkId => {
        const card = atkPs.battlefield.find(c => c.id === atkId);
        return card ? (CARD_DEFS[card.defId]?.power ?? 0) : 0;
      })
      .filter(p => p > 0);

    const mode = this.willow.recommendDamageMode(gs, BOT_UID, unblockedPowers);
    this.willow.recordBotAction(gs, BOT_UID, mode === 'additive' ? 'damage_additive' : 'damage_multiplicative');
    return mode;
  }

  // During player's attack, bot declares blockers then advances combat
  private async botDeclareBlockersAndAdvance(): Promise<void> {
    if (this.botRunning) return;
    this.botRunning = true;
    try {
      await this.delay(1000);
      await this.awaitUnhalted();
      let gs = this.gameState;
      const myUid = this.currentUser.uid;
      if (gs.currentTurn !== myUid || gs.combatStep !== 'blocks' || gs.winner) {
        return;
      }

      const botPs = getPlayerState(gs, BOT_UID);
      const playerPs = getPlayerState(gs, myUid);

      // Ask Willow for intelligent block assignments
      const availableBlockers = botPs.battlefield.filter(c => {
        const def = CARD_DEFS[c.defId];
        return def?.type === 'being' && !c.exhausted;
      });

      const willowAssignments = this.willow.recommendBlockers(
        gs, BOT_UID, [...playerPs.attackers], [...availableBlockers],
      );

      for (const [atkId, blkId] of Object.entries(willowAssignments)) {
        gs = declareBlocker(gs, BOT_UID, blkId, atkId);
      }
      this.willow.recordBotAction(gs, BOT_UID,
        Object.keys(willowAssignments).length === playerPs.attackers.length ? 'block_all' :
        Object.keys(willowAssignments).length > 0 ? 'block_selective' : 'no_block',
      );

      this.commit(gs);
      await this.delay(600);

      // Advance: blocks → pre-damage. The player (active player) holds priority
      // there and must pass before damage resolves; the bot then passes too.
      gs = advancePhase(this.gameState, myUid);
      // Release the bot BEFORE rendering: `buildActionBar` suppresses every button
      // while the bot is running, so rendering first left the player at pre-damage
      // with no Pass Priority button and no clock.
      this.botRunning = false;
      this.commit(gs);
    } catch (e) {
      console.warn('Bot blocking error:', e);
    } finally {
      this.botRunning = false;
      this.render();
      this.startPlayerInactivityTimer();
    }
  }

  private async runBotTurnAsync(): Promise<void> {
    let gs = this.gameState;

    try {
      await this.awaitUnhalted();
      // replenish → draw
      if (gs.phase === 'replenish') gs = advancePhase(gs, BOT_UID);
      if (gs.phase === 'draw') gs = advancePhase(gs, BOT_UID);
      this.commit(gs);
      await this.delay(400);

      // play1
      if (gs.phase === 'play1') {
        gs = await this.botPlayPhase(gs);
        gs = advancePhase(gs, BOT_UID); // → combat
        this.commit(gs);
        await this.delay(400);
      }

      // combat
      if (gs.phase === 'combat') {
        await this.awaitUnhalted();
        gs = advancePhase(gs, BOT_UID); // none → pre
        gs = advancePhase(gs, BOT_UID); // pre → attackers

        // Ask Willow for attack strategy
        const strategy = this.willow.recommendAttackStrategy(gs, BOT_UID);
        const botPs = getPlayerState(gs, BOT_UID);
        const eligible = botPs.battlefield.filter(c => {
          const def = CARD_DEFS[c.defId];
          return def?.type === 'being' && (!c.exhausted || def.isFlyer) && !(def.id === 'wasp' && c.summonedThisTurn);
        });

        if (strategy === 'all') {
          for (const c of eligible) gs = declareAttacker(gs, BOT_UID, c.id);
          this.willow.recordBotAction(gs, BOT_UID, 'attack_all', 0.1);
        } else if (strategy === 'selective') {
          const toAttack = this.willow.evaluateAttackers(gs, BOT_UID, eligible);
          for (const id of toAttack) gs = declareAttacker(gs, BOT_UID, id);
          this.willow.recordBotAction(gs, BOT_UID, 'attack_selective', 0.05);
        } else {
          this.willow.recordBotAction(gs, BOT_UID, 'no_attack');
        }
        this.commit(gs);
        await this.delay(400);

        // advancePhase auto-skips blocking if player has no unexhausted beings
        gs = advancePhase(gs, BOT_UID); // attackers → blocks (or pre-damage if no player blockers)
        this.commit(gs);
        await this.delay(400);

        if (gs.combatStep === 'blocks') {
          // Blocking is the defender's step and `advancePhase` already handed them
          // priority, so the banner and the action bar agree while we wait.
          await this.awaitPlayerWait('blocks', PLAYER_BLOCK_MS);
          gs = advancePhase(this.gameState, BOT_UID); // blocks → pre-damage
          this.commit(gs);
          await this.delay(400);
        }

        // Pre-damage: a real two-pass priority window. The bot passes, the player
        // passes (or responds, which opens a stack window first), and only then does
        // combat damage resolve.
        if (gs.combatStep === 'pre-damage') {
          gs = await this.runPreDamageGate();
        }

        // Bot auto-chooses best damage mode if unblocked attackers are present
        if (gs.pendingDamageChoice && gs.currentTurn === BOT_UID) {
          const mode = this.botChooseDamageMode(gs);
          gs = chooseCombatDamageMode(gs, BOT_UID, mode);
        }
        this.commit(gs);
        await this.delay(400);
      }

      // play2
      if (gs.phase === 'play2') {
        await this.awaitUnhalted();
        gs = await this.botPlayPhase(gs);
        gs = advancePhase(gs, BOT_UID); // → end
        this.commit(gs);
        await this.delay(300);
      }

      if (gs.phase === 'end') {
        gs = advancePhase(gs, BOT_UID);
        this.commit(gs);
      }
    } catch (e) {
      console.warn('Bot turn error:', e);
    }

    this.botRunning = false;
    this.render();
    // After bot turn ends, player has priority — show turn popup then start inactivity timer
    if (!this.gameState.winner) {
      this.showTurnPopupFor(this.gameState);
      this.startPlayerInactivityTimer();
    }
  }

  private async botPlayPhase(gs: GameState): Promise<GameState> {
    const botPs = getPlayerState(gs, BOT_UID);

    // Play landscape (if allowed, no priority)
    const isP1Bot = gs.player1 === BOT_UID;
    const landThisTurn = isP1Bot ? gs.p1LandscapesThisTurn : gs.p2LandscapesThisTurn;
    const botTurnCount = isP1Bot ? gs.p1TurnCount : gs.p2TurnCount;
    const maxLand = Math.min(botTurnCount, 3);

    let landPlayed = landThisTurn;
    for (const c of [...botPs.hand]) {
      if (landPlayed >= maxLand) break;
      if (CARD_DEFS[c.defId]?.type === 'landscape') {
        const next = playCard(gs, BOT_UID, c.id);
        if (next !== gs) {
          gs = next;
          landPlayed++;
          this.willow.recordBotAction(gs, BOT_UID, 'play_landscape', 0.1);
          this.commit(gs);
          await this.delay(500);
        }
      }
    }

    // Play beings — Willow recommends play order
    const refreshedPs = getPlayerState(gs, BOT_UID);
    const beings = this.willow.recommendPlayOrder(
      gs, BOT_UID,
      refreshedPs.hand.filter(c => CARD_DEFS[c.defId]?.type === 'being'),
    );

    for (const c of beings) {
      const def = CARD_DEFS[c.defId];
      const next = playCard(gs, BOT_UID, c.id);
      if (next !== gs) {
        gs = next;
        const cost = def?.cost ?? 1;
        const action = def?.isFlyer ? 'play_flyer' : (`play_being_${Math.min(5, Math.max(1, cost))}` as any);
        this.willow.recordBotAction(gs, BOT_UID, action, 0.05 * cost);
        this.commit(gs);
        await this.delay(400);

        if (gs.stack.length > 0) {
          // Hand priority to the player and run the shared priority loop, which
          // resolves the stack only once both sides have passed — and gives the bot
          // its own response window if the player answers.
          await this.driveStackPriority();
          gs = this.maybeShowRitualPopup(this.gameState);
          this.commit(gs);
          await this.delay(400);
        }
      }
    }

    // Cast spells — Willow advises on targeting
    const currentPs = getPlayerState(gs, BOT_UID);
    const spells = currentPs.hand
      .filter(c => CARD_DEFS[c.defId]?.type === 'spell')
      .sort((a, b) => (CARD_DEFS[a.defId]?.cost ?? 0) - (CARD_DEFS[b.defId]?.cost ?? 0));

    for (const c of spells) {
      const def = CARD_DEFS[c.defId];
      if (!def || !def.cost) continue;
      const botWP = getPlayerState(gs, BOT_UID).willPower;
      if (botWP < (def.cost ?? 0)) continue;

      let target: string | undefined;
      let actionLabel: string = 'skip';
      if (def.spellType === 'ignite' || def.spellType === 'spike') {
        const recommendation = this.willow.recommendSpellTarget(gs, BOT_UID, def.spellType);
        const playerPs = getPlayerState(gs, this.currentUser.uid);
        const playerBeings = playerPs.battlefield.filter(b => CARD_DEFS[b.defId]?.type === 'being');

        if (recommendation === 'best_being' && playerBeings.length > 0) {
          const best = playerBeings.sort((a, b) => (CARD_DEFS[b.defId]?.power ?? 0) - (CARD_DEFS[a.defId]?.power ?? 0))[0];
          target = best.id;
          actionLabel = def.spellType === 'ignite' ? 'cast_ignite_being' : 'cast_spike_being';
        } else {
          target = 'opponent';
          actionLabel = def.spellType === 'ignite' ? 'cast_ignite_opponent' : 'cast_spike_opponent';
        }
      } else if (def.spellType === 'grow') {
        target = undefined;
        actionLabel = 'cast_grow';
      } else if (def.spellType === 'cancel') {
        // Don't cast cancel proactively (save for response)
        continue;
      }

      const next = playCard(gs, BOT_UID, c.id, target);
      if (next !== gs) {
        gs = next;
        this.willow.recordBotAction(gs, BOT_UID, actionLabel as any, 0.1);
        this.commit(gs);
        await this.delay(400);

        if (gs.stack.length > 0) {
          await this.driveStackPriority();
          gs = this.maybeShowRitualPopup(this.gameState);
          this.commit(gs);
          await this.delay(400);
        }
      }
    }

    return gs;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private render(): void {
    if (this.gamePhase === 'ancient-selection') {
      this.renderAncientSelection();
      return;
    }
    this.renderGame();
  }

  private renderAncientSelection(): void {
    const ancientCards = ANCIENTS.map(defId => {
      const def = CARD_DEFS[defId];
      if (!def) return '';
      const imgTag = def.imageUrl
        ? `<img src="${def.imageUrl}" alt="${def.name}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" />`
        : '';
      return `
        <div class="ancient-select-card" data-id="${defId}">
          <div class="ancient-select-img">${imgTag}<span class="ancient-select-emoji">⭐</span></div>
          <div class="ancient-select-name">${def.name}</div>
          <div class="ancient-select-desc">${def.description}</div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="ancient-selection-screen">
        <div class="ancient-selection-header">
          <h1 class="ancient-selection-title">⭐ CHOOSE YOUR ANCIENT ⭐</h1>
          <p class="ancient-selection-subtitle">Double-click your Ancient during the game to use its ability. Choose wisely.</p>
        </div>
        <div class="ancient-selection-grid">
          ${ancientCards}
        </div>
      </div>
    `;

    this.container.querySelectorAll<HTMLElement>('.ancient-select-card').forEach(el => {
      el.addEventListener('click', () => {
        const defId = el.dataset.id!;
        let gs = selectAncient(this.gameState, this.currentUser.uid, defId);
        // Auto-select a random ancient for the bot
        const botAncientId = ANCIENTS[Math.floor(Math.random() * ANCIENTS.length)];
        gs = selectAncient(gs, BOT_UID, botAncientId);
        // Kick off replenish/draw for player's first turn
        gs = advancePhase(gs, this.currentUser.uid); // replenish → draw
        gs = advancePhase(gs, this.currentUser.uid); // draw → play1
        this.handOrder = getPlayerState(gs, this.currentUser.uid).hand.map(c => c.id);
        this.gamePhase = 'playing';
        this.setState(gs);
      });
    });
  }

  private renderGame(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const opp = getOpponentState(gs, myUid);
    const isMyTurn = gs.currentTurn === myUid;
    const myHasP = gs.priorityPlayer === myUid;

    // Separate battlefield into landscapes and beings
    const oppLandscapes = opp.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');
    const oppBeings = opp.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'being');
    const myLandscapes = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');
    const myBeings = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'being');

    // max landscapes this turn info
    const isP1 = gs.player1 === myUid;
    const playerTurnCount = isP1 ? gs.p1TurnCount : gs.p2TurnCount;
    const maxLand = Math.min(playerTurnCount, 3);
    const landThisTurn = isP1 ? gs.p1LandscapesThisTurn : gs.p2LandscapesThisTurn;

    const orderedHand = this.handOrder
      .filter(id => ps.hand.some(c => c.id === id))
      .map(id => ps.hand.find(c => c.id === id)!);

    // Opponent hand card backs — centered, using card-back logo
    const cardBackUrl = `${import.meta.env.BASE_URL}cards/scape_back_logo.png`;
    const oppHandBacks = Array(opp.hand.length).fill(0).map(() =>
      `<div class="card-back"><div class="card-back-inner"><img src="${cardBackUrl}" alt="?" onerror="this.outerHTML='?'" /></div></div>`
    ).join('');

    // Ritual zone partial match hints
    const partialRitualNames = getPartialRitualMatches(ps.ritualZone);
    const ritualHintHtml = partialRitualNames.length > 0
      ? `<div class="ritual-hint-active">${partialRitualNames.map(n => `✨ ${n}`).join('<br>')}</div>`
      : '';
    const ritualZoneActive = partialRitualNames.length > 0;
    const ritualMaxLen = partialRitualNames.length > 0 ? '?' : '2';

    // Block step instruction
    const isBlockStep = gs.phase === 'combat' && gs.combatStep === 'blocks' && !isMyTurn;

    // Center phase label with description
    const phaseDescriptions: Record<string, string> = {
      replenish: 'untapping & refresh',
      draw: 'drawing a card',
      play1: 'play cards · summon beings',
      combat: 'combat',
      play2: 'play cards · summon beings',
      end: 'wrapping up',
    };
    const phaseLabel = gs.phase === 'combat'
      ? `COMBAT · ${gs.combatStep.toUpperCase()}`
      : gs.phase.toUpperCase().replace('PLAY1', 'PLAY 1').replace('PLAY2', 'PLAY 2');
    const phaseDesc = phaseDescriptions[gs.phase] ?? gs.phase;
    const phaseDescription = gs.phase === 'combat'
      ? `Combat · ${gs.combatStep}`
      : phaseDesc;

    // Priority timer. The element is always emitted and `updateTimerDisplay()` is
    // the only thing that sets its text and visibility — previously render() baked
    // in `display:none`, so any clock started after the last render ran invisibly.
    const timerHtml = '<span id="priority-timer" class="priority-timer" style="display:none"></span>';

    // WP colors for circles
    const wpColor = opp.willPower <= 5 ? '#ff4466' : opp.willPower <= 10 ? '#ff7700' : 'var(--red)';
    const myWpColor = ps.willPower <= 5 ? 'var(--red)' : ps.willPower <= 10 ? '#ff7700' : 'var(--gold)';

    this.container.innerHTML = `
      ${this.buildInfoBar(gs, ps, opp, isMyTurn, myHasP, timerHtml)}

      <div class="game-area">
        <div class="game-area-bg" style="background-image:url('${this.getPhaseBackground(gs.phase)}')"></div>
        <!-- Opponent area -->
        <div class="opponent-area ${!myHasP ? 'priority-active' : ''}">
          ${!myHasP ? '<div class="priority-field-label priority-field-bot">⚡ BOT HAS PRIORITY</div>' : ''}
          <!-- Opponent hand centered -->
          <div class="opp-hand-row opp-hand-center">
            <div class="opp-wp-circle" style="--wp-color:${wpColor}">
              <span class="wp-value" style="color:${wpColor}">${opp.willPower}</span>
            </div>
            <span class="zone-label">🤖 HAND (${opp.hand.length})</span>
            <div class="opp-hand-cards">${oppHandBacks}</div>
          </div>
          <div class="area-row">
            <div class="ancient-col">
              ${opp.ancient ? this.buildCardEl(opp.ancient, false, true) : this.buildEmptyAncient()}
              <div class="zone-label">ANCIENT</div>
            </div>
            <div style="display:flex;flex-direction:column;flex:1;gap:3px;min-width:0;">
              <div class="landscape-col">
                <div class="zone-label">🌿 (${oppLandscapes.length})</div>
                <div class="landscape-zone opp-landscape-zone" id="opp-landscapes">
                  ${oppLandscapes.map(c => this.buildCardEl(c, false, false)).join('')}
                </div>
              </div>
              <div class="opp-being-col">
                <div class="zone-label">🤖 BEINGS</div>
                <div class="battlefield-zone opp-being-zone ${isBlockStep && this.selectedCard ? 'block-targets-active' : ''}" id="opp-being-zone">
                  ${oppBeings.map(c => {
                    const isAtk = gs.p1State.attackers.includes(c.id) || gs.p2State.attackers.includes(c.id);
                    let isValidTarget = isBlockStep && this.selectedCard && isAtk;
                    // Non-flyer cannot block a flyer
                    if (isValidTarget && this.selectedCard) {
                      const selBlocker = ps.battlefield.find(b => b.id === this.selectedCard);
                      const blkDef = selBlocker ? CARD_DEFS[selBlocker.defId] : null;
                      const atkDef = CARD_DEFS[c.defId];
                      if (atkDef?.isFlyer && !blkDef?.isFlyer) isValidTarget = false;
                    }
                    return this.buildCardEl(c, !!isValidTarget, false, isAtk);
                  }).join('')}
                  ${opp.limbo.filter(c => CARD_DEFS[c.defId]?.type === 'being').map(c => this.buildCardEl(c, false, false, false, true)).join('')}
                </div>
              </div>
            </div>
            <div class="yard-col">
              <button class="yard-btn" id="btn-opp-yard">🪦 ${opp.yard.length}</button>
              <div style="font-size:7px;color:var(--text-dim)">YARD</div>
            </div>
          </div>
        </div>

        <!-- Center phase banner -->
        <div class="center-phase-banner">
          <span class="center-phase-text">${phaseLabel}</span>
          ${isMyTurn
            ? `<span class="center-turn-label turn-yours">⚔ YOUR TURN</span>`
            : `<span class="center-turn-label turn-bot">🤖 BOT TURN</span>`}
          <span class="center-phase-desc">${phaseDescription}</span>
        </div>

        <!-- Player area -->
        <div class="player-area ${myHasP ? 'priority-active' : ''}">
          ${myHasP ? '<div class="priority-field-label priority-field-player">⚡ YOUR PRIORITY</div>' : ''}
          <div class="player-main-row">
            <!-- Left: Ancient -->
            <div class="ancient-col">
              ${ps.ancient ? this.buildCardEl(ps.ancient, isMyTurn, true) : this.buildEmptyAncient()}
              <div class="zone-label">ANCIENT</div>
              ${isMyTurn && ps.ancient && !ps.ancient.exhausted ? '<span style="font-size:7px;color:var(--gold)">(dbl-click · right-click sac)</span>' : ''}
              ${!ps.ancient ? '<div style="font-size:7px;color:var(--text-dim)">SACRIFICED</div>' : ''}
            </div>

            <!-- Center: Beings + Landscape stacked -->
            <div class="player-zones-col">
              ${gs.phase === 'combat' && gs.combatStep === 'attackers' && isMyTurn ? `
              <div class="zone-label" style="color:var(--red)">⚔ ATTACK ZONE</div>
              <div class="attack-zone" id="attack-zone" data-drop="attack">
                ${ps.attackers.map(id => {
                  const c = ps.battlefield.find(b => b.id === id);
                  return c ? this.buildCardEl(c, true, false, true) : '';
                }).join('')}
                ${ps.attackers.length === 0 ? '<div class="drop-hint">Drag beings here</div>' : ''}
              </div>` : ''}
              ${isBlockStep ? `
              <div class="zone-label" style="color:var(--cyan)">🛡 Click your being → click attacker to block (multiple beings can block the same attacker)</div>` : ''}

              <div class="zone-label">🐉 BEINGS ${isMyTurn && (gs.phase === 'play1' || gs.phase === 'play2') ? `<span style="color:var(--green-dim);font-size:7px">(drag from hand · 🌿${myLandscapes.filter(c => !c.exhausted).length} free)</span>` : ''}</div>
              <div class="battlefield-zone my-being-zone" id="my-being-zone"
                   data-drop="being"
                   ondragover="event.preventDefault()" ondragleave="" ondrop="">
                ${myBeings.map(c => {
                  const isBlockerSelected = this.selectedCard === c.id && isBlockStep;
                  const assignedAttackerId = ps.blockers[c.id];
                  const isDraggableForRitual = isMyTurn && (gs.phase === 'play1' || gs.phase === 'play2');
                  return this.buildCardEl(c, isMyTurn || isBlockStep, false, ps.attackers.includes(c.id), false, isBlockerSelected, !!assignedAttackerId, isDraggableForRitual);
                }).join('')}
                ${ps.limbo.filter(c => CARD_DEFS[c.defId]?.type === 'being').map(c => this.buildCardEl(c, false, false, false, true)).join('')}
              </div>

              <div class="zone-label">🌿 LANDSCAPES (${myLandscapes.length}) · ${landThisTurn}/${maxLand} ${isMyTurn && (gs.phase === 'play1' || gs.phase === 'play2') ? '<span style="color:var(--green-dim);font-size:7px">(drag from hand · right-click sac)</span>' : ''}</div>
              <div class="landscape-zone my-landscape-zone" id="my-landscapes"
                   data-drop="landscape"
                   ondragover="event.preventDefault()" ondrop="">
                ${myLandscapes.map(c => this.buildCardEl(c, isMyTurn, false, false, false, false, false, true)).join('')}
              </div>
            </div>

            <!-- Right: Ritual + Yard -->
            <div class="player-side-col">
              <div class="ritual-col">
                <div class="zone-label ritual-zone-label">🔮 RITUAL</div>
                ${ritualHintHtml}
                <div class="ritual-zone ${ritualZoneActive ? 'ritual-zone-forming' : ''}" id="ritual-zone" data-drop="ritual">
                  ${ps.ritualZone.map((c, i) => `
                    <div class="ritual-card-slot" data-ritual-idx="${i}">
                      <span class="ritual-pos">${i + 1}</span>
                      ${this.buildCardEl(c, false, false)}
                    </div>
                  `).join('')}
                  ${ps.ritualZone.length === 0 ? '<div class="ritual-hint">Drag 🌿/🐉/✨<br>to form rituals</div>' : ''}
                </div>
                <div style="font-size:7px;color:var(--text-dim);text-align:center">${ps.ritualZone.length}/${ritualMaxLen}</div>
              </div>
              <div class="yard-col">
                <button class="yard-btn" id="btn-my-yard">🪦 ${ps.yard.length}</button>
                <div style="font-size:7px;color:var(--text-dim)">YARD</div>
                <div style="font-size:7px;color:var(--text-dim)">EXL: ${ps.exile.length}</div>
              </div>
            </div>
          </div>

          <!-- Action bar (inside player area) -->
          ${this.buildActionBar(gs, isMyTurn, myHasP)}
        </div>
      </div>

      <!-- Hand area -->
      <div class="hand-area" id="hand-area" data-drop="hand">
        <div class="deck-widget">
          <img class="deck-widget-img" src="${cardBackUrl}" alt="Deck" />
          <span class="deck-widget-count">${ps.deck.length}</span>
        </div>
        <div class="hand-label">HAND (${orderedHand.length}) — drag to reorder · drag to zone to play · SPACE = pass priority</div>
        <div class="hand-cards" id="hand-cards">
          ${orderedHand.map((c, i) => {
            const def = CARD_DEFS[c.defId];
            // Spell cards are instant-speed: interactive for any priority holder, not just the turn player
            const interactive = isMyTurn || (myHasP && def?.type === 'spell');
            return this.buildHandCardEl(c, interactive, i);
          }).join('')}
        </div>
      </div>

      <!-- Log bar -->
      <div class="log-bar">
        <div class="game-log" id="game-log">
          ${(gs.log || []).slice(-6).map(l => `<div class="game-log-entry">&gt; ${l}</div>`).join('')}
        </div>
      </div>

      ${gs.winner ? this.buildWinOverlay(gs.winner, myUid) : ''}
      ${this.botRunning && !this.waitingOnPlayer ? `<div class="bot-thinking">🤖 Bot thinking...</div>` : ''}

      ${this.buildStackPopup(gs, myUid)}
      ${this.buildRitualZonePopup(gs, myUid)}
      ${this.showGraveyard ? this.buildGraveyardPopup(gs) : ''}
      ${this.showNewAncient ? this.buildAncientChoicePopup() : ''}
      ${gs.pendingRitualTarget && gs.pendingRitualTarget.uid === myUid ? this.buildRitualTargetPopup(gs, myUid) : ''}
      ${gs.pendingDamageChoice && gs.currentTurn === myUid ? this.buildDamageChoiceModal(gs) : ''}
      ${this.showRitualModal ? this.buildRitualModal(gs, myUid) : ''}
      ${this.turnPopupVisible ? this.buildTurnPopup() : ''}
      ${this.showSettings ? this.buildSettingsModal() : ''}
      ${this.showBreakpointPicker ? this.buildBreakpointPickerPopup() : ''}
      ${this.breakpointHitPhase ? this.buildBreakpointHitPopup() : ''}
      ${this.gamePaused ? this.buildPauseOverlay() : ''}

      <!-- Player WP circle floating over field bottom-center -->
      <div class="my-wp-circle" style="--wp-color:${myWpColor}">
        <span class="wp-value" style="color:${myWpColor}">${ps.willPower}</span>
      </div>
    `;

    const log = this.container.querySelector('#game-log');
    if (log) log.scrollTop = log.scrollHeight;

    this.attachGameListeners();
    this.updateBlockLinesSVG();
    // Repaint the clock into the freshly-built DOM.
    this.updateTimerDisplay();
  }

  private buildInfoBar(gs: GameState, ps: PlayerGameState, opp: PlayerGameState, isMyTurn: boolean, myHasP: boolean, timerHtml: string): string {
    const phases = ['replenish', 'draw', 'play1', 'combat', 'play2', 'end'];
    const combatStepLabel = gs.phase === 'combat' ? ` [${gs.combatStep.toUpperCase()}]` : '';
    const priorityLabel = myHasP
      ? `<span class="priority-mine">⚡ YOUR PRIORITY</span>`
      : `<span class="priority-bot">⚡ BOT PRIORITY</span>`;
    const stopBtnLabel = this.phaseBreakpoint ? `🔴 STOP @ ${this.phaseBreakpoint.toUpperCase()}` : '⏸ SET STOP';
    const stopBtnClass = this.phaseBreakpoint ? 'btn-danger' : 'btn-gold';
    const turnBanner = isMyTurn
      ? `<span style="font-family:'Press Start 2P',monospace;font-size:11px;color:var(--green);background:rgba(0,255,65,0.1);padding:4px 10px;border:1px solid var(--green);letter-spacing:1px">⚔ YOUR TURN</span>`
      : `<span style="font-family:'Press Start 2P',monospace;font-size:11px;color:var(--red);background:rgba(255,45,85,0.1);padding:4px 10px;border:1px solid var(--red);letter-spacing:1px">🤖 BOT TURN</span>`;

    return `
      <div class="game-info-bar">
        <div class="player-stats">
          <span class="wp-label-opp">BOT</span>
          <span style="font-size:9px;color:var(--text-dim)">H:${opp.hand.length} D:${opp.deck.length}</span>
        </div>
        <div class="phase-col">
          <div class="phase-indicator">
            ${phases.map(p => `<span class="phase-step ${gs.phase === p ? 'active' : ''}">${p.slice(0, 4).toUpperCase()}</span>`).join('')}
            <span style="color:var(--text-dim);font-size:7px">${combatStepLabel}</span>
          </div>
          <div class="turn-info">
            ${turnBanner}
            ${priorityLabel}
            ${timerHtml}
            <button id="btn-stop-auto" class="${stopBtnClass}" style="font-size:7px;padding:2px 6px;margin-left:4px">${stopBtnLabel}</button>
          </div>
        </div>
        <div class="player-stats">
          <span style="font-size:9px;color:var(--text-dim)">H:${ps.hand.length} D:${ps.deck.length}</span>
          <span class="wp-label-player">YOU</span>
          <button id="btn-settings" class="btn-settings" title="Settings">⚙</button>
        </div>
      </div>
    `;
  }

  private buildActionBar(gs: GameState, isMyTurn: boolean, myHasP: boolean): string {
    if (!isMyTurn && !this.waitingOnPlayer) return '';
    // While bot is processing (and not waiting on the player), hide action buttons
    if (this.botRunning && !this.waitingOnPlayer) return '';

    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const leftBtns: string[] = [];
    const rightBtns: string[] = [];

    const waitKind = this.playerWait?.kind;
    if (this.waitingOnPlayer && waitKind !== 'blocks') {
      // Label the window the player is actually in, so "pass" is not ambiguous.
      // The blocks step is skipped here — it has its own Done Blocking button below.
      const label = waitKind === 'predamage'
        ? '⚡ Pass Priority (before damage)'
        : '⚡ Pass Priority';
      rightBtns.push(`<button id="btn-pass-priority" class="btn-gold pulse-anim">${label}</button>`);
    } else if (isMyTurn && myHasP) {
      if (gs.phase === 'combat' && gs.combatStep === 'attackers') {
        // Attack with All (left) — only if there are eligible attackers not already declared
        const eligible = ps.battlefield.filter(c => {
          const def = CARD_DEFS[c.defId];
          return def?.type === 'being' && (!c.exhausted || def.isFlyer) && !ps.attackers.includes(c.id) && !(def.id === 'wasp' && c.summonedThisTurn);
        });
        if (eligible.length > 0) {
          leftBtns.push(`<button id="btn-attack-all" class="btn-danger" style="font-size:11px;padding:8px 16px">⚔ Attack with All (${eligible.length})</button>`);
        }
        rightBtns.push(`<button id="btn-done-attackers" class="btn-danger" style="font-size:11px;padding:8px 16px">✅ Done Declaring Attackers</button>`);
      } else if (gs.phase === 'combat' && gs.combatStep === 'blocks') {
        // blocks is opponent's priority — nothing for active player
      } else if (gs.phase === 'combat' && gs.combatStep === 'pre-damage') {
        // Pre-damage priority: player can use ancients or pass before damage resolves
        rightBtns.push(`<button id="btn-pass-priority" class="btn-gold pulse-anim">⚡ Pass Priority (before damage)</button>`);
      } else if (gs.phase === 'combat' && gs.combatStep === 'pre') {
        rightBtns.push(`<button id="btn-next-phase" class="btn-green">▶ Enter Attackers Phase</button>`);
      } else if (gs.phase === 'combat' && gs.combatStep === 'none') {
        rightBtns.push(`<button id="btn-next-phase" class="btn-green">▶ Enter Combat</button>`);
      } else {
        // Pass Priority is always active when shown — every phase change gives each player
        // the opportunity to respond before the phase advances.
        leftBtns.push(`<button id="btn-rituals" class="btn-gold">🔮 Rituals</button>`);
        if (ps.yard.length >= 10) {
          leftBtns.push(`<button id="btn-last-breath" class="btn-danger">💀 Last Breath</button>`);
        }
        rightBtns.push(`<button id="btn-pass-priority" class="btn-gold">⚡ Pass Priority</button>`);
        rightBtns.push(`<button id="btn-next-phase" class="btn-green">▶ Next Phase</button>`);
        rightBtns.push(`<button id="btn-end-turn">⏩ End Turn</button>`);
      }
    }

    if (!isMyTurn && gs.phase === 'combat' && gs.combatStep === 'blocks') {
      const cls = waitKind === 'blocks' ? 'btn-green pulse-anim' : 'btn-green';
      rightBtns.push(`<button id="btn-done-blocks" class="${cls}">🛡 Done Blocking</button>`);
    }

    if (leftBtns.length === 0 && rightBtns.length === 0) return '';
    return `
      <div class="action-bar">
        <div class="action-bar-left">${leftBtns.join('')}</div>
        <div class="action-bar-right">${rightBtns.join('')}</div>
      </div>
    `;
  }

  private buildStackPopup(gs: GameState, myUid: string): string {
    // Only show the stack when there is one. It used to also appear whenever the bot
    // was waiting on the player, which during the blocking step rendered an "Empty"
    // stack with a Pass Priority button attached to it.
    if (gs.stack.length === 0) return '';

    const targetLabel = (target: string): string => {
      if (target === 'opponent') return 'ScapeBot';
      if (target === gs.player1 || target === gs.player2) {
        return target === myUid ? 'You' : 'ScapeBot';
      }
      for (const ps of [gs.p1State, gs.p2State]) {
        const card = ps.battlefield.find(c => c.id === target)
          ?? ps.hand.find(c => c.id === target);
        if (card) {
          const name = CARD_DEFS[card.defId]?.name ?? 'card';
          return ps.uid === myUid ? `your ${name}` : `bot's ${name}`;
        }
      }
      return 'target';
    };

    const stackItems = [...gs.stack].reverse().map((entry, i) => {
      const def = CARD_DEFS[entry.cardDefId];
      const isTop = i === 0;
      const emoji = def ? ({being:'🐉',landscape:'🌿',spell:'✨',ancient:'⭐'}[def.type] ?? '?') : '?';
      const imgTag = def?.imageUrl
        ? `<img src="${def.imageUrl}" alt="${def.name}" class="stack-card-img" onerror="this.style.display='none'" />`
        : `<div class="stack-card-img-placeholder">${emoji}</div>`;
      return `
        <div class="stack-entry ${isTop ? 'stack-top' : ''}">
          <div class="stack-entry-row">
            <div class="stack-card-preview">${imgTag}</div>
            <div class="stack-entry-info">
              <span class="stack-badge">${gs.stack.length - i}</span>
              <span>${def?.name ?? '?'} (${entry.playerId === myUid ? 'YOU' : 'BOT'})</span>
              ${entry.target ? `<span style="color:var(--text-dim);font-size:9px">→ ${targetLabel(entry.target)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const priorityInfo = gs.priorityPlayer === myUid
      ? `<div class="priority-banner-player">⚡ You have priority — respond or pass</div>`
      : `<div class="priority-banner-bot">⚡ Bot has priority</div>`;

    return `
      <div class="stack-popup">
        <div class="stack-title">📚 STACK</div>
        ${priorityInfo}
        <div class="stack-list">${stackItems}</div>
        ${gs.priorityPlayer === myUid ? `<button id="btn-pass-in-stack" class="btn-gold w-full mt-8">⚡ Pass Priority</button>` : ''}
      </div>
    `;
  }


  private buildRitualZonePopup(gs: GameState, myUid: string): string {
    const ps = getPlayerState(gs, myUid);
    if (ps.ritualZone.length === 0) return '';

    const partialRitualNames = getPartialRitualMatches(ps.ritualZone);
    const ritualForming = partialRitualNames.length > 0;

    const items = ps.ritualZone.map((c, i) => {
      const def = CARD_DEFS[c.defId];
      const emoji = { being: '🐉', landscape: '🌿', ancient: '⭐', spell: '✨' }[def?.type ?? ''] || '?';
      return `
        <div class="ritual-popup-entry">
          <span class="ritual-pos">${i + 1}</span>
          <span>${emoji} ${def?.name ?? '?'}</span>
        </div>
      `;
    }).join('');

    const hintHtml = ritualForming
      ? `<div style="font-size:8px;color:var(--gold);margin-top:4px;font-family:'Press Start 2P',monospace">${partialRitualNames.map(n => `✨ ${n}`).join('<br>')}</div>`
      : '';

    return `
      <div class="ritual-zone-popup ${ritualForming ? 'ritual-zone-popup-forming' : ''}">
        <div class="ritual-popup-title">🔮 RITUAL (${ps.ritualZone.length})</div>
        <div class="ritual-popup-list">${items}</div>
        ${hintHtml}
        <div style="font-size:7px;color:var(--text-dim);margin-top:4px">Right-click card to remove</div>
      </div>
    `;
  }

  private buildGraveyardPopup(gs: GameState): string {
    const isOpp = this.showGraveyard === 'opp';
    const ps = isOpp ? getOpponentState(gs, this.currentUser.uid) : getPlayerState(gs, this.currentUser.uid);
    const label = isOpp ? '🤖 Bot Graveyard' : 'My Graveyard';

    return `
      <div class="overlay" id="graveyard-overlay">
        <div class="modal" style="max-width:560px;width:90vw">
          <div class="modal-title">🪦 ${label} (${ps.yard.length} cards)</div>
          <div class="graveyard-grid">
            ${ps.yard.length === 0
              ? '<div style="color:var(--text-dim);font-size:11px">Empty graveyard</div>'
              : ps.yard.map(c => this.buildCardEl(c, false, false)).join('')
            }
          </div>
          <button id="btn-close-yard" class="btn-green w-full mt-8">Close</button>
        </div>
      </div>
    `;
  }

  private buildAncientChoicePopup(): string {
    return `
      <div class="overlay" id="ancient-choice-overlay">
        <div class="modal">
          <div class="modal-title" style="color:var(--gold)">🌱 Grow: Choose New Ancient</div>
          <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">A Landscape entered play. Choose your new Ancient:</p>
          <div class="ancient-choice-grid">
            ${ANCIENTS.map(defId => {
              const def = CARD_DEFS[defId];
              return `<button class="btn-ancient-choice" data-defid="${defId}">${def?.name}<br><span style="font-size:8px;color:var(--text-dim)">${def?.description}</span></button>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private buildEmptyAncient(): string {
    return `<div style="width:112px;height:158px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-dim);text-align:center">NO<br>ANCIENT</div>`;
  }

  private buildCardEl(card: CardInstance, interactive: boolean, isAncient: boolean, isAttacker = false, isOnStack = false, isBlockerSelected = false, isAssignedBlocker = false, draggableForRitual = false): string {
    const def = CARD_DEFS[card.defId];
    if (!def) return '';
    const emoji = { being: '🐉', landscape: '🌿', ancient: '⭐', spell: '✨' }[def.type] || '?';
    const typeClass = `card-${def.type}`;
    const exhaustedClass = card.exhausted ? 'exhausted' : '';
    const selectedClass = (this.selectedCard === card.id || isBlockerSelected) ? 'selected' : '';
    const attackerClass = isAttacker ? 'attacker' : '';
    const stackClass = isOnStack ? 'on-stack' : '';
    // Only Wasp has summoning sickness (cannot attack the turn it enters)
    const sickClass = (card.summonedThisTurn && def.id === 'wasp') ? 'summoning-sick' : '';
    const blockerClass = isAssignedBlocker ? 'blocker' : '';
    const dots = def.dots ? Array(def.dots).fill('<span class="dot"></span>').join('') : '';
    const isDraggable = draggableForRitual || (def.type === 'landscape' && interactive);

    const imgTag = def.imageUrl
      ? `<img src="${def.imageUrl}" alt="${def.name}" onerror="this.style.display='none'" />`
      : `<div class="card-image-placeholder">${emoji}</div>`;

    const statsRow = def.type === 'being'
      ? `<div class="card-stats"><span class="card-power">${def.power}</span><span class="card-toughness">${def.toughness}</span>${card.counters > 0 ? `<span style="color:var(--red);font-size:8px">-${card.counters}</span>` : ''}${(card.summonedThisTurn && def.id === 'wasp') ? `<span title="Cannot attack this turn" style="font-size:8px">😴</span>` : ''}</div>`
      : def.type === 'spell'
      ? `<div class="card-stats"><span class="card-cost">${def.cost}WP</span></div>`
      : def.type === 'landscape'
      ? ''
      : '';

    const w = isAncient ? 'width:112px;height:158px' : '';

    return `
      <div class="card ${typeClass} ${exhaustedClass} ${selectedClass} ${attackerClass} ${blockerClass} ${stackClass} ${sickClass} tooltip-container"
           data-id="${card.id}" data-def="${card.defId}"
           draggable="${isDraggable ? 'true' : 'false'}"
           style="${!interactive && !isDraggable ? 'cursor:default;' : ''}${w}"
           >
        <div class="card-dots">${dots}</div>
        <div class="card-image">${imgTag}</div>
        <div class="card-name">${def.name}</div>
        ${statsRow}
        ${isOnStack ? `<div class="stack-badge-small">STACK</div>` : ''}
        ${isBlockerSelected ? `<div class="block-select-indicator">🛡→</div>` : ''}
        <div class="tooltip">${def.name}<br><span style="color:var(--text-dim)">${def.description}</span></div>
      </div>
    `;
  }

  private buildHandCardEl(card: CardInstance, interactive: boolean, index: number): string {
    const def = CARD_DEFS[card.defId];
    if (!def) return '';
    const emoji = { being: '🐉', landscape: '🌿', ancient: '⭐', spell: '✨' }[def.type] || '?';
    const typeClass = `card-${def.type}`;
    const selectedClass = this.selectedCard === card.id ? 'selected' : '';
    const dots = def.dots ? Array(def.dots).fill('<span class="dot"></span>').join('') : '';

    const imgTag = def.imageUrl
      ? `<img src="${def.imageUrl}" alt="${def.name}" onerror="this.style.display='none'" />`
      : `<div class="card-image-placeholder">${emoji}</div>`;

    const statsRow = def.type === 'being'
      ? `<div class="card-stats"><span class="card-power">${def.power}</span><span class="card-toughness">${def.toughness}</span><span style="color:var(--green-dim);font-size:7px">🌿${def.cost}</span></div>`
      : def.type === 'spell'
      ? `<div class="card-stats"><span class="card-cost">${def.cost}WP</span></div>`
      : '';

    return `
      <div class="card ${typeClass} ${selectedClass} hand-card tooltip-container"
           data-id="${card.id}" data-def="${card.defId}" data-hand-index="${index}"
           draggable="${interactive ? 'true' : 'false'}"
           style="${!interactive ? 'cursor:default;' : ''}">
        <div class="card-dots">${dots}</div>
        <div class="card-image">${imgTag}</div>
        <div class="card-name">${def.name}</div>
        ${statsRow}
        <div class="tooltip">${def.name}<br><span style="color:var(--text-dim)">${def.description}</span></div>
      </div>
    `;
  }

  private getPhaseBackground(phase: GamePhase): string {
    const base = `${import.meta.env.BASE_URL}arena/`;
    const phaseColorMap: Record<string, string> = {
      replenish: 'Scape_Ground_lightblue.png',
      draw: 'Scape_Ground_blue.png',
      play1: 'Scape_Ground_green.png',
      combat: 'Scape_Ground_red.png',
      play2: 'Scape_Ground_green.png',
      end: 'Scape_Ground_yellow.png',
    };
    return base + (phaseColorMap[phase] || 'Scape_Ground_blue.png');
  }

  private buildWinOverlay(winnerUid: string, myUid: string): string {
    const won = winnerUid === myUid;
    let spMessage = '';

    if (won && !this.spAwarded) {
      const uid = this.currentUser.uid;
      const isGuest = uid.startsWith('guest_');
      const botWins = this.currentUser.botWins ?? 0;
      if (!isGuest && botWins < BOT_WIN_LIMIT) {
        this.spAwarded = true;
        const newBotWins = botWins + 1;
        // Standalone demo: update local state only (no Firebase)
        this.currentUser = { ...this.currentUser, botWins: newBotWins, sp: (this.currentUser.sp ?? 0) + BOT_SP_REWARD };
        const remaining = BOT_WIN_LIMIT - newBotWins;
        const winsLabel = remaining === 1 ? '1 rewarded win remaining' : `${remaining} rewarded wins remaining`;
        spMessage = `<div style="margin-bottom:12px;color:var(--gold);font-size:11px">+${BOT_SP_REWARD} SP earned! ${remaining > 0 ? `(${winsLabel})` : '(Bot SP limit reached)'}</div>`;
      } else if (!isGuest && botWins >= BOT_WIN_LIMIT) {
        spMessage = `<div style="margin-bottom:12px;font-size:10px;color:var(--text-dim)">No SP reward — bot win limit reached (${BOT_WIN_LIMIT}/${BOT_WIN_LIMIT})</div>`;
      }
    }

    const arenaBase = `${import.meta.env.BASE_URL}arena/`;
    const resultImg = won ? `${arenaBase}Winner.png` : `${arenaBase}Defeat.png`;

    return `
      <div class="overlay" id="win-overlay">
        <div class="modal" style="text-align:center">
          <img src="${resultImg}" alt="${won ? 'Victory' : 'Defeat'}" class="win-overlay-image" />
          <div class="modal-title" style="${won ? 'color:var(--gold)' : 'color:var(--red)'}">
            ${won ? '🏆 VICTORY!' : '💀 DEFEAT!'}
          </div>
          <p style="margin-bottom:8px;font-size:12px;color:var(--text-dim)">${won ? 'You defeated the bot!' : 'The bot won this time!'}</p>
          ${spMessage}
          <button id="btn-back-lobby" class="btn-green" style="width:100%">Return to Lobby</button>
        </div>
      </div>
    `;
  }

  private buildRitualTargetPopup(gs: GameState, myUid: string): string {
    const ritual = gs.pendingRitualTarget!;
    const opState = myUid === gs.player1 ? gs.p2State : gs.p1State;

    if (ritual.ritualName === 'Ignite Surge' || ritual.ritualName === 'Primal Ignite') {
      const boost = ritual.igniteBoost ?? 1;
      const dmg = 2 + boost;
      const opBeings = opState.battlefield
        .filter(c => CARD_DEFS[c.defId]?.type === 'being')
        .map(c => `<button class="btn-target" data-target="${c.id}">${CARD_DEFS[c.defId]?.name} (${CARD_DEFS[c.defId]?.power}/${CARD_DEFS[c.defId]?.toughness})</button>`)
        .join('');
      return `
        <div class="overlay" id="ritual-target-overlay">
          <div class="modal" style="text-align:center;max-width:320px">
            <div class="modal-title" style="color:var(--red)">🔥 ${ritual.ritualName}</div>
            <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Ritual Ignite deals ${dmg} damage. Choose a target.</p>
            <button class="btn-target" data-target="opponent" style="background:var(--red);border-color:var(--red);width:100%;margin-bottom:4px">🎯 ScapeBot</button>
            ${opBeings}
            <button id="btn-cancel-ritual-target" class="btn-danger" style="width:100%;margin-top:8px">Cancel</button>
          </div>
        </div>
      `;
    }

    if (ritual.ritualName === 'Flock Control') {
      const opBeings = opState.battlefield
        .filter(c => CARD_DEFS[c.defId]?.type === 'being')
        .map(c => `<button class="btn-target" data-target="${c.id}">${CARD_DEFS[c.defId]?.name} (${CARD_DEFS[c.defId]?.power}/${CARD_DEFS[c.defId]?.toughness})</button>`)
        .join('');
      return `
        <div class="overlay" id="ritual-target-overlay">
          <div class="modal" style="text-align:center;max-width:320px">
            <div class="modal-title" style="color:var(--cyan)">🦅 Flock Control</div>
            <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Choose an opponent being to gain control of. You also draw a card.</p>
            ${opBeings || '<div style="color:var(--text-dim);font-size:10px">No opponent beings</div>'}
            <button id="btn-cancel-ritual-target" class="btn-danger" style="width:100%;margin-top:8px">Cancel</button>
          </div>
        </div>
      `;
    }

    return '';
  }

  private buildDamageChoiceModal(gs: GameState): string {
    const attackerUid = gs.currentTurn;
    const atkPs = getPlayerState(gs, attackerUid);
    const defPs = getOpponentState(gs, attackerUid);

    const unblockedPowers: number[] = atkPs.attackers
      .filter(atkId => !Object.values(defPs.blockers).includes(atkId))
      .map(atkId => {
        const card = atkPs.battlefield.find(c => c.id === atkId);
        return card ? (CARD_DEFS[card.defId]?.power ?? 0) : 0;
      })
      .filter(p => p > 0);

    const additive = unblockedPowers.reduce((a, b) => a + b, 0);
    const multiplicative = unblockedPowers.reduce((a, b) => a * b, 1);

    return `
      <div class="overlay" id="damage-choice-overlay">
        <div class="modal" style="text-align:center;max-width:380px">
          <div class="modal-title" style="color:var(--red)">⚔ UNBLOCKED DAMAGE</div>
          <p style="font-size:10px;color:var(--text-dim);margin-bottom:4px">
            ${unblockedPowers.length} unblocked attacker(s). Choose how their damage is calculated:
          </p>
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:12px">
            Powers: [${unblockedPowers.join(', ')}]
          </div>
          <div style="display:flex;gap:8px">
            <button id="btn-damage-additive" class="btn-green" style="flex:1;padding:10px">
              <div style="font-family:'Press Start 2P',monospace;font-size:8px">➕ ADDITIVE</div>
              <div style="font-size:14px;font-weight:bold;margin-top:6px;color:var(--green)">${additive} dmg</div>
              <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${unblockedPowers.join(' + ')} = ${additive}</div>
            </button>
            <button id="btn-damage-multiplicative" class="btn-danger" style="flex:1;padding:10px">
              <div style="font-family:'Press Start 2P',monospace;font-size:8px">✖ MULTIPLICATIVE</div>
              <div style="font-size:14px;font-weight:bold;margin-top:6px;color:var(--red)">${multiplicative} dmg</div>
              <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${unblockedPowers.join(' × ')} = ${multiplicative}</div>
            </button>
          </div>
          <div style="font-size:8px;color:var(--text-dim);margin-top:8px">Timer will auto-select additive if you don't choose.</div>
        </div>
      </div>
    `;
  }


  private buildRitualModal(gs: GameState, myUid: string): string {
    const ps = getPlayerState(gs, myUid);
    const myBeingsInBf = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'being');
    const myLandscapesInBf = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');
    const yardBeings = ps.yard.filter(c => CARD_DEFS[c.defId]?.type === 'being');
    const yardSpells = ps.yard.filter(c => CARD_DEFS[c.defId]?.type === 'spell');
    const yardLandscapes = ps.yard.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');

    const canCultivate = yardBeings.length > 0 && myBeingsInBf.length > 0;
    const canStudy = yardSpells.length > 0 && (myBeingsInBf.length > 0 || myLandscapesInBf.length > 0);
    const canEvolve = myLandscapesInBf.length > 0 && ps.willPower > 0;
    const canNourish = myBeingsInBf.length > 0 && yardLandscapes.length > 0;
    const canSacAncient = !!ps.ancient && myLandscapesInBf.length >= 2;

    const ritualDescriptions = [
      { name: 'CULTIVATE', desc: 'Sacrifice beings (equal total power) → summon a being from yard (exhausted)', can: canCultivate, id: 'btn-ritual-cultivate' },
      { name: 'STUDY', desc: 'Sacrifice beings/landscapes (= spell cost) → cast spell from yard (you take 2x damage)', can: canStudy, id: 'btn-ritual-study' },
      { name: 'EVOLVE', desc: 'Spend WP ≤ landscape count → transform a landscape into a WP/WP-2 being', can: canEvolve, id: 'btn-ritual-evolve' },
      { name: 'NOURISH', desc: 'Sacrifice a being → return a landscape from yard to hand', can: canNourish, id: 'btn-ritual-nourish' },
      { name: 'SAC ANCIENT + 2 LANDS', desc: 'Sacrifice ancient + 2 landscapes → draw 3 cards, discard 1', can: canSacAncient, id: 'btn-ritual-sac-ancient' },
    ];

    const ritualButtons = ritualDescriptions.map(r => `
      <button id="${r.id}" class="btn-gold" style="text-align:left;padding:6px 8px;opacity:${r.can ? '1' : '0.4'}" ${r.can ? '' : 'disabled'}>
        <div style="font-size:9px;font-family:'Press Start 2P',monospace;color:var(--gold)">${r.name}</div>
        <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${r.desc}</div>
      </button>
    `).join('');

    const passiveRulesHtml = `
      <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
        <div style="font-size:8px;font-family:'Press Start 2P',monospace;color:var(--purple-bright);margin-bottom:6px">PASSIVE RITUALS</div>
        <div style="font-size:8px;color:var(--text-dim);line-height:1.6">
          <b style="color:var(--text)">FINAL BLOW</b>: Both at 0 WP → last stack card player wins<br>
          <b style="color:var(--text)">STACK WAR</b>: 5+ cards on stack → last player draws a card<br>
          <b style="color:var(--text)">LAST BREATH</b>: 10+ yard cards → exile yard, set WP to 1<br>
          <b style="color:var(--text)">STACK RITUALS</b>: cancel/cancel/spike, grow/cancel, ignite/ignite/grow, flyer/cancel/ignite, grow+grow (diff players), being5/spike/grow<br>
          <b style="color:var(--text)">ACTION RITUALS</b> (drag to ritual zone): 2 lands, 2 lands+merfolk+ignite, 2 lands+2 insect+ignite, 2 flyers, cancel (5+ yard)
        </div>
      </div>
    `;

    return `
      <div class="overlay" id="ritual-modal-overlay">
        <div class="modal" style="max-width:480px;width:90vw;overflow-y:auto;max-height:90vh">
          <div class="modal-title" style="color:var(--gold)">🔮 RITUALS</div>
          <p style="font-size:9px;color:var(--text-dim);margin-bottom:12px">Global rituals available during your play phase:</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${ritualButtons}
          </div>
          ${passiveRulesHtml}
          <button id="btn-close-ritual-modal" class="btn-green w-full mt-8">Close</button>
        </div>
      </div>
    `;
  }

  private buildSettingsModal(): string {
    const pauseLabel = this.gamePaused ? '▶ Resume Game' : '⏸ Pause Game';
    const pauseBtnClass = this.gamePaused ? 'btn-green' : 'btn-gold';
    const stats = this.willow.getStats();
    return `
      <div class="overlay" id="settings-overlay">
        <div class="modal" style="max-width:340px;text-align:center">
          <div class="modal-title" style="color:var(--cyan)">⚙ SETTINGS</div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
            <button id="btn-settings-pause" class="${pauseBtnClass}" style="width:100%;padding:10px;font-size:10px">${pauseLabel}</button>
            <button id="btn-settings-lobby" class="btn-green" style="width:100%;padding:10px;font-size:10px">🏠 Exit to Lobby<br><span style="font-size:8px;color:var(--text-dim)">(game stays active)</span></button>
            <button id="btn-settings-concede" class="btn-danger" style="width:100%;padding:10px;font-size:10px">🏳 Concede</button>
            <button id="btn-settings-bug" class="btn-gold" style="width:100%;padding:10px;font-size:10px">🐛 Report a Bug</button>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:10px">
            <div style="font-size:9px;color:var(--gold);font-family:'Press Start 2P',monospace;margin-bottom:8px">🌿 WILLOW AI</div>
            <div style="font-size:8px;color:var(--text-dim);line-height:1.8;text-align:left;padding:0 8px">
              Games: ${stats.gamesPlayed} &nbsp;|&nbsp; Win rate: ${stats.winRate}<br>
              Patterns: ${stats.patternsLearned} &nbsp;|&nbsp; Data: ${stats.modelSizeKB}KB<br>
              Exploration: ${stats.explorationRate}
            </div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button id="btn-willow-export" class="btn-gold" style="flex:1;padding:7px;font-size:8px">⬇ Export Model</button>
              <button id="btn-willow-import" class="btn-gold" style="flex:1;padding:7px;font-size:8px">⬆ Import Model</button>
            </div>
            <button id="btn-willow-reset" class="btn-danger" style="width:100%;padding:7px;font-size:8px;margin-top:6px">🗑 Reset Willow</button>
          </div>
          <button id="btn-settings-close" class="btn-green w-full">✕ Close</button>
        </div>
      </div>
    `;
  }

  private buildBreakpointPickerPopup(): string {
    const phases: Array<{ id: GamePhase; label: string; desc: string }> = [
      { id: 'replenish', label: 'REPLENISH', desc: 'Untap & refresh' },
      { id: 'draw', label: 'DRAW', desc: 'Draw a card' },
      { id: 'play1', label: 'PLAY 1', desc: 'Play cards before combat' },
      { id: 'combat', label: 'COMBAT', desc: 'Attack & block' },
      { id: 'play2', label: 'PLAY 2', desc: 'Play cards after combat' },
      { id: 'end', label: 'END', desc: 'End of turn' },
    ];
    const currentBp = this.phaseBreakpoint;
    return `
      <div class="overlay" id="breakpoint-picker-overlay">
        <div class="modal" style="max-width:340px;text-align:center">
          <div class="modal-title" style="color:var(--gold)">🔴 SET PHASE BREAKPOINT</div>
          <p style="font-size:9px;color:var(--text-dim);margin-bottom:12px;line-height:1.5">
            Choose a phase. When you reach it on your turn, the game will pause and notify you.
          </p>
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
            ${phases.map(p => {
              const isActive = currentBp === p.id;
              const cls = isActive ? 'btn-danger' : 'btn-gold';
              const mark = isActive ? ' ✓ ACTIVE' : '';
              return `<button class="bp-phase-btn ${cls}" data-phase="${p.id}" style="text-align:left;padding:7px 10px;opacity:1">
                <div style="font-size:9px;font-family:'Press Start 2P',monospace">${p.label}${mark}</div>
                <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${p.desc}</div>
              </button>`;
            }).join('')}
          </div>
          ${currentBp ? `<button id="btn-bp-clear" class="btn-danger w-full" style="margin-bottom:8px">✕ Clear Breakpoint</button>` : ''}
          <button id="btn-bp-close" class="btn-green w-full">Close</button>
        </div>
      </div>
    `;
  }

  private buildBreakpointHitPopup(): string {
    const phaseLabels: Record<string, string> = {
      replenish: 'REPLENISH', draw: 'DRAW', play1: 'PLAY 1',
      combat: 'COMBAT', play2: 'PLAY 2', end: 'END',
    };
    const label = phaseLabels[this.breakpointHitPhase ?? ''] ?? this.breakpointHitPhase ?? '';
    return `
      <div class="overlay breakpoint-hit-overlay" id="breakpoint-hit-overlay">
        <div class="modal" style="max-width:360px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🔴</div>
          <div class="modal-title" style="color:var(--gold)">PHASE BREAKPOINT</div>
          <p style="font-size:12px;color:var(--text);margin:12px 0;font-family:'Press Start 2P',monospace;letter-spacing:1px">${label}</p>
          <p style="font-size:9px;color:var(--text-dim);margin-bottom:16px">The game has paused at your breakpoint. Take your time.</p>
          <div style="display:flex;gap:8px">
            <button id="btn-bp-hit-continue" class="btn-green" style="flex:1;padding:10px">▶ Continue</button>
            <button id="btn-bp-hit-clear" class="btn-gold" style="flex:1;padding:10px">✕ Clear & Continue</button>
          </div>
        </div>
      </div>
    `;
  }

  private buildPauseOverlay(): string {
    return `
      <div class="overlay pause-overlay" id="pause-overlay">
        <div class="modal" style="max-width:320px;text-align:center">
          <div style="font-size:40px;margin-bottom:8px">⏸</div>
          <div class="modal-title" style="color:var(--cyan)">GAME PAUSED</div>
          <p style="font-size:9px;color:var(--text-dim);margin:12px 0">Resume the game or open settings.</p>
          <button id="btn-pause-resume" class="btn-green" style="width:100%;padding:10px;margin-bottom:8px">▶ Resume Game</button>
          <button id="btn-pause-settings" class="btn-gold" style="width:100%;padding:10px;margin-bottom:8px">⚙ Open Settings</button>
        </div>
      </div>
    `;
  }


  // ── Block Lines SVG ──────────────────────────────────────────────────────────

  private updateBlockLinesSVG(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;

    // Remove existing SVG
    this.container.querySelector('#block-svg')?.remove();

    if (gs.phase !== 'combat') return;

    const ps = getPlayerState(gs, myUid);
    const opp = getOpponentState(gs, myUid);

    const isPlayerBlockStep = gs.combatStep === 'blocks' && gs.currentTurn !== myUid;
    const botHasBlockers = Object.keys(opp.blockers).length > 0;

    // For player block step: need selected card, assignments, or bot blockers to show
    let playerHasBlockLines = false;
    if (isPlayerBlockStep) {
      const hasSelected = !!this.selectedCard && ps.battlefield.some(c => c.id === this.selectedCard);
      const hasAssigned = Object.keys(ps.blockers).length > 0;
      playerHasBlockLines = hasSelected || hasAssigned;
    }

    if (!playerHasBlockLines && !botHasBlockers) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'block-svg';
    svg.setAttribute('style', 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:150');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Helper to get center of a card element
    const getCenter = (cardId: string): { x: number; y: number } | null => {
      const el = this.container.querySelector<HTMLElement>(`[data-id="${cardId}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const BLOCK_COLOR = '#00ffff';
    const LINE_STROKE_WIDTH = '3';
    const DRAG_CIRCLE_RADIUS = '6';
    const ASSIGNED_CIRCLE_RADIUS = '8';

    const makeLine = (x1: number, y1: number, x2: number, y2: number, dash = '8,4'): SVGLineElement => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', BLOCK_COLOR);
      line.setAttribute('stroke-width', LINE_STROKE_WIDTH);
      line.setAttribute('stroke-linecap', 'round');
      if (dash) line.setAttribute('stroke-dasharray', dash);
      return line;
    };

    // Draw drag line from selected blocker to mouse cursor (player block step only)
    if (isPlayerBlockStep && this.selectedCard && ps.battlefield.some(c => c.id === this.selectedCard)) {
      const from = getCenter(this.selectedCard);
      if (from && this.blockDragPos) {
        svg.appendChild(makeLine(from.x, from.y, this.blockDragPos.x, this.blockDragPos.y, '6,4'));
        // Arrowhead circle at mouse
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(this.blockDragPos.x));
        circle.setAttribute('cy', String(this.blockDragPos.y));
        circle.setAttribute('r', DRAG_CIRCLE_RADIUS);
        circle.setAttribute('fill', BLOCK_COLOR);
        circle.setAttribute('opacity', '0.7');
        svg.appendChild(circle);
      }
    }

    // Draw committed block assignment lines (player)
    for (const [blockerId, attackerId] of Object.entries(ps.blockers)) {
      const from = getCenter(blockerId);
      const to = getCenter(attackerId);
      if (from && to) {
        svg.appendChild(makeLine(from.x, from.y, to.x, to.y, ''));
        // Target ring at attacker
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(to.x));
        circle.setAttribute('cy', String(to.y));
        circle.setAttribute('r', ASSIGNED_CIRCLE_RADIUS);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', BLOCK_COLOR);
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
      }
    }

    // Draw bot block assignment lines (solid orange)
    const BOT_BLOCK_COLOR = '#ff8c00';
    for (const [blockerId, attackerId] of Object.entries(opp.blockers)) {
      const from = getCenter(blockerId);
      const to = getCenter(attackerId);
      if (from && to) {
        const line = makeLine(from.x, from.y, to.x, to.y, '');
        line.setAttribute('stroke', BOT_BLOCK_COLOR);
        svg.appendChild(line);
        // Target ring at player's attacker
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(to.x));
        circle.setAttribute('cy', String(to.y));
        circle.setAttribute('r', ASSIGNED_CIRCLE_RADIUS);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', BOT_BLOCK_COLOR);
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
      }
    }

    this.container.appendChild(svg);
  }

  private attachGameListeners(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const isMyTurn = gs.currentTurn === myUid;
    const myHasP = gs.priorityPlayer === myUid;

    if (gs.winner) {
      this.container.querySelector('#btn-back-lobby')?.addEventListener('click', () => {
        this.onNav('lobby');
      });
      return;
    }

    // Win overlay back
    this.container.querySelector('#btn-back-lobby')?.addEventListener('click', () => {
      this.onNav('lobby');
    });

    // Settings button
    this.container.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.showSettings = true;
      this.render();
    });
    this.container.querySelector('#btn-settings-close')?.addEventListener('click', () => {
      this.showSettings = false;
      this.render();
    });
    this.container.querySelector('#settings-overlay')?.addEventListener('click', (e) => {
      if (e.target === this.container.querySelector('#settings-overlay')) {
        this.showSettings = false;
        this.render();
      }
    });
    this.container.querySelector('#btn-settings-lobby')?.addEventListener('click', () => {
      this.showSettings = false;
      this.onNav('lobby');
    });
    this.container.querySelector('#btn-settings-concede')?.addEventListener('click', () => {
      if (confirm('🏳 Concede this game? This will count as a loss.')) {
        this.showSettings = false;
        this.willow.onGameEnd(BOT_UID, BOT_UID);
        this.gameState = { ...this.gameState, winner: BOT_UID };
        this.render();
      }
    });
    this.container.querySelector('#btn-settings-pause')?.addEventListener('click', () => {
      this.gamePaused = !this.gamePaused;
      this.showSettings = false;
      if (this.gamePaused) {
        // The bot and stack loops park on `isHalted()`; stop every clock, including
        // an open priority window's, so nothing auto-passes while paused.
        this.clearPlayerInactivityTimer();
        this.haltPlayerWaitClock();
        this.clearPriorityCountdown();
      } else {
        this.resumeAfterHalt();
      }
      this.render();
    });
    this.container.querySelector('#btn-settings-bug')?.addEventListener('click', () => {
      this.showSettings = false;
      this.render();
      setTimeout(() => {
        const bugOverlay = document.createElement('div');
        bugOverlay.className = 'overlay';
        bugOverlay.id = 'bug-report-overlay';
        bugOverlay.innerHTML = `
          <div class="modal" style="max-width:380px;text-align:center">
            <div class="modal-title" style="color:var(--gold)">🐛 Report a Bug</div>
            <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px;line-height:1.6">To report a bug, please describe the issue and submit it via the GitHub Issues page or email the developer.</p>
            <p style="font-size:9px;color:var(--cyan);margin-bottom:16px">Include: what happened, what you expected, and any relevant game state details.</p>
            <button id="btn-bug-close" class="btn-green w-full">Close</button>
          </div>
        `;
        this.container.appendChild(bugOverlay);
        bugOverlay.querySelector('#btn-bug-close')?.addEventListener('click', () => bugOverlay.remove());
        bugOverlay.addEventListener('click', (e) => { if (e.target === bugOverlay) bugOverlay.remove(); });
      }, 0);
    });

    // Willow AI export
    this.container.querySelector('#btn-willow-export')?.addEventListener('click', () => {
      const json = this.willow.exportModel();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `willow-model-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Willow AI import
    this.container.querySelector('#btn-willow-import')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const success = this.willow.importModel(text);
          if (success) {
            alert('Willow model imported successfully!');
          } else {
            alert('Failed to import model. Invalid or incompatible file.');
          }
          this.showSettings = false;
          this.render();
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Willow AI reset
    this.container.querySelector('#btn-willow-reset')?.addEventListener('click', () => {
      if (confirm('Reset all Willow learning data? This cannot be undone.')) {
        this.willow.resetModel();
        this.showSettings = false;
        this.render();
      }
    });

    // Stop/auto button — open breakpoint picker popup
    this.container.querySelector('#btn-stop-auto')?.addEventListener('click', () => {
      this.showBreakpointPicker = true;
      this.render();
    });

    // Breakpoint picker popup listeners
    this.container.querySelectorAll<HTMLButtonElement>('.bp-phase-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const phase = btn.dataset.phase as GamePhase;
        this.phaseBreakpoint = phase;
        this.showBreakpointPicker = false;
        this.render();
      });
    });
    this.container.querySelector('#btn-bp-clear')?.addEventListener('click', () => {
      this.phaseBreakpoint = null;
      this.showBreakpointPicker = false;
      this.render();
      this.resumeAfterHalt();
    });
    this.container.querySelector('#btn-bp-close')?.addEventListener('click', () => {
      this.showBreakpointPicker = false;
      this.render();
    });
    this.container.querySelector('#breakpoint-picker-overlay')?.addEventListener('click', (e) => {
      if (e.target === this.container.querySelector('#breakpoint-picker-overlay')) {
        this.showBreakpointPicker = false;
        this.render();
      }
    });

    // Breakpoint hit popup listeners
    this.container.querySelector('#btn-bp-hit-continue')?.addEventListener('click', () => {
      this.breakpointHitPhase = null;
      this.render();
      this.resumeAfterHalt();
    });
    this.container.querySelector('#btn-bp-hit-clear')?.addEventListener('click', () => {
      this.breakpointHitPhase = null;
      this.phaseBreakpoint = null;
      this.render();
      this.resumeAfterHalt();
    });

    // Pause overlay — open settings
    this.container.querySelector('#btn-pause-settings')?.addEventListener('click', () => {
      this.showSettings = true;
      this.render();
    });

    // Pause overlay — resume game
    this.container.querySelector('#btn-pause-resume')?.addEventListener('click', () => {
      this.gamePaused = false;
      this.render();
    });

    // Phase/priority buttons
    this.container.querySelector('#btn-next-phase')?.addEventListener('click', () => {
      if (!isMyTurn || (this.botRunning && !this.waitingOnPlayer)) return;
      if (this.isHalted()) return;
      // With cards on the stack, advancing the phase used to call `advancePhase`,
      // which quietly resolves the whole stack — skipping the bot's response window.
      // Route it through the pass-priority flow instead.
      if (this.gameState.stack.length > 0) {
        this.handlePassPriority();
        return;
      }
      const next = advancePhase(this.gameState, myUid);
      if (next !== this.gameState) this.setState(next);
    });

    this.container.querySelector('#btn-end-turn')?.addEventListener('click', () => {
      if (!isMyTurn || (this.botRunning && !this.waitingOnPlayer)) return;
      if (this.isHalted()) return;
      const cur = this.gameState;
      // A live stack has to be settled by both players first — ending the turn is not
      // a way to skip the bot's response window. Pass priority; the player can end the
      // turn once the stack is empty.
      if (cur.stack.length > 0) {
        this.handlePassPriority();
        return;
      }
      // Jump to the end step and let advancePhase run the normal end-of-turn path,
      // which resets priority to the incoming player.
      const ended = advancePhase(
        resetPriority({ ...cur, phase: 'end', combatStep: 'none', pendingDamageChoice: undefined }, myUid),
        myUid
      );
      this.setState(ended);
    });

    this.container.querySelector('#btn-pass-priority')?.addEventListener('click', () => {
      if (this.botRunning && !this.waitingOnPlayer) return;
      this.handlePassPriority();
    });

    this.container.querySelector('#btn-pass-in-stack')?.addEventListener('click', () => {
      if (this.botRunning && !this.waitingOnPlayer) return;
      this.handlePassPriority();
    });

    this.container.querySelector('#btn-done-attackers')?.addEventListener('click', () => {
      if (!isMyTurn || (this.botRunning && !this.waitingOnPlayer)) return;
      const next = advancePhase(gs, myUid);
      this.setState(next);
    });

    // Attack with All — declare all eligible beings as attackers
    this.container.querySelector('#btn-attack-all')?.addEventListener('click', () => {
      if (!isMyTurn || (this.botRunning && !this.waitingOnPlayer)) return;
      let newGs = gs;
      const myPs = getPlayerState(newGs, myUid);
      for (const c of myPs.battlefield) {
        const def = CARD_DEFS[c.defId];
        if (def?.type === 'being' && (!c.exhausted || def.isFlyer) && !myPs.attackers.includes(c.id)) {
          newGs = declareAttacker(newGs, myUid, c.id);
        }
      }
      if (newGs !== gs) this.setState(newGs);
    });

    this.container.querySelector('#btn-done-blocks')?.addEventListener('click', () => {
      if (isMyTurn) return; // defender blocks
      // Signal the bot that the player is done declaring blockers
      if (this.isWaitingFor('blocks')) this.settlePlayerWait('passed');
    });

    // Graveyard buttons
    this.container.querySelector('#btn-my-yard')?.addEventListener('click', () => {
      this.showGraveyard = 'mine';
      this.render();
    });
    this.container.querySelector('#btn-opp-yard')?.addEventListener('click', () => {
      this.showGraveyard = 'opp';
      this.render();
    });
    this.container.querySelector('#btn-close-yard')?.addEventListener('click', () => {
      this.showGraveyard = null;
      this.render();
    });
    this.container.querySelector('#graveyard-overlay')?.addEventListener('click', (e) => {
      if (e.target === this.container.querySelector('#graveyard-overlay')) {
        this.showGraveyard = null;
        this.render();
      }
    });

    // Ancient choice (from Grow)
    this.container.querySelectorAll<HTMLButtonElement>('.btn-ancient-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const defId = btn.dataset.defid!;
        const newGs = selectAncient(this.gameState, myUid, defId);
        const psNew = getPlayerState(newGs, myUid);
        const psFixed = { ...psNew, needsNewAncient: false };
        const fixedGs = newGs.player1 === myUid
          ? { ...newGs, p1State: psFixed }
          : { ...newGs, p2State: psFixed };
        this.showNewAncient = false;
        this.setState(fixedGs);
      });
    });

    // Hand drag-and-drop
    this.attachHandDragDrop();

    // Hand card clicks
    this.container.querySelector('#hand-cards')?.querySelectorAll<HTMLElement>('.hand-card').forEach(el => {
      el.addEventListener('click', () => {
        // Only the priority holder may play cards
        if (!myHasP) return;
        // Non-turn players may only cast spells (instant speed)
        if (!isMyTurn && !this.isSpellInstant(el.dataset.def ?? '')) return;
        const cardId = el.dataset.id!;
        this.handleHandCardClick(gs, ps, cardId, myUid);
      });
    });

    // Being zone drop (play being)
    this.attachDropZone('#my-being-zone', 'being');
    // Landscape zone drop (play landscape)
    this.attachDropZone('#my-landscapes', 'landscape');

    // My being zone clicks (for attacking / blocking)
    this.container.querySelector('#my-being-zone')?.querySelectorAll<HTMLElement>('.card').forEach(el => {
      el.addEventListener('click', () => {
        const cardId = el.dataset.id!;
        this.handleBattlefieldBeingClick(gs, ps, cardId, myUid, true);
      });
    });

    // Opp being zone clicks (for blocking: click attacker after selecting blocker)
    this.container.querySelector('#opp-being-zone')?.querySelectorAll<HTMLElement>('.card').forEach(el => {
      el.addEventListener('click', () => {
        const cardId = el.dataset.id!;
        this.handleBattlefieldBeingClick(gs, ps, cardId, myUid, false);
      });
    });

    // Attack zone drop
    this.attachDropZone('#attack-zone', 'attack');

    // Landscape right-click to sacrifice, and dragstart for ritual zone
    this.container.querySelector('#my-landscapes')?.querySelectorAll<HTMLElement>('.card').forEach(el => {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const cardId = el.dataset.id!;
        const card = ps.battlefield.find(c => c.id === cardId);
        if (card && CARD_DEFS[card.defId]?.type === 'landscape') {
          const newState = sacrificeLandscape(gs, myUid, cardId);
          if (newState !== gs) this.setState(newState);
        }
      });
      el.addEventListener('dragstart', (e) => {
        this.dragCardId = el.dataset.id!;
        el.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', el.dataset.id!);
        }
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        this.container.querySelectorAll('.drag-over').forEach(z => z.classList.remove('drag-over'));
      });
    });

    // Ancient double-click (use) and right-click (sacrifice)
    this.container.querySelectorAll<HTMLElement>('.card[data-def]').forEach(el => {
      const defId = el.dataset.def!;
      const cardId = el.dataset.id!;
      const def = CARD_DEFS[defId];
      // Allow using the ancient whenever the player has priority (not just on their turn)
      if (def?.isAncient && myHasP && ps.ancient?.id === cardId && !ps.ancient?.exhausted) {
        el.addEventListener('dblclick', () => {
          const ancDef = CARD_DEFS[ps.ancient?.defId ?? ''];
          if (ancDef?.id === 'smoldering_volcano') {
            this.showAncientTargetPicker(gs, myUid);
          } else if (ancDef?.id === 'cavern_of_the_see') {
            this.showCavernOfSeaModal(gs, myUid);
          } else {
            const newState = useAncient(gs, myUid);
            if (newState !== gs) this.setState(newState);
          }
        });
      }
      // Right-click any ancient to sacrifice it (at any time)
      if (def?.isAncient && ps.ancient?.id === cardId) {
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (confirm('Sacrifice your Ancient? This cannot be undone.')) {
            const newState = sacrificeAncient(gs, myUid);
            if (newState !== gs) this.setState(newState);
          }
        });
      }
    });

    // Ritual zone drop
    this.attachDropZone('#ritual-zone', 'ritual');

    // Ritual zone card right-click to return to battlefield
    this.container.querySelector('#ritual-zone')?.querySelectorAll<HTMLElement>('.card').forEach(el => {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const cardId = el.dataset.id!;
        const newState = removeFromRitualZone(gs, myUid, cardId);
        if (newState !== gs) this.setState(newState);
      });
    });

    // Being zone: allow dragging beings to ritual zone
    this.container.querySelector('#my-being-zone')?.querySelectorAll<HTMLElement>('.card').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        this.dragCardId = el.dataset.id!;
        el.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', el.dataset.id!);
        }
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        this.container.querySelectorAll('.drag-over').forEach(z => z.classList.remove('drag-over'));
      });
    });

    // Ritual target popup buttons
    this.container.querySelector('#ritual-target-overlay')?.querySelectorAll<HTMLButtonElement>('.btn-target').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target!;
        const newState = resolveRitualTarget(this.gameState, myUid, target);
        if (newState !== this.gameState) this.setState(newState);
        else this.render();
      });
    });
    this.container.querySelector('#btn-cancel-ritual-target')?.addEventListener('click', () => {
      // Cancel the ritual target — just clear the pending and leave the cards in yard
      const cleared: GameState = { ...this.gameState, pendingRitualTarget: undefined };
      this.gameState = cleared;
      this.render();
    });

    // Unblocked damage choice modal buttons
    this.container.querySelector('#btn-damage-additive')?.addEventListener('click', () => {
      const newGs = chooseCombatDamageMode(this.gameState, myUid, 'additive');
      if (newGs !== this.gameState) this.setState(newGs);
    });
    this.container.querySelector('#btn-damage-multiplicative')?.addEventListener('click', () => {
      const newGs = chooseCombatDamageMode(this.gameState, myUid, 'multiplicative');
      if (newGs !== this.gameState) this.setState(newGs);
    });

    // Ritual modal open
    this.container.querySelector('#btn-rituals')?.addEventListener('click', () => {
      this.showRitualModal = true;
      this.render();
    });
    this.container.querySelector('#btn-close-ritual-modal')?.addEventListener('click', () => {
      this.showRitualModal = false;
      this.render();
    });
    this.container.querySelector('#ritual-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === this.container.querySelector('#ritual-modal-overlay')) {
        this.showRitualModal = false;
        this.render();
      }
    });

    // Last Breath
    this.container.querySelector('#btn-last-breath')?.addEventListener('click', () => {
      if (!isMyTurn || (this.botRunning && !this.waitingOnPlayer)) return;
      if (confirm('💀 LAST BREATH: Exile your entire yard and set WP to 1?')) {
        const newState = lastBreath(gs, myUid);
        if (newState !== gs) this.setState(newState);
      }
    });

    // Cultivate ritual button
    this.container.querySelector('#btn-ritual-cultivate')?.addEventListener('click', () => {
      this.showRitualModal = false;
      this.showCultivateModal();
    });

    // Study ritual button
    this.container.querySelector('#btn-ritual-study')?.addEventListener('click', () => {
      this.showRitualModal = false;
      this.showStudyModal();
    });

    // Evolve ritual button
    this.container.querySelector('#btn-ritual-evolve')?.addEventListener('click', () => {
      this.showRitualModal = false;
      this.showEvolveModal();
    });

    // Nourish ritual button
    this.container.querySelector('#btn-ritual-nourish')?.addEventListener('click', () => {
      this.showRitualModal = false;
      this.showNourishModal();
    });

    // Sac ancient + 2 landscapes button
    this.container.querySelector('#btn-ritual-sac-ancient')?.addEventListener('click', () => {
      this.showRitualModal = false;
      this.showSacAncientModal();
    });

    // Turn popup buttons
    this.container.querySelector('#btn-turn-popup-okay')?.addEventListener('click', () => {
      this.dismissTurnPopup();
    });
    this.container.querySelector('#btn-turn-popup-yield')?.addEventListener('click', () => {
      // Set a breakpoint at play1 so the game pauses at first play phase
      this.phaseBreakpoint = 'play1';
      this.dismissTurnPopup();
    });

    // Check if needsNewAncient is set for player
    if (ps.needsNewAncient && !this.showNewAncient) {
      this.showNewAncient = true;
      this.render();
    }
  }

  private isSpellInstant(defId: string): boolean {
    const def = CARD_DEFS[defId];
    return def?.type === 'spell';
  }

  private attachHandDragDrop(): void {
    const handCards = this.container.querySelector('#hand-cards');
    if (!handCards) return;

    handCards.querySelectorAll<HTMLElement>('.hand-card').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        this.dragCardId = el.dataset.id!;
        el.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', el.dataset.id!);
        }
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        this.dragCardId = null;
        // Clean up drag-over highlights
        this.container.querySelectorAll('.drag-over').forEach(z => z.classList.remove('drag-over'));
      });

      // Hand reordering
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (this.dragCardId && this.dragCardId !== el.dataset.id) {
          el.classList.add('drag-over-card');
        }
      });

      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over-card');
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over-card');
        const draggedId = this.dragCardId;
        const targetId = el.dataset.id!;
        if (!draggedId || draggedId === targetId) return;

        // Reorder hand
        const fromIdx = this.handOrder.indexOf(draggedId);
        const toIdx = this.handOrder.indexOf(targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const newOrder = [...this.handOrder];
          newOrder.splice(fromIdx, 1);
          newOrder.splice(toIdx, 0, draggedId);
          this.handOrder = newOrder;
          this.dragCardId = null;
          this.render();
        }
      });
    });
  }

  private attachDropZone(selector: string, dropType: string): void {
    const zone = this.container.querySelector<HTMLElement>(selector);
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
      const cardId = this.dragCardId ?? (e as DragEvent).dataTransfer?.getData('text/plain') ?? '';
      if (!cardId) return;
      this.handleCardDropToZone(cardId, dropType);
      this.dragCardId = null;
    });
  }

  private handleCardDropToZone(cardId: string, zone: string): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const isMyTurn = gs.currentTurn === myUid;
    const myHasP = gs.priorityPlayer === myUid;

    // Ritual zone: accept landscapes/beings from battlefield AND spells from hand
    // Only accept cards that are valid for at least one ritual sequence
    if (zone === 'ritual') {
      const bfCard = ps.battlefield.find(c => c.id === cardId);
      if (bfCard) {
        const cardType = CARD_DEFS[bfCard.defId]?.type;
        if (cardType === 'landscape' || cardType === 'being') {
          if (!isCardValidForRitualZone(gs, myUid, bfCard)) return;
          const next = addToRitualZone(gs, myUid, cardId);
          if (next !== gs) this.setState(next);
          return;
        }
      }
      // Spell from hand → add spell to ritual zone (if valid)
      const handCard = ps.hand.find(c => c.id === cardId);
      if (handCard && CARD_DEFS[handCard.defId]?.type === 'spell') {
        if (!isCardValidForRitualZone(gs, myUid, handCard)) return;
        const next = addSpellToRitualZone(gs, myUid, cardId);
        if (next !== gs) this.setState(next);
        return;
      }
    }

    // Attack zone: if a battlefield being is dragged here, declare it as attacker
    if (zone === 'attack' && gs.phase === 'combat' && gs.combatStep === 'attackers' && isMyTurn) {
      const bfCard = ps.battlefield.find(c => c.id === cardId);
      if (bfCard && CARD_DEFS[bfCard.defId]?.type === 'being') {
        const next = declareAttacker(gs, myUid, cardId);
        if (next !== gs) this.setState(next);
        return;
      }
    }

    const card = ps.hand.find(c => c.id === cardId);
    if (!card) return;
    const def = CARD_DEFS[card.defId];
    if (!def) return;

    // Only the priority holder may play cards from hand onto the stack
    if (!myHasP) return;
    // Non-turn players may only cast spells (instant speed)
    if (!isMyTurn && def.type !== 'spell') return;

    if (zone === 'landscape' && def.type === 'landscape') {
      const next = playCard(gs, myUid, cardId);
      if (next !== gs) this.setState(next);
    } else if (zone === 'being' && def.type === 'being') {
      if (card.defId === 'wasp') {
        this.showWaspPaymentModal(gs, myUid, cardId);
      } else {
        const next = playCard(gs, myUid, cardId);
        if (next !== gs) this.setState(next);
      }
    } else if (zone === 'attack' && def.type === 'being' && gs.phase === 'combat' && gs.combatStep === 'attackers') {
      // Play being from hand to attack zone
      if (card.defId === 'wasp') {
        this.showWaspPaymentModal(gs, myUid, cardId);
      } else {
        const afterPlay = playCard(gs, myUid, cardId);
        if (afterPlay !== gs) this.setState(afterPlay);
      }
    } else if (def.type === 'spell') {
      // Cast spell — show target picker if needed
      if (def.spellType === 'ignite' || def.spellType === 'spike') {
        this.showTargetPicker(gs, myUid, cardId);
      } else {
        const next = playCard(gs, myUid, cardId);
        if (next !== gs) this.setState(next);
      }
    }
  }

  /**
   * The player passing priority. There is exactly one rule here: record the pass in
   * the current window and let whoever is driving that window decide what happens
   * next. This used to hand-roll the pass tracker and, for pre-damage, drive the
   * combat gate off the overloaded `stackPassedOnce` flag.
   */
  private handlePassPriority(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    if (gs.winner) return;
    if (this.isHalted()) return;

    // A window is open and being awaited (stack response, blocks, or pre-damage) —
    // the driving loop records the pass and decides the outcome.
    if (this.playerWait) {
      this.settlePlayerWait('passed');
      return;
    }

    // Only the priority holder can pass.
    if (gs.priorityPlayer !== myUid) return;

    if (gs.stack.length > 0) {
      // No loop is running (e.g. the player passed the instant the stack appeared) —
      // record the pass and start the loop, which picks up from the recorded state.
      if (this.passPriorityFor(myUid)) {
        this.setState(resolveEntireStack(this.gameState));
      } else {
        void this.driveStackPriority();
      }
      return;
    }

    if (gs.currentTurn !== myUid) return;

    // Pre-damage is a two-pass window like any other: pass, let the bot pass, then
    // damage resolves.
    if (gs.combatStep === 'pre-damage') {
      if (this.passPriorityFor(myUid)) {
        const next = advancePhase(this.gameState, myUid);
        if (next !== this.gameState) this.setState(next);
      } else {
        this.botAutoPassPriority();
      }
      return;
    }

    // Empty stack outside combat: passing priority advances the phase.
    const next = advancePhase(gs, myUid);
    if (next !== gs) this.setState(next);
  }

  private handleHandCardClick(gs: GameState, ps: PlayerGameState, cardId: string, uid: string): void {
    const card = ps.hand.find(c => c.id === cardId);
    if (!card) return;
    const def = CARD_DEFS[card.defId];
    if (!def) return;

    if (this.selectedCard === cardId) {
      this.selectedCard = null;
      this.render();
      return;
    }

    if (def.type === 'spell' && (def.spellType === 'ignite' || def.spellType === 'spike')) {
      this.selectedCard = cardId;
      this.render();
      this.showTargetPicker(gs, uid, cardId);
      return;
    }

    // Wasp requires special payment popup
    if (def.type === 'being' && def.id === 'wasp') {
      this.selectedCard = null;
      this.showWaspPaymentModal(gs, uid, cardId);
      return;
    }

    this.selectedCard = null;
    const newState = playCard(gs, uid, cardId);
    if (newState !== gs) {
      // setState starts the shared stack-priority loop, which gives the bot its
      // response window and resolves only when both players have passed.
      this.setState(newState);
    }
  }

  private botTryRespond(): boolean {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const botPs = getPlayerState(gs, BOT_UID);

    // Staleness check: only respond if the bot actually has priority right now
    // and there is something on the stack from the player
    if (gs.priorityPlayer !== BOT_UID || gs.stack.length === 0) return false;

    const topEntry = gs.stack[gs.stack.length - 1];
    const topDef = CARD_DEFS[topEntry.cardDefId];
    // Only respond to the player's spells (not the bot's own)
    if (topEntry.playerId !== myUid) return false;

    // Ask Willow whether to counter
    const { action } = this.willow.shouldCounter(gs, BOT_UID);
    if (action === 'respond_cancel' && topDef?.type !== 'being') {
      const cancelCard = botPs.hand.find(c => CARD_DEFS[c.defId]?.spellType === 'cancel');
      if (cancelCard && botPs.willPower >= (CARD_DEFS[cancelCard.defId]?.cost ?? 0)) {
        const next = playCard(gs, BOT_UID, cancelCard.id);
        if (next !== gs) {
          this.willow.recordBotAction(gs, BOT_UID, 'respond_cancel', 0.2);
          // The bot's response opened a fresh window (playCard resets the pass order)
          // and `playCard` already handed priority to the player, so the stack loop
          // picks straight up with the player's response window. No extra timer.
          this.commit(next);
          return true;
        }
      }
    }
    this.willow.recordBotAction(gs, BOT_UID, 'respond_pass');
    return false;
  }

  private handleBattlefieldBeingClick(gs: GameState, _ps: PlayerGameState, cardId: string, uid: string, isMyCard: boolean): void {
    if (gs.phase !== 'combat') return;
    const isMyTurn = gs.currentTurn === uid;

    if (isMyCard && gs.combatStep === 'attackers' && isMyTurn) {
      const newState = declareAttacker(gs, uid, cardId);
      if (newState !== gs) this.setState(newState);
    } else if (!isMyCard && gs.combatStep === 'blocks' && !isMyTurn) {
      // Player clicked an opponent attacker: assign selected blocker to it
      if (this.selectedCard) {
        const newState = declareBlocker(gs, uid, this.selectedCard, cardId);
        if (newState !== gs) {
          this.selectedCard = null;
          this.setState(newState);
        } else {
          // Assignment failed; just deselect
          this.selectedCard = null;
          this.updateBlockLinesSVG();
          this.render();
        }
      }
    } else if (isMyCard && gs.combatStep === 'blocks' && !isMyTurn) {
      // Select / deselect a blocker — toggle if re-clicked
      this.selectedCard = this.selectedCard === cardId ? null : cardId;
      this.updateBlockLinesSVG();
      this.render();
    }
  }

  private showTargetPicker(gs: GameState, uid: string, cardId: string): void {
    const opState = uid === gs.player1 ? gs.p2State : gs.p1State;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'target-overlay';

    const opBeings = opState.battlefield
      .filter(c => CARD_DEFS[c.defId]?.type === 'being')
      .map(c => `<button class="btn-target" data-target="${c.id}">${CARD_DEFS[c.defId]?.name ?? c.defId} (${CARD_DEFS[c.defId]?.power}/${CARD_DEFS[c.defId]?.toughness})</button>`)
      .join('');

    overlay.innerHTML = `
      <div class="modal" style="text-align:center;max-width:320px">
        <div class="modal-title" style="color:var(--green)">⚡ Choose a Target</div>
        <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Click a target or cancel.</p>
        <div style="margin-bottom:8px">
          <button class="btn-target" data-target="opponent" style="background:var(--red);border-color:var(--red);width:100%;margin-bottom:4px">🎯 ScapeBot</button>
          ${opBeings}
        </div>
        <button id="btn-cancel-target" class="btn-danger" style="width:100%;margin-top:8px">Cancel</button>
      </div>
    `;

    this.container.appendChild(overlay);

    overlay.querySelectorAll<HTMLButtonElement>('.btn-target').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target ?? '';
        overlay.remove();
        this.selectedCard = null;
        // Play from the CURRENT state, not the snapshot captured when this modal
        // opened. Using the snapshot discarded anything that happened while the
        // modal was up (a bot response, a phase advance) and rolled the game back.
        // `playCard` now also refuses the play outright if priority has moved on.
        const current = this.gameState;
        const newState = playCard(current, uid, cardId, target);
        if (newState !== current) {
          this.setState(newState);
        } else {
          this.commit(addScreenLog(current, 'That play is no longer legal — priority moved on.'));
        }
      });
    });

    overlay.querySelector<HTMLButtonElement>('#btn-cancel-target')?.addEventListener('click', () => {
      overlay.remove();
      this.selectedCard = null;
      this.render();
    });
  }

  private showAncientTargetPicker(gs: GameState, uid: string): void {
    const opState = uid === gs.player1 ? gs.p2State : gs.p1State;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const opBeings = opState.battlefield
      .filter(c => CARD_DEFS[c.defId]?.type === 'being')
      .map(c => `<button class="btn-target" data-target="${c.id}">${CARD_DEFS[c.defId]?.name}</button>`)
      .join('');

    overlay.innerHTML = `
      <div class="modal" style="text-align:center;max-width:320px">
        <div class="modal-title" style="color:var(--red)">🌋 Smoldering Volcano</div>
        <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Deal 3 damage to any target.</p>
        <button class="btn-target" data-target="opponent" style="background:var(--red);border-color:var(--red);width:100%;margin-bottom:4px">🎯 ScapeBot</button>
        ${opBeings}
        <button id="btn-cancel-anc" style="width:100%;margin-top:8px">Cancel</button>
      </div>
    `;

    this.container.appendChild(overlay);

    overlay.querySelectorAll<HTMLButtonElement>('.btn-target').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        overlay.remove();
        // Use the live state — see showTargetPicker.
        const current = this.gameState;
        const newState = useAncient(current, uid, target);
        if (newState !== current) this.setState(newState);
      });
    });

    overlay.querySelector('#btn-cancel-anc')?.addEventListener('click', () => overlay.remove());
  }

  // ── Cavern of the Sea Modal ───────────────────────────────────────────────────

  private showCavernOfSeaModal(gs: GameState, uid: string): void {
    const oppPs = uid === gs.player1 ? gs.p2State : gs.p1State;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'cavern-overlay';

    const cardOptions = oppPs.hand.map(c => {
      const d = CARD_DEFS[c.defId];
      if (!d) return '';
      const emoji = { being: '🐉', landscape: '🌿', ancient: '⭐', spell: '✨' }[d.type] || '?';
      const statsText = d.type === 'being' ? ` (${d.power}/${d.toughness})` : d.type === 'spell' ? ` (${d.cost}WP)` : '';
      return `<button class="btn-target cavern-card-btn" data-id="${c.id}" style="margin-bottom:5px;text-align:left;padding:7px 12px">
        <span style="font-size:12px">${emoji}</span>
        <span style="font-size:10px;margin-left:6px">${d.name}${statsText}</span>
        <span style="font-size:8px;color:var(--text-dim);display:block;margin-top:2px;padding-left:20px">${d.description}</span>
      </button>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:380px;width:90vw">
        <div class="modal-title" style="color:var(--cyan)">🔮 Cavern of the See</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:12px">Opponent's hand (${oppPs.hand.length} cards). Select one card to recycle back into their deck.</p>
        <div style="display:flex;flex-direction:column;gap:2px;max-height:320px;overflow-y:auto;margin-bottom:10px">
          ${oppPs.hand.length === 0
            ? '<div style="color:var(--text-dim);font-size:10px;text-align:center;padding:12px">Opponent\'s hand is empty</div>'
            : cardOptions}
        </div>
        ${oppPs.hand.length === 0 ? `<button id="btn-cavern-use-empty" class="btn-green w-full">Use Without Effect</button>` : ''}
        <button id="btn-cavern-cancel" class="btn-danger w-full mt-8">Cancel</button>
      </div>
    `;

    this.container.appendChild(overlay);

    overlay.querySelectorAll<HTMLButtonElement>('.cavern-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetCardId = btn.dataset.id!;
        overlay.remove();
        const newState = useAncient(this.gameState, uid, targetCardId);
        if (newState !== this.gameState) this.setState(newState);
      });
    });

    overlay.querySelector('#btn-cavern-use-empty')?.addEventListener('click', () => {
      overlay.remove();
      const newState = useAncient(this.gameState, uid);
      if (newState !== this.gameState) this.setState(newState);
    });

    overlay.querySelector('#btn-cavern-cancel')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ── Wasp Payment Modal ───────────────────────────────────────────────────────

  private showWaspPaymentModal(gs: GameState, uid: string, cardId: string): void {
    const ps = getPlayerState(gs, uid);
    const unexhaustedLandscapes = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape' && !c.exhausted);
    // ps.hand includes the wasp itself; player needs at least 1 other card to discard
    const canPayA = unexhaustedLandscapes.length >= 2 && ps.hand.length >= 2;
    const canPayB = unexhaustedLandscapes.length >= 3;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'wasp-payment-overlay';

    overlay.innerHTML = `
      <div class="modal" style="text-align:center;max-width:340px;width:90vw">
        <div class="modal-title" style="color:var(--gold)">🐝 Play Wasp (2/3 Flyer)</div>
        <p style="font-size:10px;color:var(--text-dim);margin-bottom:14px">Choose how to summon the Wasp:</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="btn-wasp-discard" class="btn-green" style="text-align:left;padding:8px;opacity:${canPayA ? '1' : '0.4'}" ${canPayA ? '' : 'disabled'}>
            <div style="font-size:9px;font-family:'Press Start 2P',monospace;color:var(--green)">OPTION A</div>
            <div style="font-size:8px;color:var(--text-dim);margin-top:2px">Exhaust 2 Landscapes + discard a card</div>
          </button>
          <button id="btn-wasp-extra" class="btn-gold" style="text-align:left;padding:8px;opacity:${canPayB ? '1' : '0.4'}" ${canPayB ? '' : 'disabled'}>
            <div style="font-size:9px;font-family:'Press Start 2P',monospace;color:var(--gold)">OPTION B</div>
            <div style="font-size:8px;color:var(--text-dim);margin-top:2px">Exhaust 3 Landscapes</div>
          </button>
          <button id="btn-wasp-cancel" class="btn-danger" style="width:100%;margin-top:4px">Cancel</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelector('#btn-wasp-discard')?.addEventListener('click', () => {
      if (!canPayA) return;
      overlay.remove();
      // Show discard selector FIRST; the wasp is only played after a card is chosen.
      // This prevents the discard modal from being removed by bot-response re-renders.
      this.showWaspDiscardThenPlay(gs, uid, cardId);
    });

    overlay.querySelector('#btn-wasp-extra')?.addEventListener('click', () => {
      if (!canPayB) return;
      overlay.remove();
      // Pay with 3 lands (1 extra)
      const newState = playCard(this.gameState, uid, cardId, undefined, 1);
      if (newState !== this.gameState) this.setState(newState);
    });

    overlay.querySelector('#btn-wasp-cancel')?.addEventListener('click', () => overlay.remove());
  }

  // Show discard selector; after a card is chosen, discard it and THEN play the wasp.
  private showWaspDiscardThenPlay(gs: GameState, uid: string, waspCardId: string): void {
    const ps = getPlayerState(gs, uid);
    // Show all hand cards except the wasp itself as discard candidates
    const discardableCards = ps.hand.filter(c => c.id !== waspCardId);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'wasp-discard-overlay';

    const cardOptions = discardableCards
      .map(c => {
        const d = CARD_DEFS[c.defId];
        if (!d) return '';
        const emoji = { being: '🐉', landscape: '🌿', ancient: '⭐', spell: '✨' }[d.type] || '?';
        const statsText = d.type === 'being' ? ` (${d.power}/${d.toughness})` : d.type === 'spell' ? ` (${d.cost}WP)` : '';
        return `<button class="btn-target wasp-discard-btn" data-id="${c.id}" style="margin-bottom:4px;text-align:left;padding:7px 12px">
          <span style="font-size:12px">${emoji}</span>
          <span style="font-size:10px;margin-left:6px">${d.name}${statsText}</span>
        </button>`;
      })
      .filter(html => html)
      .join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:320px;width:90vw;text-align:center">
        <div class="modal-title" style="color:var(--gold)">🗑 DISCARD A CARD (Wasp Cost)</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Choose 1 card to discard as part of the Wasp's alternate cost.</p>
        <div style="display:flex;flex-direction:column;gap:2px;max-height:280px;overflow-y:auto;margin-bottom:8px">
          ${cardOptions || '<div style="color:var(--text-dim);font-size:10px">No cards to discard</div>'}
        </div>
        <button id="btn-wasp-discard-cancel" class="btn-danger w-full mt-8">Cancel</button>
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelectorAll<HTMLButtonElement>('.wasp-discard-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const discardId = btn.dataset.id!;
        overlay.remove();

        // Discard from the CURRENT state, then play the wasp from the result. This
        // used to derive from the snapshot taken when the modal opened, which threw
        // away anything that happened in the meantime.
        let discardedGs = this.gameState;
        const snapPs = getPlayerState(discardedGs, uid);
        const idx = snapPs.hand.findIndex(c => c.id === discardId);
        if (idx !== -1) {
          const newHand = [...snapPs.hand];
          const discarded = newHand.splice(idx, 1)[0];
          const newYard = [...snapPs.yard, discarded];
          discardedGs = discardedGs.player1 === uid
            ? { ...discardedGs, p1State: { ...snapPs, hand: newHand, yard: newYard } }
            : { ...discardedGs, p2State: { ...snapPs, hand: newHand, yard: newYard } };
        }

        // Now play the wasp (normal 2-land cost) from the discarded state
        const newState = playCard(discardedGs, uid, waspCardId);
        if (newState !== discardedGs) this.setState(newState);
      });
    });

    overlay.querySelector('#btn-wasp-discard-cancel')?.addEventListener('click', () => overlay.remove());
  }

  // ── Global Ritual Modals ─────────────────────────────────────────────────────

  private showCultivateModal(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const yardBeings = ps.yard.filter(c => CARD_DEFS[c.defId]?.type === 'being');
    const bfBeings = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'being');

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'cultivate-overlay';

    const yardOptions = yardBeings.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<option value="${c.id}">${d?.name} (${d?.power}/${d?.toughness}) — costs ${d?.power} power to summon</option>`;
    }).join('');

    const bfOptions = bfBeings.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<label style="display:flex;gap:6px;align-items:center;font-size:10px;margin-bottom:4px"><input type="checkbox" class="sac-being-cb" value="${c.id}"> ${d?.name} (${d?.power}/${d?.toughness})</label>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;width:90vw">
        <div class="modal-title" style="color:var(--green)">🌱 CULTIVATE</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Sacrifice beings with total power equal to a yard being's power to summon it exhausted.</p>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Choose yard being to summon:</div>
          <select id="cultivate-yard-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${yardOptions}</select>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Check beings to sacrifice (total power must match):</div>
          <div>${bfOptions}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-cultivate-confirm" class="btn-green" style="flex:1">Summon</button>
          <button id="btn-cultivate-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelector('#btn-cultivate-confirm')?.addEventListener('click', () => {
      const yardId = (overlay.querySelector<HTMLSelectElement>('#cultivate-yard-select'))?.value ?? '';
      const sacIds = Array.from(overlay.querySelectorAll<HTMLInputElement>('.sac-being-cb:checked')).map(cb => cb.value);
      const newState = cultivate(this.gameState, myUid, yardId, sacIds);
      overlay.remove();
      if (newState !== this.gameState) this.setState(newState);
    });
    overlay.querySelector('#btn-cultivate-cancel')?.addEventListener('click', () => overlay.remove());
  }

  private showStudyModal(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const yardSpells = ps.yard.filter(c => CARD_DEFS[c.defId]?.type === 'spell');
    const bfCards = ps.battlefield.filter(c => {
      const t = CARD_DEFS[c.defId]?.type;
      return t === 'being' || t === 'landscape';
    });

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'study-overlay';

    const spellOptions = yardSpells.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<option value="${c.id}">${d?.name} (cost:${d?.cost}) — sacrifice ${d?.cost} beings/lands</option>`;
    }).join('');

    const bfOptions = bfCards.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<label style="display:flex;gap:6px;align-items:center;font-size:10px;margin-bottom:4px"><input type="checkbox" class="sac-card-cb" value="${c.id}"> [${d?.type}] ${d?.name}</label>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:420px;width:90vw">
        <div class="modal-title" style="color:var(--purple-bright)">📚 STUDY</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Cast a spell from your yard. Sacrifice beings/landscapes equal to its cost. You take 2x damage.</p>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Choose spell to cast:</div>
          <select id="study-spell-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${spellOptions}</select>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Check to sacrifice (need: equal to spell cost):</div>
          <div>${bfOptions}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-study-confirm" class="btn-green" style="flex:1">Cast</button>
          <button id="btn-study-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelector('#btn-study-confirm')?.addEventListener('click', () => {
      const spellId = (overlay.querySelector<HTMLSelectElement>('#study-spell-select'))?.value ?? '';
      const sacIds = Array.from(overlay.querySelectorAll<HTMLInputElement>('.sac-card-cb:checked')).map(cb => cb.value);
      // For spells that need a target, we'll pass undefined and let user pick later
      const newState = study(this.gameState, myUid, spellId, sacIds);
      overlay.remove();
      if (newState !== this.gameState) this.setState(newState);
    });
    overlay.querySelector('#btn-study-cancel')?.addEventListener('click', () => overlay.remove());
  }

  private showEvolveModal(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const landscapes = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');
    const maxWP = Math.min(landscapes.length, ps.willPower);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'evolve-overlay';

    const landOptions = landscapes.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<option value="${c.id}">${d?.name}</option>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:380px;width:90vw">
        <div class="modal-title" style="color:var(--cyan)">🌀 EVOLVE</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Spend WP (≤ landscape count: ${landscapes.length}) to transform a landscape into a WP/WP-2 being.</p>
        <div style="margin-bottom:8px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">WP to spend (1–${maxWP}):</div>
          <input id="evolve-wp-input" type="number" min="1" max="${maxWP}" value="1" style="width:80px;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:12px">
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Choose landscape to transform:</div>
          <select id="evolve-land-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${landOptions}</select>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-evolve-confirm" class="btn-green" style="flex:1">Evolve</button>
          <button id="btn-evolve-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelector('#btn-evolve-confirm')?.addEventListener('click', () => {
      const wp = parseInt((overlay.querySelector<HTMLInputElement>('#evolve-wp-input'))?.value ?? '1', 10);
      const landId = (overlay.querySelector<HTMLSelectElement>('#evolve-land-select'))?.value ?? '';
      const newState = evolve(this.gameState, myUid, wp, landId);
      overlay.remove();
      if (newState !== this.gameState) this.setState(newState);
    });
    overlay.querySelector('#btn-evolve-cancel')?.addEventListener('click', () => overlay.remove());
  }

  private showNourishModal(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const bfBeings = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'being');
    const yardLandscapes = ps.yard.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'nourish-overlay';

    const beingOptions = bfBeings.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<option value="${c.id}">${d?.name} (${d?.power}/${d?.toughness})</option>`;
    }).join('');

    const landOptions = yardLandscapes.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<option value="${c.id}">${d?.name}</option>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:360px;width:90vw">
        <div class="modal-title" style="color:var(--green)">🌿 NOURISH</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Sacrifice a being to return a landscape from your yard to hand.</p>
        <div style="margin-bottom:8px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Sacrifice being:</div>
          <select id="nourish-being-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${beingOptions}</select>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Return landscape from yard:</div>
          <select id="nourish-land-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${landOptions}</select>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-nourish-confirm" class="btn-green" style="flex:1">Nourish</button>
          <button id="btn-nourish-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelector('#btn-nourish-confirm')?.addEventListener('click', () => {
      const beingId = (overlay.querySelector<HTMLSelectElement>('#nourish-being-select'))?.value ?? '';
      const landId = (overlay.querySelector<HTMLSelectElement>('#nourish-land-select'))?.value ?? '';
      const newState = nourish(this.gameState, myUid, beingId, landId);
      overlay.remove();
      if (newState !== this.gameState) this.setState(newState);
    });
    overlay.querySelector('#btn-nourish-cancel')?.addEventListener('click', () => overlay.remove());
  }

  private showSacAncientModal(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);
    const landscapes = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'sac-ancient-overlay';

    const landOptions = landscapes.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<label style="display:flex;gap:6px;align-items:center;font-size:10px;margin-bottom:4px"><input type="checkbox" class="sac-land-cb" value="${c.id}"> ${d?.name}</label>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:360px;width:90vw">
        <div class="modal-title" style="color:var(--gold)">⭐ SAC ANCIENT + 2 LANDSCAPES</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Sacrifice your Ancient and 2 Landscapes → draw 3 cards, discard 1.</p>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Check exactly 2 landscapes to sacrifice:</div>
          <div>${landOptions}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-sac-ancient-confirm" class="btn-gold" style="flex:1">Sacrifice</button>
          <button id="btn-sac-ancient-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelector('#btn-sac-ancient-confirm')?.addEventListener('click', () => {
      const landIds = Array.from(overlay.querySelectorAll<HTMLInputElement>('.sac-land-cb:checked')).map(cb => cb.value);
      if (landIds.length !== 2) { alert('Select exactly 2 landscapes.'); return; }
      const newState = sacAncientAndLandscapes(this.gameState, myUid, landIds);
      overlay.remove();
      if (newState !== this.gameState) {
        this.setState(newState);
        // Show discard modal after drawing
        this.later(() => this.showDiscardModal(), 400);
      }
    });
    overlay.querySelector('#btn-sac-ancient-cancel')?.addEventListener('click', () => overlay.remove());
  }

  private showDiscardModal(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const ps = getPlayerState(gs, myUid);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'discard-overlay';

    const cardOptions = ps.hand.map(c => {
      const d = CARD_DEFS[c.defId];
      return `<button class="btn-target discard-card-btn" data-id="${c.id}" style="margin-bottom:4px">[${d?.type}] ${d?.name}</button>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:320px;width:90vw;text-align:center">
        <div class="modal-title" style="color:var(--gold)">🗑 DISCARD A CARD</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Choose 1 card from your hand to discard.</p>
        ${cardOptions}
      </div>
    `;
    this.container.appendChild(overlay);

    overlay.querySelectorAll<HTMLButtonElement>('.discard-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cardId = btn.dataset.id!;
        const curPs = getPlayerState(this.gameState, myUid);
        const idx = curPs.hand.findIndex(c => c.id === cardId);
        if (idx !== -1) {
          const newHand = [...curPs.hand];
          const discarded = newHand.splice(idx, 1)[0];
          const newYard = [...curPs.yard, discarded];
          const newGs = this.gameState.player1 === myUid
            ? { ...this.gameState, p1State: { ...curPs, hand: newHand, yard: newYard } }
            : { ...this.gameState, p2State: { ...curPs, hand: newHand, yard: newYard } };
          overlay.remove();
          this.setState(newGs);
        }
      });
    });
  }

  destroy(): void {
    // Stop every loop before tearing timers down: `isHalted()` parks the bot and
    // stack loops, and settling the wait releases anything awaiting the player.
    this.destroyed = true;
    this.settlePlayerWait('acted');
    if (this.ritualPopupTimerId !== null) clearTimeout(this.ritualPopupTimerId);
    if (this.turnPopupTimerId !== null) clearTimeout(this.turnPopupTimerId);
    if (this.botSanityTimerId !== null) {
      clearInterval(this.botSanityTimerId);
      this.botSanityTimerId = null;
    }
    this.clearPlayerInactivityTimer();
    this.clearPriorityCountdown();
    // Every tracked setTimeout, including the ones that used to be fire-and-forget.
    this.clearAllTimeouts();
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.spacebarHandler) {
      document.removeEventListener('keydown', this.spacebarHandler);
      this.spacebarHandler = null;
    }
  }
}

export { BOT_USER };
