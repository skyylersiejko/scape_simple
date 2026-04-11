import type { User, GameState, CardInstance, PlayerGameState } from '../types';
import { CARD_DEFS, ANCIENTS } from '../game/constants';
import {
  createInitialGameState, getPlayerState, getOpponentState,
  advancePhase, playCard, declareAttacker, declareBlocker,
  sacrificeLandscape, useAncient, selectAncient,
  resolveEntireStack, sacrificeAncient, addToRitualZone, removeFromRitualZone,
  addSpellToRitualZone, resolveRitualTarget, getPartialRitualMatches,
  isCardValidForRitualZone,
  cultivate, study, evolve, nourish, lastBreath, sacAncientAndLandscapes,
  chooseCombatDamageMode
} from '../game/engine';
const BOT_SP_REWARD = 10;
const BOT_WIN_LIMIT = 3;

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

  // Priority state
  private priorityPromiseResolve: ((gs: GameState) => void) | null = null;
  private priorityTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private waitingOnPlayer = false;  // bot is waiting for player to pass priority

  // Player inactivity auto-pass timer
  private playerInactivityTimerId: ReturnType<typeof setTimeout> | null = null;
  private botAutoPassScheduled = false;

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

  // Priority countdown timer
  private priorityTimerEndMs: number | null = null;
  private priorityCountdownInterval: ReturnType<typeof setInterval> | null = null;

  // Turn popup state
  private turnPopupVisible = false;
  private turnPopupIsMyTurn = false;
  private turnPopupTimerId: ReturnType<typeof setTimeout> | null = null;

  // Spacebar listener
  private spacebarHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(currentUser: User, onNav: NavCallback) {
    this.currentUser = currentUser;
    this.onNav = onNav;
    this.container = document.createElement('div');
    this.container.className = 'game-screen';

    this.gameState = createInitialGameState('local_bot_game', currentUser.uid, BOT_UID);
    // Initialize hand order
    this.handOrder = getPlayerState(this.gameState, currentUser.uid).hand.map(c => c.id);

    // Track mouse position for block drag-line
    this.mouseMoveHandler = (e: MouseEvent) => {
      this.blockDragPos = { x: e.clientX, y: e.clientY };
      this.updateBlockLinesSVG();
    };
    document.addEventListener('mousemove', this.mouseMoveHandler);

    // Spacebar passes priority (or dismisses turn popup)
    this.spacebarHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (this.turnPopupVisible) {
          this.dismissTurnPopup();
          return;
        }
        if (!this.botRunning || this.waitingOnPlayer) {
          this.handlePassPriority();
        }
      }
    };
    document.addEventListener('keydown', this.spacebarHandler);

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

    // If bot was waiting for player priority and the player just took a priority action
    // (e.g. used their ancient, which passes priority to bot), auto-resolve so the bot can continue.
    // We intentionally compare the OLD state (this.gameState) to the NEW state (newState) to detect
    // the moment the player's priority was transferred away as a result of their action.
    if (this.waitingOnPlayer &&
        this.gameState.priorityPlayer === myUid &&
        newState.priorityPlayer !== myUid) {
      setTimeout(() => this.resolvePlayerPriority(), 500);
    }

    // Detect turn change — show popup
    const turnChanged = this.gameState.currentTurn !== newState.currentTurn;
    // Detect phase breakpoint hit
    const phaseChanged = this.gameState.phase !== newState.phase;

    this.gameState = newState;
    this.render();

    // Phase breakpoint notification
    if (phaseChanged && this.phaseBreakpoint && newState.phase === this.phaseBreakpoint &&
        newState.currentTurn === myUid && !newState.winner) {
      this.breakpointHitPhase = newState.phase;
      this.clearPlayerInactivityTimer();
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

    if (!this.botRunning && !this.waitingOnPlayer) {
      this.maybeBotTurn();
    }

    if (newState.winner) return;

    // If player's combat blocks step: trigger bot blocking
    if (!this.botRunning && !this.waitingOnPlayer &&
        newState.currentTurn === myUid &&
        newState.phase === 'combat' && newState.combatStep === 'blocks') {
      this.botDeclareBlockersAndAdvance();
      return;
    }

    // If bot has priority during player's turn (e.g., after ancient use), auto-pass back.
    // Only applies when the stack is empty — stack responses are handled exclusively by
    // triggerBotStackResponse to prevent a race that corrupts stackPassedOnce.
    if (!this.botRunning && !this.waitingOnPlayer &&
        newState.currentTurn === myUid &&
        newState.priorityPlayer !== myUid &&
        newState.combatStep !== 'blocks' &&
        newState.stack.length === 0) {
      this.botAutoPassPriority();
      return;
    }

    // Start turn timer when player has priority on their own turn
    // (handles both auto-advance for replenish/draw and 30s inactivity for other phases)
    if (newState.currentTurn === myUid && newState.priorityPlayer === myUid &&
        !this.waitingOnPlayer) {
      this.startPlayerInactivityTimer();
    }
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

    this.ritualPopupTimerId = setTimeout(() => {
      popup.classList.add('ritual-toast-fade');
      setTimeout(() => popup.remove(), 600);
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
    this.turnPopupTimerId = setTimeout(() => {
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
    setTimeout(() => this.runBotTurnAsync(), 600);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private waitForPlayerPriority(timeoutMs = 30000): Promise<GameState> {
    return new Promise((resolve) => {
      this.waitingOnPlayer = true;
      this.priorityPromiseResolve = (gs: GameState) => {
        this.waitingOnPlayer = false;
        resolve(gs);
      };
      this.startPriorityCountdown(timeoutMs);
      this.priorityTimeoutId = setTimeout(() => {
        if (this.priorityPromiseResolve) {
          this.clearPriorityCountdown();
          const cb = this.priorityPromiseResolve;
          this.priorityPromiseResolve = null;
          this.waitingOnPlayer = false;
          cb(this.gameState);
        }
      }, timeoutMs);
      this.render(); // show priority UI
    });
  }

  private resolvePlayerPriority(): void {
    if (this.priorityPromiseResolve) {
      if (this.priorityTimeoutId !== null) {
        clearTimeout(this.priorityTimeoutId);
        this.priorityTimeoutId = null;
      }
      this.clearPriorityCountdown();
      const cb = this.priorityPromiseResolve;
      this.priorityPromiseResolve = null;
      this.waitingOnPlayer = false;
      cb(this.gameState);
    }
  }

  // Start player turn timer — 1s auto-advance for replenish/draw, 30s inactivity for other phases
  private startPlayerInactivityTimer(): void {
    this.clearPlayerInactivityTimer();
    if (this.gameState.winner) return;
    if (this.gamePaused || this.breakpointHitPhase) return;
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const isEarlyPhase = (gs.phase === 'replenish' || gs.phase === 'draw') && gs.currentTurn === myUid;

    if (isEarlyPhase) {
      // Auto-advance replenish/draw after 1 second
      this.playerInactivityTimerId = setTimeout(() => {
        this.playerInactivityTimerId = null;
        const curGs = this.gameState;
        if (curGs.currentTurn !== myUid || curGs.winner) return;
        if (this.gamePaused || this.breakpointHitPhase) return;
        const next = advancePhase(curGs, myUid);
        if (next !== curGs) this.setState(next);
      }, 1000);
    } else {
      // Normal 30s inactivity timer
      this.startPriorityCountdown(30000);
      this.playerInactivityTimerId = setTimeout(() => {
        this.playerInactivityTimerId = null;
        this.clearPriorityCountdown();
        const curGs = this.gameState;
        if (curGs.currentTurn !== myUid || curGs.winner) return;
        if (curGs.priorityPlayer !== myUid || this.waitingOnPlayer || this.botRunning) return;
        if (this.gamePaused || this.breakpointHitPhase) return;
        // Auto-advance phase after 30s of inactivity
        const next = advancePhase(curGs, myUid);
        if (next !== curGs) {
          this.setState(next);
        } else if (curGs.pendingDamageChoice && curGs.currentTurn === myUid) {
          // Auto-resolve pending unblocked damage choice to additive on timeout
          const resolved = chooseCombatDamageMode(curGs, myUid, 'additive');
          if (resolved !== curGs) this.setState(resolved);
        }
      }, 30000);
    }
  }

  private clearPlayerInactivityTimer(): void {
    if (this.playerInactivityTimerId !== null) {
      clearTimeout(this.playerInactivityTimerId);
      this.playerInactivityTimerId = null;
    }
  }

  private startPriorityCountdown(durationMs: number): void {
    this.clearPriorityCountdown();
    this.priorityTimerEndMs = Date.now() + durationMs;
    this.priorityCountdownInterval = setInterval(() => {
      const remaining = this.priorityTimerEndMs ? Math.max(0, this.priorityTimerEndMs - Date.now()) : 0;
      const el = this.container.querySelector<HTMLElement>('#priority-timer');
      if (el) {
        el.textContent = `⏱ ${Math.ceil(remaining / 1000)}s`;
        if (remaining <= 5000) el.style.color = 'var(--red)';
        else el.style.color = 'var(--gold)';
      }
      if (remaining <= 0) this.clearPriorityCountdown();
    }, 250);
  }

  private clearPriorityCountdown(): void {
    if (this.priorityCountdownInterval !== null) {
      clearInterval(this.priorityCountdownInterval);
      this.priorityCountdownInterval = null;
    }
    this.priorityTimerEndMs = null;
  }

  // When bot has priority during player's turn (e.g. after ancient use), auto-pass back
  private botAutoPassPriority(): void {
    if (this.botAutoPassScheduled) return;
    this.botAutoPassScheduled = true;
    const botPriorityMs = 1500;
    this.startPriorityCountdown(botPriorityMs);
    setTimeout(() => {
      this.botAutoPassScheduled = false;
      this.clearPriorityCountdown();
      const gs = this.gameState;
      const myUid = this.currentUser.uid;
      if (gs.currentTurn !== myUid || gs.priorityPlayer === myUid || this.botRunning || gs.winner) return;
      // Bot passes priority back to player
      this.gameState = { ...gs, priorityPlayer: myUid, stackPassedOnce: false, stackPassPriority: undefined };
      this.render();
      this.startPlayerInactivityTimer();
    }, botPriorityMs);
  }

  // Choose the damage mode that maximises damage for the bot
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

    if (unblockedPowers.length <= 1) return 'additive'; // Same either way for 0–1 attackers
    const additive = unblockedPowers.reduce((a, b) => a + b, 0);
    const multiplicative = unblockedPowers.reduce((a, b) => a * b, 1);
    return multiplicative >= additive ? 'multiplicative' : 'additive';
  }

  // During player's attack, bot declares blockers then advances combat
  private async botDeclareBlockersAndAdvance(): Promise<void> {
    if (this.botRunning) return;
    this.botRunning = true;
    try {
      await this.delay(1000);
      let gs = this.gameState;
      const myUid = this.currentUser.uid;
      if (gs.currentTurn !== myUid || gs.combatStep !== 'blocks' || gs.winner) {
        this.botRunning = false;
        return;
      }

      const botPs = getPlayerState(gs, BOT_UID);
      const playerPs = getPlayerState(gs, myUid);

      // Bot blocks: assign available non-exhausted beings against attackers,
      // respecting the flying restriction (non-flyers cannot block flyers).
      const availableBlockers = botPs.battlefield.filter(c => {
        const def = CARD_DEFS[c.defId];
        return def?.type === 'being' && !c.exhausted;
      });

      for (const attackerId of [...playerPs.attackers]) {
        if (availableBlockers.length === 0) break;
        const atkCard = playerPs.battlefield.find(c => c.id === attackerId);
        const atkDef = atkCard ? CARD_DEFS[atkCard.defId] : null;
        // Find the first compatible blocker (non-flyer cannot block a flyer)
        const compatIdx = availableBlockers.findIndex(b => {
          const bDef = CARD_DEFS[b.defId];
          return !(atkDef?.isFlyer && !bDef?.isFlyer);
        });
        if (compatIdx === -1) continue; // No compatible blocker for this attacker
        const [blocker] = availableBlockers.splice(compatIdx, 1);
        gs = declareBlocker(gs, BOT_UID, blocker.id, attackerId);
      }

      this.gameState = gs;
      this.render();
      await this.delay(600);

      // Advance: blocks → pre-damage → combat resolves (or awaits player damage choice) → play2
      gs = advancePhase(this.gameState, myUid);
      gs = advancePhase(gs, myUid);
      // If there are unblocked attackers, pendingDamageChoice will be set.
      // The modal will be shown in render(); player makes the choice via UI buttons.
      this.gameState = gs;
      this.render();
    } catch (e) {
      console.warn('Bot blocking error:', e);
    }
    this.botRunning = false;
    this.startPlayerInactivityTimer();
  }

  private async runBotTurnAsync(): Promise<void> {
    let gs = this.gameState;

    try {
      // replenish → draw
      if (gs.phase === 'replenish') gs = advancePhase(gs, BOT_UID);
      if (gs.phase === 'draw') gs = advancePhase(gs, BOT_UID);
      this.gameState = gs;
      this.render();
      await this.delay(400);

      // play1
      if (gs.phase === 'play1') {
        gs = await this.botPlayPhase(gs);
        gs = advancePhase(gs, BOT_UID); // → combat
        this.gameState = gs;
        this.render();
        await this.delay(400);
      }

      // combat
      if (gs.phase === 'combat') {
        gs = advancePhase(gs, BOT_UID); // none → pre
        gs = advancePhase(gs, BOT_UID); // pre → attackers

        const botPs = getPlayerState(gs, BOT_UID);
        for (const c of botPs.battlefield) {
          const def = CARD_DEFS[c.defId];
          // Wasp cannot attack the turn it was summoned
          if (def?.type === 'being' && (!c.exhausted || def.isFlyer) && !(def.id === 'wasp' && c.summonedThisTurn)) {
            gs = declareAttacker(gs, BOT_UID, c.id);
          }
        }
        this.gameState = gs;
        this.render();
        await this.delay(400);

        // advancePhase auto-skips blocking if player has no unexhausted beings
        gs = advancePhase(gs, BOT_UID); // attackers → blocks (or pre-damage if no player blockers)
        this.gameState = gs;
        this.render();
        await this.delay(400);

        if (gs.combatStep === 'blocks') {
          // Wait for player to declare blockers (up to 30s), then advance
          gs = await this.waitForPlayerPriority(30000);
          gs = advancePhase(gs, BOT_UID); // blocks → pre-damage
          gs = advancePhase(gs, BOT_UID); // pre-damage → resolves or sets pendingDamageChoice
        }
        // Bot auto-chooses best damage mode if unblocked attackers are present
        if (gs.pendingDamageChoice) {
          const mode = this.botChooseDamageMode(gs);
          gs = chooseCombatDamageMode(gs, BOT_UID, mode);
        }
        this.gameState = gs;
        this.render();
        await this.delay(400);
      }

      // play2
      if (gs.phase === 'play2') {
        gs = await this.botPlayPhase(gs);
        gs = advancePhase(gs, BOT_UID); // → end
        this.gameState = gs;
        this.render();
        await this.delay(300);
      }

      if (gs.phase === 'end') {
        gs = advancePhase(gs, BOT_UID);
        this.gameState = gs;
        this.render();
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
          this.gameState = gs;
          this.render();
          await this.delay(500);
        }
      }
    }

    // Play beings cheapest first
    const refreshedPs = getPlayerState(gs, BOT_UID);
    const beings = refreshedPs.hand
      .filter(c => CARD_DEFS[c.defId]?.type === 'being')
      .sort((a, b) => (CARD_DEFS[a.defId]?.cost ?? 0) - (CARD_DEFS[b.defId]?.cost ?? 0));

    for (const c of beings) {
      const next = playCard(gs, BOT_UID, c.id);
      if (next !== gs) {
        gs = next;
        this.gameState = gs;
        this.render();
        await this.delay(400);

        if (gs.stack.length > 0) {
          // Give player priority to respond (up to 20s)
          gs = await this.waitForPlayerPriority(30000);
          // Resolve all stack entries and show any ritual popups
          gs = this.maybeShowRitualPopup(resolveEntireStack(gs));
          this.gameState = gs;
          this.render();
          await this.delay(400);
        }
      }
    }

    // Cast spells (ignite/spike at opponent or their beings, grow if useful)
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
      if (def.spellType === 'ignite' || def.spellType === 'spike') {
        // Target player's strongest being or player directly
        const playerPs = getPlayerState(gs, this.currentUser.uid);
        const playerBeings = playerPs.battlefield.filter(b => CARD_DEFS[b.defId]?.type === 'being');
        if (playerBeings.length > 0) {
          // Target highest power being
          const target_ = playerBeings.sort((a, b) => (CARD_DEFS[b.defId]?.power ?? 0) - (CARD_DEFS[a.defId]?.power ?? 0))[0];
          target = target_.id;
        } else {
          target = 'opponent';
        }
      } else if (def.spellType === 'grow') {
        // Cast grow if we have it
        target = undefined;
      } else if (def.spellType === 'cancel') {
        // Don't cast cancel proactively (save for response)
        continue;
      }

      const next = playCard(gs, BOT_UID, c.id, target);
      if (next !== gs) {
        gs = next;
        this.gameState = gs;
        this.render();
        await this.delay(400);

        if (gs.stack.length > 0) {
          gs = await this.waitForPlayerPriority(30000);
          gs = this.maybeShowRitualPopup(resolveEntireStack(gs));
          this.gameState = gs;
          this.render();
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

    // Opponent hand card backs — centered
    const oppHandBacks = Array(opp.hand.length).fill(0).map(() =>
      `<div class="card-back"><div class="card-back-inner">?</div></div>`
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

    // Priority timer remaining
    const timerRemaining = this.priorityTimerEndMs ? Math.max(0, Math.ceil((this.priorityTimerEndMs - Date.now()) / 1000)) : null;
    const timerHtml = (timerRemaining !== null)
      ? `<span id="priority-timer" class="priority-timer" style="color:${timerRemaining <= 5 ? 'var(--red)' : 'var(--gold)'}">⏱ ${timerRemaining}s</span>`
      : '<span id="priority-timer" class="priority-timer" style="display:none"></span>';

    // WP colors for circles
    const wpColor = opp.willPower <= 5 ? '#ff4466' : opp.willPower <= 10 ? '#ff7700' : 'var(--red)';
    const myWpColor = ps.willPower <= 5 ? 'var(--red)' : ps.willPower <= 10 ? '#ff7700' : 'var(--gold)';

    this.container.innerHTML = `
      ${this.buildInfoBar(gs, ps, opp, isMyTurn, myHasP, timerHtml)}

      <div class="game-area">
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

              <div class="zone-label">🌿 LANDS (${myLandscapes.length}) · ${landThisTurn}/${maxLand} ${isMyTurn && (gs.phase === 'play1' || gs.phase === 'play2') ? '<span style="color:var(--green-dim);font-size:7px">(drag from hand · right-click sac)</span>' : ''}</div>
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

          <!-- Action bar -->
          ${this.buildActionBar(gs, isMyTurn, myHasP)}
        </div>
      </div>

      <!-- Hand area -->
      <div class="hand-area" id="hand-area" data-drop="hand">
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
      ? `<span style="font-family:'Press Start 2P',monospace;font-size:7px;color:var(--green);background:rgba(0,255,65,0.1);padding:2px 6px;border:1px solid var(--green)">⚔ YOUR TURN</span>`
      : `<span style="font-family:'Press Start 2P',monospace;font-size:7px;color:var(--red);background:rgba(255,45,85,0.1);padding:2px 6px;border:1px solid var(--red)">🤖 BOT TURN</span>`;

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

    if (this.waitingOnPlayer) {
      leftBtns.push(`<button id="btn-pass-priority" class="btn-gold pulse-anim">⚡ Pass Priority (bot waiting)</button>`);
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
      } else if (gs.phase === 'combat' && gs.combatStep === 'pre') {
        rightBtns.push(`<button id="btn-next-phase" class="btn-green">▶ Enter Attackers Phase</button>`);
      } else if (gs.phase === 'combat' && gs.combatStep === 'none') {
        rightBtns.push(`<button id="btn-next-phase" class="btn-green">▶ Enter Combat</button>`);
      } else {
        // Pass Priority is always active when shown — every phase change gives each player
        // the opportunity to respond before the phase advances.
        leftBtns.push(`<button id="btn-pass-priority" class="btn-gold">⚡ Pass Priority</button>`);
        rightBtns.push(`<button id="btn-next-phase" class="btn-green">▶ Next Phase</button>`);
        rightBtns.push(`<button id="btn-end-turn">⏩ End Turn</button>`);
      }

      // Global ritual buttons (only during play phase, on left)
      if (gs.phase === 'play1' || gs.phase === 'play2') {
        leftBtns.push(`<button id="btn-rituals" class="btn-gold" style="font-size:9px;padding:6px 10px">🔮 Rituals</button>`);
        if (ps.yard.length >= 10) {
          leftBtns.push(`<button id="btn-last-breath" class="btn-danger" style="font-size:9px;padding:6px 8px">💀 Last Breath</button>`);
        }
      }
    }

    if (!isMyTurn && gs.phase === 'combat' && gs.combatStep === 'blocks') {
      rightBtns.push(`<button id="btn-done-blocks" class="btn-green">🛡 Done Blocking</button>`);
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
    const stackActive = gs.stack.length > 0 || this.waitingOnPlayer;
    if (!stackActive) return '';

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
              ${entry.target ? `<span style="color:var(--text-dim);font-size:9px">→ ${entry.target}</span>` : ''}
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
        <div class="stack-list">${stackItems || '<div style="color:var(--text-dim);font-size:9px">Empty</div>'}</div>
        ${this.waitingOnPlayer ? `<button id="btn-pass-in-stack" class="btn-gold w-full mt-8">⚡ Pass Priority</button>` : ''}
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

    return `
      <div class="overlay" id="win-overlay">
        <div class="modal" style="text-align:center">
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
    return `
      <div class="overlay" id="settings-overlay">
        <div class="modal" style="max-width:320px;text-align:center">
          <div class="modal-title" style="color:var(--cyan)">⚙ SETTINGS</div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
            <button id="btn-settings-pause" class="${pauseBtnClass}" style="width:100%;padding:10px;font-size:10px">${pauseLabel}</button>
            <button id="btn-settings-lobby" class="btn-green" style="width:100%;padding:10px;font-size:10px">🏠 Exit to Lobby<br><span style="font-size:8px;color:var(--text-dim)">(game stays active)</span></button>
            <button id="btn-settings-concede" class="btn-danger" style="width:100%;padding:10px;font-size:10px">🏳 Concede</button>
            <button id="btn-settings-bug" class="btn-gold" style="width:100%;padding:10px;font-size:10px">🐛 Report a Bug</button>
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
          <p style="font-size:9px;color:var(--text-dim);margin:12px 0">Open ⚙ Settings to resume the game.</p>
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

    const isBlockStep = gs.phase === 'combat' && gs.combatStep === 'blocks' && gs.currentTurn !== myUid;
    if (!isBlockStep) return;

    const ps = getPlayerState(gs, myUid);
    const hasSelected = !!this.selectedCard && ps.battlefield.some(c => c.id === this.selectedCard);
    const hasAssigned = Object.keys(ps.blockers).length > 0;

    if (!hasSelected && !hasAssigned) return;

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

    // Draw drag line from selected blocker to mouse cursor
    if (hasSelected && this.selectedCard) {
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

    // Draw committed block assignment lines
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
        this.gameState = { ...this.gameState, winner: BOT_UID };
        this.render();
      }
    });
    this.container.querySelector('#btn-settings-pause')?.addEventListener('click', () => {
      this.gamePaused = !this.gamePaused;
      this.showSettings = false;
      if (this.gamePaused) {
        this.clearPlayerInactivityTimer();
        this.clearPriorityCountdown();
      } else {
        if (gs.currentTurn === myUid && gs.priorityPlayer === myUid && !this.waitingOnPlayer) {
          this.startPlayerInactivityTimer();
        }
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
      if (gs.currentTurn === myUid && gs.priorityPlayer === myUid && !this.waitingOnPlayer) {
        this.startPlayerInactivityTimer();
      }
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
      if (gs.currentTurn === myUid && gs.priorityPlayer === myUid && !this.waitingOnPlayer) {
        this.startPlayerInactivityTimer();
      }
    });
    this.container.querySelector('#btn-bp-hit-clear')?.addEventListener('click', () => {
      this.breakpointHitPhase = null;
      this.phaseBreakpoint = null;
      this.render();
      if (gs.currentTurn === myUid && gs.priorityPlayer === myUid && !this.waitingOnPlayer) {
        this.startPlayerInactivityTimer();
      }
    });

    // Pause overlay — open settings
    this.container.querySelector('#btn-pause-settings')?.addEventListener('click', () => {
      this.showSettings = true;
      this.render();
    });

    // Phase/priority buttons
    this.container.querySelector('#btn-next-phase')?.addEventListener('click', () => {
      if (!isMyTurn || (this.botRunning && !this.waitingOnPlayer)) return;
      const next = advancePhase(gs, myUid);
      if (next !== gs) this.setState(next);
    });

    this.container.querySelector('#btn-end-turn')?.addEventListener('click', () => {
      if (!isMyTurn || (this.botRunning && !this.waitingOnPlayer)) return;
      const resolved = gs.stack.length > 0 ? resolveEntireStack(gs) : gs;
      // If stack is empty and we're not in a combat step, go directly to end
      if (resolved.stack.length === 0 && (resolved.phase !== 'combat' || resolved.combatStep === 'none')) {
        const ended = advancePhase({ ...resolved, phase: 'end', combatStep: 'none', pendingDamageChoice: undefined }, myUid);
        this.setState(ended);
      } else {
        // Fallback: hand priority to bot for combat/stack cases
        this.setState({
          ...resolved,
          phase: 'end',
          combatStep: 'none',
          pendingDamageChoice: undefined,
          stackPassedOnce: false,
          stackPassPriority: undefined,
          priorityPlayer: BOT_UID,
        });
      }
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
      // Signal bot that player is done declaring blockers
      if (this.waitingOnPlayer) {
        this.resolvePlayerPriority();
      }
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
        if (next !== gs) {
          this.setState(next);
          // Stack now has the card; bot gets priority to respond
          if (next.stack.length > 0) this.triggerBotStackResponse();
        }
      }
    } else if (zone === 'attack' && def.type === 'being' && gs.phase === 'combat' && gs.combatStep === 'attackers') {
      // Play being from hand to attack zone
      if (card.defId === 'wasp') {
        this.showWaspPaymentModal(gs, myUid, cardId);
      } else {
        const afterPlay = playCard(gs, myUid, cardId);
        if (afterPlay !== gs) {
          this.setState(afterPlay);
          if (afterPlay.stack.length > 0) this.triggerBotStackResponse();
        }
      }
    } else if (def.type === 'spell') {
      // Cast spell — show target picker if needed
      if (def.spellType === 'ignite' || def.spellType === 'spike') {
        this.showTargetPicker(gs, myUid, cardId);
      } else {
        const next = playCard(gs, myUid, cardId);
        if (next !== gs) {
          this.setState(next);
          if (next.stack.length > 0) this.triggerBotStackResponse();
        }
      }
    }
  }

  private handlePassPriority(): void {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;

    if (this.waitingOnPlayer) {
      // Bot is waiting for player to pass (blocking or stack response)
      this.resolvePlayerPriority();
      return;
    }

    if (gs.stack.length > 0) {
      // Only the priority holder can act on the stack. If the bot currently holds
      // priority, wait for triggerBotStackResponse to pass it back before acting.
      if (gs.priorityPlayer !== myUid) return;

      const stackOrder: Record<string, number> = {};
      gs.stack.forEach((entry, idx) => {
        stackOrder[entry.id] = idx + 1;
      });

      const hasMatchingStackSnapshot = !!gs.stackPassPriority
        && gs.stack.length === Object.keys(gs.stackPassPriority.stackOrder).length
        && gs.stack.every((entry, idx) => gs.stackPassPriority!.stackOrder[entry.id] === idx + 1);

      const tracker = hasMatchingStackSnapshot
        ? gs.stackPassPriority!
        : { stackOrder, passOrder: {} as Record<string, number> };

      // Ignore duplicate pass presses by the same player for the same stack snapshot.
      if (tracker.passOrder[myUid] !== undefined) return;

      const nextPassOrder = {
        ...tracker.passOrder,
        [myUid]: Object.keys(tracker.passOrder).length + 1,
      };
      const nextTracker = { ...tracker, passOrder: nextPassOrder };
      const bothPassed = nextPassOrder[myUid] !== undefined && nextPassOrder[BOT_UID] !== undefined;

      if (!bothPassed) {
        // First pass for this stack snapshot: give priority to the bot to respond/pass.
        this.gameState = { ...gs, priorityPlayer: BOT_UID, stackPassedOnce: true, stackPassPriority: nextTracker };
        this.render();
        this.triggerBotStackResponse();
      } else {
        // Both sides have passed in succession — resolve the entire stack.
        this.setState(resolveEntireStack(this.gameState));
        this.startPlayerInactivityTimer();
      }
      return;
    }

    // Stack is empty and player has priority → pass priority advances the phase
    if (gs.currentTurn === myUid && gs.priorityPlayer === myUid) {
      const next = advancePhase(gs, myUid);
      if (next !== gs) this.setState(next);
    }
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
      this.setState(newState);
      if (newState.stack.length > 0) {
        // Bot gets priority to respond; after a delay it either responds or passes back
        this.triggerBotStackResponse();
      }
    }
  }

  // Bot responds to stack (may counter) or passes priority back to player
  private triggerBotStackResponse(): void {
    setTimeout(() => {
      const gs = this.gameState;
      // Stale timer: the stack was already resolved before this callback fired.
      // Do nothing — a fresh triggerBotStackResponse will be scheduled when needed.
      if (gs.stack.length === 0) return;

      const botResponded = this.botTryRespond();
      if (!botResponded) {
        const myUid = this.currentUser.uid;
        const stackOrder: Record<string, number> = {};
        gs.stack.forEach((entry, idx) => {
          stackOrder[entry.id] = idx + 1;
        });

        const hasMatchingStackSnapshot = !!gs.stackPassPriority
          && gs.stack.length === Object.keys(gs.stackPassPriority.stackOrder).length
          && gs.stack.every((entry, idx) => gs.stackPassPriority!.stackOrder[entry.id] === idx + 1);

        const tracker = hasMatchingStackSnapshot
          ? gs.stackPassPriority!
          : { stackOrder, passOrder: {} as Record<string, number> };

        const nextPassOrder = tracker.passOrder[BOT_UID] === undefined
          ? { ...tracker.passOrder, [BOT_UID]: Object.keys(tracker.passOrder).length + 1 }
          : tracker.passOrder;

        // Bot passes priority back to the player; pass order is now recorded for this stack.
        this.gameState = {
          ...gs,
          priorityPlayer: myUid,
          stackPassedOnce: true,
          stackPassPriority: { ...tracker, passOrder: nextPassOrder },
        };
        this.render();
      }
    }, 1200);
  }

  private botTryRespond(): boolean {
    const gs = this.gameState;
    const myUid = this.currentUser.uid;
    const botPs = getPlayerState(gs, BOT_UID);

    // Staleness check: only respond if the bot actually has priority right now
    // and there is something on the stack from the player
    if (gs.priorityPlayer !== BOT_UID || gs.stack.length === 0) return false;

    // Bot always cancels Grow when the player casts it (and any other non-being spell if possible)
    const topEntry = gs.stack[gs.stack.length - 1];
    const topDef = CARD_DEFS[topEntry.cardDefId];
    // Only respond to the player's spells (not the bot's own)
    if (topEntry.playerId !== myUid) return false;
    if (topDef?.type !== 'being') {
      const cancelCard = botPs.hand.find(c => CARD_DEFS[c.defId]?.spellType === 'cancel');
      if (cancelCard && botPs.willPower >= (CARD_DEFS[cancelCard.defId]?.cost ?? 0)) {
        const next = playCard(gs, BOT_UID, cancelCard.id);
        if (next !== gs) {
          this.gameState = next;
          this.render();
          // Bot's cancel is on stack; pass priority back to player to respond
          setTimeout(() => {
            const cur = this.gameState;
            if (cur.priorityPlayer !== myUid) {
              this.gameState = { ...cur, priorityPlayer: myUid };
              this.render();
            }
          }, 600);
          return true;
        }
      }
    }
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
        const newState = playCard(gs, uid, cardId, target);
        this.selectedCard = null;
        if (newState !== gs) {
          this.setState(newState);
          if (newState.stack.length > 0) {
            this.triggerBotStackResponse();
          }
        } else {
          this.render();
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
        const newState = useAncient(gs, uid, target);
        if (newState !== gs) this.setState(newState);
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
      if (newState !== this.gameState) {
        this.setState(newState);
        if (newState.stack.length > 0) this.triggerBotStackResponse();
      }
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

        // Discard the selected card from the snapshot state (captured when the modal opened),
        // then play the wasp from the resulting state.
        let discardedGs = gs;
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
        if (newState !== discardedGs) {
          this.setState(newState);
          if (newState.stack.length > 0) this.triggerBotStackResponse();
        }
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
        setTimeout(() => this.showDiscardModal(), 400);
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
    if (this.priorityTimeoutId !== null) clearTimeout(this.priorityTimeoutId);
    if (this.ritualPopupTimerId !== null) clearTimeout(this.ritualPopupTimerId);
    if (this.turnPopupTimerId !== null) clearTimeout(this.turnPopupTimerId);
    this.clearPlayerInactivityTimer();
    this.clearPriorityCountdown();
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
