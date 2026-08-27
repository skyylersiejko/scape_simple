import type { GameState, PlayerGameState, CardInstance, GamePhase, StackEntry, StackPassPriorityState } from '../types';
import {
  CARD_DEFS, STARTING_HAND_SIZE, STARTING_WILL_POWER,
  buildStandardDeck, WIN_CONDITION_LANDSCAPES, WIN_CONDITION_FOI_SAC,
  MAX_LANDSCAPES_PER_TURN_HARD_CAP
} from './constants';

/**
 * Firebase Realtime Database stores empty JavaScript arrays as `null` (it removes
 * the node entirely). When game state is read back from Firebase, any arrays that
 * were empty at write-time come back as `null`, which causes TypeErrors wherever
 * the code calls `.filter()`, `.length`, spread (`[...arr]`), etc.
 *
 * This function normalises a Firebase-sourced PlayerGameState by replacing every
 * null array/object field with its proper empty equivalent before the state is
 * used by the game engine or UI.
 */
function sanitizePlayerState(ps: PlayerGameState): PlayerGameState {
  // Cast through unknown so TypeScript doesn't complain about the null checks
  // on fields that are declared as non-nullable in the type definition.
  type NullablePS = {
    hand: CardInstance[] | null;
    deck: CardInstance[] | null;
    battlefield: CardInstance[] | null;
    limbo: CardInstance[] | null;
    yard: CardInstance[] | null;
    exile: CardInstance[] | null;
    attackers: string[] | null;
    ritualZone: CardInstance[] | null;
    blockers: Record<string, string> | null;
  };
  const p = ps as unknown as NullablePS;
  return {
    ...ps,
    hand: p.hand ?? [],
    deck: p.deck ?? [],
    battlefield: p.battlefield ?? [],
    limbo: p.limbo ?? [],
    yard: p.yard ?? [],
    exile: p.exile ?? [],
    attackers: p.attackers ?? [],
    ritualZone: p.ritualZone ?? [],
    blockers: p.blockers ?? {},
  };
}

/**
 * Normalise a GameState that was round-tripped through Firebase.
 * Call this on every state object received from Firebase before passing it to
 * the game engine or the render functions.
 */
export function sanitizeGameState(state: GameState): GameState {
  type NullableGS = {
    stack: StackEntry[] | null;
    log: string[] | null;
    stackHistoryPlays: Array<{ defId: string; playerId: string }> | null;
    priorityPlayer: string | null;
    stackPassPriority: {
      stackOrder: Record<string, number> | null;
      passOrder: Record<string, number> | null;
    } | null;
  };
  const s = state as unknown as NullableGS;
  const p1Uid = state.player1;
  const p2Uid = state.player2;
  const validCurrentTurn = state.currentTurn === p1Uid || state.currentTurn === p2Uid
    ? state.currentTurn
    : p1Uid;
  const validPriority = ((): string => {
    if (s.priorityPlayer === p1Uid || s.priorityPlayer === p2Uid) return s.priorityPlayer;
    return validCurrentTurn;
  })();
  const validSeq = typeof state.seq === 'number' && Number.isFinite(state.seq)
    ? state.seq
    : 0;
  return {
    ...state,
    currentTurn: validCurrentTurn,
    stack: s.stack ?? [],
    log: s.log ?? [],
    stackHistoryPlays: s.stackHistoryPlays ?? [],
    // Backwards compat: older Firebase states written before priority tracking was added
    // will have priorityPlayer as null/undefined — default to the current turn player.
    priorityPlayer: validPriority,
    // Backwards compat: default to false (no one has passed yet)
    stackPassedOnce: state.stackPassedOnce ?? false,
    seq: validSeq,
    stackPassPriority: s.stackPassPriority
      ? {
        stackOrder: s.stackPassPriority.stackOrder ?? {},
        passOrder: s.stackPassPriority.passOrder ?? {},
      }
      : undefined,
    p1State: sanitizePlayerState(state.p1State),
    p2State: sanitizePlayerState(state.p2State),
  };
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ci_${crypto.randomUUID()}`;
  }
  return `ci_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function makeInstance(defId: string, owner: string): CardInstance {
  return { id: makeId(), defId, exhausted: false, counters: 0, owner };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeStackPassPriority(stack: StackEntry[]): StackPassPriorityState {
  const stackOrder: Record<string, number> = {};
  stack.forEach((entry, idx) => {
    stackOrder[entry.id] = idx + 1;
  });
  return { stackOrder, passOrder: {} };
}

// ─── Priority windows ────────────────────────────────────────────────────────
//
// A *priority window* is one round of "each player may act, then pass". It is
// identified by the stack it was opened over: `stackPassPriority.stackOrder` is a
// snapshot of that stack, and `passOrder` records who has already passed inside it.
//
// The same structure serves windows opened over an *empty* stack (`stackOrder: {}`),
// which is how the pre-damage combat gate works — so there is exactly one mechanism
// for "both players passed in succession" rather than one for the stack and a
// separate overloaded boolean for combat.
//
// Any change to the stack (a card played, the stack resolving) invalidates the
// window, which is what makes a late/duplicate pass harmless instead of corrupting
// the gate.

/**
 * True when `state.stackPassPriority` still describes the current stack, i.e. the
 * recorded passes belong to the window we are in right now. Returns false when no
 * window has been opened yet.
 */
export function priorityWindowMatches(state: GameState): boolean {
  const w = state.stackPassPriority;
  if (!w) return false;
  const stack = state.stack ?? [];
  if (stack.length !== Object.keys(w.stackOrder).length) return false;
  return stack.every((entry, idx) => w.stackOrder[entry.id] === idx + 1);
}

/**
 * Open a fresh priority window over the current stack and give priority to `holder`.
 * Any previously recorded passes are discarded — this starts a new round.
 */
export function beginPriorityWindow(state: GameState, holder: string): GameState {
  return {
    ...state,
    priorityPlayer: holder,
    stackPassedOnce: false,
    stackPassPriority: makeStackPassPriority(state.stack ?? []),
  };
}

/**
 * Clear all priority state and hand priority to `uid`. Called at the points where a
 * window genuinely ends: the stack finished resolving, the turn changed, or combat
 * damage was applied.
 */
export function resetPriority(state: GameState, uid: string): GameState {
  return {
    ...state,
    priorityPlayer: uid,
    stackPassedOnce: false,
    stackPassPriority: undefined,
  };
}

/**
 * Record that `uid` passed priority in the current window.
 *
 * Idempotent per player: passing twice in the same window records one pass, so a
 * duplicate button press or a stale timer cannot fake the opponent's pass. If the
 * stack changed since the window opened, a fresh window is started first.
 *
 * When only one player has passed, priority moves to the opponent so they get their
 * response window. When both have passed, `bothPassed` is true and `priorityPlayer`
 * is left on the turn player for the caller to resolve the stack.
 */
export function recordPriorityPass(
  state: GameState, uid: string
): { state: GameState; bothPassed: boolean } {
  const window = priorityWindowMatches(state)
    ? state.stackPassPriority!
    : makeStackPassPriority(state.stack ?? []);

  const passOrder = window.passOrder[uid] !== undefined
    ? window.passOrder
    : { ...window.passOrder, [uid]: Object.keys(window.passOrder).length + 1 };

  const oppUid = state.player1 === uid ? state.player2 : state.player1;
  const bothPassed = passOrder[uid] !== undefined && passOrder[oppUid] !== undefined;

  return {
    state: {
      ...state,
      priorityPlayer: bothPassed ? state.currentTurn : oppUid,
      stackPassedOnce: true,
      stackPassPriority: { ...window, passOrder },
    },
    bothPassed,
  };
}

export function createInitialGameState(roomId: string, p1Uid: string, p2Uid: string, p1Rank = 100, p2Rank = 100): GameState {
  const makePlayerState = (uid: string): PlayerGameState => {
    const deckDefs = shuffle(buildStandardDeck());
    const deck = deckDefs.map(defId => makeInstance(defId, uid));
    const hand = deck.splice(0, STARTING_HAND_SIZE);
    // ancient starts as null — each player must choose their own before the game begins
    return {
      uid,
      willPower: STARTING_WILL_POWER,
      hand,
      deck,
      battlefield: [],
      limbo: [],
      yard: [],
      exile: [],
      ancient: null,
      attackers: [],
      blockers: {},
      ready: false,
      landscapeCountThisTurn: 0,
      ritualZone: [],
      igniteBoost: 0,
    };
  };

  // Randomly determine who goes first
  const firstPlayer = Math.random() < 0.5 ? p1Uid : p2Uid;

  return {
    id: roomId,
    player1: p1Uid,
    player2: p2Uid,
    currentTurn: firstPlayer,
    phase: 'replenish',
    combatStep: 'none',
    p1State: makePlayerState(p1Uid),
    p2State: makePlayerState(p2Uid),
    stack: [],
    log: ['Game started!'],
    startedAt: Date.now(),
    turnNumber: 1,
    p1LandscapesThisTurn: 0,
    p2LandscapesThisTurn: 0,
    p1ConsecutiveTurnsNoLandscape: 0,
    p2ConsecutiveTurnsNoLandscape: 0,
    p1ConsecutiveTurnsNoSpell: 0,
    p2ConsecutiveTurnsNoSpell: 0,
    p1FieldOfImaginationSacCount: 0,
    p2FieldOfImaginationSacCount: 0,
    priorityPlayer: firstPlayer,
    p1TurnCount: firstPlayer === p1Uid ? 1 : 0,
    p2TurnCount: firstPlayer === p2Uid ? 1 : 0,
    p1Rank,
    p2Rank,
    stackHistoryPlays: [],
    seq: 0,
  };
}

export function getPlayerState(state: GameState, uid: string): PlayerGameState {
  return state.player1 === uid ? state.p1State : state.p2State;
}

export function getOpponentState(state: GameState, uid: string): PlayerGameState {
  return state.player1 === uid ? state.p2State : state.p1State;
}

function setPlayerState(state: GameState, uid: string, ps: PlayerGameState): GameState {
  if (state.player1 === uid) return { ...state, p1State: ps };
  return { ...state, p2State: ps };
}

function addLog(state: GameState, msg: string): GameState {
  return { ...state, log: [...(state.log || []).slice(-49), msg] };
}

export function selectAncient(state: GameState, uid: string, ancientDefId: string): GameState {
  const ps = getPlayerState(state, uid);
  // Always create a fresh ancient instance (exhausted: false) so players can use it
  const ancient = makeInstance(ancientDefId, uid);
  return setPlayerState(state, uid, { ...ps, ancient });
}

export function advancePhase(state: GameState, uid: string): GameState {
  if (state.currentTurn !== uid) return state;
  const phases: GamePhase[] = ['replenish', 'draw', 'play1', 'combat', 'play2', 'end'];
  const idx = phases.indexOf(state.phase);

  if (state.phase === 'combat') {
    if (state.combatStep === 'none') return resetPriority({ ...state, combatStep: 'pre' }, uid);
    if (state.combatStep === 'pre') return resetPriority({ ...state, combatStep: 'attackers' }, uid);
    if (state.combatStep === 'attackers') {
      const oppUid = state.player1 === uid ? state.player2 : state.player1;
      // Skip the blocking step if there are no valid blocking assignments:
      // requires at least one declared attacker AND at least one unexhausted defender
      // being that can legally block at least one of those attackers (flyers can only
      // be blocked by other flyers).
      const atkPs = getPlayerState(state, uid);
      const defPs = getPlayerState(state, oppUid);
      const hasValidBlockers = atkPs.attackers.length > 0 && defPs.battlefield.some(blocker => {
        const blkDef = CARD_DEFS[blocker.defId];
        if (!blkDef || blkDef.type !== 'being' || blocker.exhausted) return false;
        // This blocker is valid if it can block at least one declared attacker
        return atkPs.attackers.some(atkId => {
          const atkCard = atkPs.battlefield.find(c => c.id === atkId);
          const atkDef = atkCard ? CARD_DEFS[atkCard.defId] : null;
          // A non-flyer blocker cannot block a flyer attacker
          return !(atkDef?.isFlyer && !blkDef.isFlyer);
        });
      });
      if (!hasValidBlockers) {
        // No valid blocking available — skip directly to pre-damage.
        // Return pre-damage state and let the caller handle priority passing
        // before combat damage resolves.
        // Priority starts with the active player, as in any step: they pass first,
        // then the defender, and damage resolves once both have passed.
        return resetPriority({ ...state, combatStep: 'pre-damage' as const }, uid);
      }
      return resetPriority({ ...state, combatStep: 'blocks' }, oppUid);
    }
    if (state.combatStep === 'blocks') return resetPriority({ ...state, combatStep: 'pre-damage' }, uid);
    if (state.combatStep === 'pre-damage') {
      // If a damage choice is already pending, don't advance until it's resolved
      if (state.pendingDamageChoice) return state;

      // Check whether any unblocked attacker has power > 0 — if so, ask the player to choose
      const attackerUid = state.currentTurn;
      const defenderUid = state.player1 === attackerUid ? state.player2 : state.player1;
      const atkPs = getPlayerState(state, attackerUid);
      const defPs = getPlayerState(state, defenderUid);
      const hasUnblockedWithPower = atkPs.attackers.some(atkId => {
        const blocked = Object.values(defPs.blockers).includes(atkId);
        if (blocked) return false;
        const card = atkPs.battlefield.find(c => c.id === atkId);
        return card ? (CARD_DEFS[card.defId]?.power ?? 0) > 0 : false;
      });

      if (hasUnblockedWithPower) {
        return { ...state, pendingDamageChoice: true };
      }

      const afterDmg = resolveCombat(state);
      return resetPriority({ ...afterDmg, combatStep: 'none', phase: 'play2' }, uid);
    }
  }

  if (idx < phases.length - 1) {
    const nextPhase = phases[idx + 1];

    // Skip combat entirely if the active player has no eligible attackers
    if (nextPhase === 'combat') {
      // Resolve the entire stack (all pending spells, beings, etc.) so that any cards
      // in limbo enter the battlefield before the eligibility check. This prevents
      // incorrectly skipping combat when beings were just played but haven't yet resolved
      // from the stack. Returning early from this block is safe because the code below
      // only initialises non-combat phase transitions (replenish / draw).
      const resolved = state.stack.length > 0 ? resolveEntireStack(state) : state;
      const ps = getPlayerState(resolved, uid);
      const eligibleAttackers = ps.battlefield.filter(c => {
        const def = CARD_DEFS[c.defId];
        if (!def || def.type !== 'being') return false;
        // Wasp must wait one full turn before attacking
        if (def.id === 'wasp' && c.summonedThisTurn) return false;
        return !c.exhausted || def.isFlyer;
      });
      if (eligibleAttackers.length === 0) {
        return resetPriority({ ...resolved, phase: 'play2', combatStep: 'none' }, uid);
      }
      // Transition to combat phase using the stack-resolved state
      return resetPriority({ ...resolved, phase: nextPhase }, uid);
    }

    let next: GameState = resetPriority({ ...state, phase: nextPhase }, uid);

    if (nextPhase === 'replenish') {
      next = endTurn(state);
    } else if (nextPhase === 'draw') {
      next = drawPhase(next, uid);
    }
    return next;
  }

  return endTurn(state);
}

function replenishPhase(state: GameState, uid: string): GameState {
  const ps = getPlayerState(state, uid);
  const refreshed = ps.battlefield.map(c => ({ ...c, exhausted: false, summonedThisTurn: false }));
  return setPlayerState(state, uid, {
    ...ps,
    battlefield: refreshed,
    landscapeCountThisTurn: 0
  });
}

function drawPhase(state: GameState, uid: string): GameState {
  return drawCards(state, uid, 1);
}

export function drawCards(state: GameState, uid: string, count: number): GameState {
  let ps = getPlayerState(state, uid);
  const drawn: CardInstance[] = [];
  const deck = [...ps.deck];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) break;
    drawn.push(deck.shift()!);
  }
  ps = { ...ps, hand: [...ps.hand, ...drawn], deck };
  let next = setPlayerState(state, uid, ps);
  next = addLog(next, `${uid} drew ${drawn.length} card(s).`);
  return next;
}

export function playCard(state: GameState, uid: string, cardInstanceId: string, target?: string, extraLandscapeCost = 0): GameState {
  if (state.winner) return state;
  // Only the priority holder may put anything into play or onto the stack. This is
  // the engine-level gate: without it a UI element built from a stale snapshot (a
  // target picker left open while the bot acted, say) could replay an old state and
  // silently roll the game back. Returning `state` unchanged is how every call site
  // already detects "that play was not legal".
  if (state.priorityPlayer !== uid) return state;

  let ps = getPlayerState(state, uid);
  const cardIdx = ps.hand.findIndex(c => c.id === cardInstanceId);
  if (cardIdx === -1) return state;

  const card = ps.hand[cardIdx];
  const def = CARD_DEFS[card.defId];
  if (!def) return state;

  const oppUid = state.player1 === uid ? state.player2 : state.player1;
  let next = state;

  if (def.type === 'landscape') {
    if (state.currentTurn !== uid) return state;
    if (state.phase !== 'play1' && state.phase !== 'play2') return state;

    const isP1 = state.player1 === uid;
    const landscapesThisTurn = isP1 ? state.p1LandscapesThisTurn : state.p2LandscapesThisTurn;
    const playerTurnCount = isP1 ? state.p1TurnCount : state.p2TurnCount;
    const maxLandscapes = Math.min(playerTurnCount, MAX_LANDSCAPES_PER_TURN_HARD_CAP);
    if (landscapesThisTurn >= maxLandscapes) return state;

    const hand = [...ps.hand];
    hand.splice(cardIdx, 1);
    const battlefield = [...ps.battlefield, { ...card, exhausted: false }];
    ps = { ...ps, hand, battlefield };
    next = setPlayerState(next, uid, ps);
    next = isP1
      ? { ...next, p1LandscapesThisTurn: next.p1LandscapesThisTurn + 1 }
      : { ...next, p2LandscapesThisTurn: next.p2LandscapesThisTurn + 1 };
    next = addLog(next, `${uid} played a Landscape.`);
    return checkWinConditions(next);
  }

  if (def.type === 'being') {
    if (state.currentTurn !== uid) return state;
    if (state.phase !== 'play1' && state.phase !== 'play2') return state;

    const cost = (def.cost ?? 0) + extraLandscapeCost;
    // Beings require unexhausted landscapes equal to their cost
    const unexhaustedLandscapes = ps.battlefield.filter(
      c => CARD_DEFS[c.defId]?.type === 'landscape' && !c.exhausted
    );
    if (unexhaustedLandscapes.length < cost) return state;

    const hand = [...ps.hand];
    hand.splice(cardIdx, 1);
    const limboCard: CardInstance = { ...card, summonedThisTurn: true };
    const limbo = [...ps.limbo, limboCard];

    // Exhaust landscapes to pay cost
    const landscapeIdsToExhaust = unexhaustedLandscapes.slice(0, cost).map(c => c.id);
    const battlefield = ps.battlefield.map(c =>
      landscapeIdsToExhaust.includes(c.id) ? { ...c, exhausted: true } : c
    );

    ps = { ...ps, hand, battlefield, limbo };
    next = setPlayerState(next, uid, ps);

    const entry: StackEntry = {
      id: makeId(),
      cardInstanceId: card.id,
      cardDefId: card.defId,
      playerId: uid
    };
    const nextStack = [...next.stack, entry];
    next = {
      ...next,
      stack: nextStack,
      priorityPlayer: oppUid,
      stackPassedOnce: false,
      stackPassPriority: makeStackPassPriority(nextStack),
    };
    // Track stack history for stack rituals
    const newHistory = [...next.stackHistoryPlays, { defId: card.defId, playerId: uid }];
    next = { ...next, stackHistoryPlays: newHistory };
    // STACK WAR: track last player when stack > 4 cards
    if (next.stack.length > 4) {
      next = { ...next, stackWarPlayer: uid };
    }
    next = addLog(next, `${uid} played ${def.name} (exhausted ${cost} landscape(s)) — on stack.`);
    return next;
  }

  if (def.type === 'spell') {
    const cost = def.cost ?? 0;
    if (ps.willPower < cost) return state;

    const hand = [...ps.hand];
    hand.splice(cardIdx, 1);
    const limbo = [...ps.limbo, { ...card }];
    ps = { ...ps, hand, willPower: ps.willPower - cost, limbo };
    next = setPlayerState(next, uid, ps);

    const entry: StackEntry = {
      id: makeId(),
      cardInstanceId: card.id,
      cardDefId: card.defId,
      playerId: uid,
      target
    };
    const nextStack = [...next.stack, entry];
    next = {
      ...next,
      stack: nextStack,
      priorityPlayer: oppUid,
      stackPassedOnce: false,
      stackPassPriority: makeStackPassPriority(nextStack),
    };
    // Track stack history for stack rituals
    const newHistorySpell = [...next.stackHistoryPlays, { defId: card.defId, playerId: uid }];
    next = { ...next, stackHistoryPlays: newHistorySpell };
    // STACK WAR: track last player when stack > 4 cards
    if (next.stack.length > 4) {
      next = { ...next, stackWarPlayer: uid };
    }
    next = addLog(next, `${uid} cast ${def.name}${target ? ` → ${target}` : ''} — on stack.`);
    return next;
  }

  return state;
}

export function resolveTopOfStack(state: GameState): GameState {
  if (state.stack.length === 0) return state;

  const stack = [...state.stack];
  const top = stack.pop()!;
  let next = { ...state, stack };

  const def = CARD_DEFS[top.cardDefId];
  if (!def) {
    return { ...next, priorityPlayer: next.currentTurn };
  }

  const ownerPs = getPlayerState(next, top.playerId);
  const limboIdx = ownerPs.limbo.findIndex(c => c.id === top.cardInstanceId);

  if (def.type === 'being') {
    if (limboIdx !== -1) {
      const limbo = [...ownerPs.limbo];
      const card = limbo.splice(limboIdx, 1)[0];
      const battlefield = [...ownerPs.battlefield, { ...card, summonedThisTurn: true }];
      next = setPlayerState(next, top.playerId, { ...getPlayerState(next, top.playerId), limbo, battlefield });
      next = addLog(next, `${def.name} entered the battlefield.`);
    }
  } else if (def.type === 'spell') {
    if (limboIdx !== -1) {
      const limbo = [...ownerPs.limbo];
      const card = limbo.splice(limboIdx, 1)[0];
      const yard = [...ownerPs.yard, card];
      next = setPlayerState(next, top.playerId, { ...getPlayerState(next, top.playerId), limbo, yard });
    }
    next = resolveSpellEffect(next, top.playerId, top.cardDefId, top.target);
    next = addLog(next, `${def.name} resolved.`);
  }

  next = { ...next, priorityPlayer: next.currentTurn };
  return checkWinConditions(next);
}

export function resolveEntireStack(state: GameState): GameState {
  const historySnapshot = [...state.stackHistoryPlays];
  const stackWarPlayer = state.stackWarPlayer;

  let next = state;
  while (next.stack.length > 0) {
    next = resolveTopOfStack(next);
  }

  // Check stack rituals using the history from before resolution
  next = checkStackRituals(next, historySnapshot);

  // STACK WAR: if stack had >4 cards, last player who played draws a card
  if (stackWarPlayer) {
    next = drawCards(next, stackWarPlayer, 1);
    const warMsg = `⚔ STACK WAR: ${stackWarPlayer} draws a card for playing the last card!`;
    next = addLog(next, warMsg);
    next = { ...next, pendingRitualPopup: warMsg };
  }

  // Clear stack history and reset priority tracking after full resolution.
  // The stack is gone, so the window that was open over it is gone too and
  // priority returns to the turn player.
  next = { ...next, stackHistoryPlays: [], stackWarPlayer: undefined };
  return resetPriority(next, next.currentTurn);
}

function resolveSpellEffect(state: GameState, uid: string, spellDefId: string, target?: string): GameState {
  const def = CARD_DEFS[spellDefId];
  if (!def) return state;

  let next = state;
  const ps = getPlayerState(state, uid);

  if (def.spellType === 'ignite') {
    // Apply any ignite boost from rituals
    const boost = ps.igniteBoost ?? 0;
    const damage = 2 + boost;
    next = dealDamageToTarget(next, uid, target, damage);
    // Reset the boost after use
    if (boost > 0) {
      const psAfter = getPlayerState(next, uid);
      next = setPlayerState(next, uid, { ...psAfter, igniteBoost: 0 });
      next = addLog(next, `Ignite dealt ${damage} damage (ritual boost: +${boost})!`);
    }
  } else if (def.spellType === 'spike') {
    // Check for AoE: if opponent has 3+ beings of the same name, hits all but the chosen one
    const oppPs = getOpponentState(state, uid);
    const beingGroups: Record<string, CardInstance[]> = {};
    for (const c of oppPs.battlefield) {
      if (CARD_DEFS[c.defId]?.type === 'being') {
        beingGroups[c.defId] = beingGroups[c.defId] ?? [];
        beingGroups[c.defId].push(c);
      }
    }
    const tripleGroup = Object.values(beingGroups).find(g => g.length >= 3);
    if (tripleGroup && target && tripleGroup.some(c => c.id === target)) {
      // AoE: deal spike damage to all beings in the group except the target being
      for (const c of tripleGroup) {
        if (c.id !== target) {
          next = dealDamageToTarget(next, uid, c.id, 4);
        }
      }
      next = addLog(next, `Spike AoE ritual: hit all ${CARD_DEFS[tripleGroup[0].defId]?.name ?? 'beings'} except one!`);
    } else {
      next = dealDamageToTarget(next, uid, target, 4);
    }
    // Apply boost (from cancel/cancel/spike stack ritual) if flagged in log (handled in checkStackRituals)
  } else if (def.spellType === 'cancel') {
    // Check 5+ yard ritual: exile opponent's yard instead of countering
    if (ps.yard.length >= 5 && next.stack.length > 0) {
      const oppUid2 = state.player1 === uid ? state.player2 : state.player1;
      const oppPs2 = getOpponentState(next, uid);
      const exiled2 = [...oppPs2.exile, ...oppPs2.yard];
      next = setPlayerState(next, oppUid2, { ...oppPs2, yard: [], exile: exiled2 });
      // Also counter top of stack (normal cancel behavior)
      const stackCopy2 = [...next.stack];
      if (stackCopy2.length > 0) {
        const countered2 = stackCopy2.pop()!;
        next = { ...next, stack: stackCopy2 };
        const counteredOwnerPs2 = getPlayerState(next, countered2.playerId);
        const cLimboIdx2 = counteredOwnerPs2.limbo.findIndex(c => c.id === countered2.cardInstanceId);
        if (cLimboIdx2 !== -1) {
          const limbo2 = [...counteredOwnerPs2.limbo];
          const card2 = limbo2.splice(cLimboIdx2, 1)[0];
          const yard2 = [...counteredOwnerPs2.yard, card2];
          next = setPlayerState(next, countered2.playerId, { ...counteredOwnerPs2, limbo: limbo2, yard: yard2 });
        }
        const ritualMsg = `🚫 5-YARD RITUAL: Exiled opponent's graveyard & countered ${CARD_DEFS[countered2.cardDefId]?.name ?? 'unknown'}!`;
        next = addLog(next, ritualMsg);
        next = { ...next, pendingRitualPopup: ritualMsg };
      }
    } else if (next.stack.length > 0) {
      const stackCopy = [...next.stack];
      const countered = stackCopy.pop()!;
      next = { ...next, stack: stackCopy };

      const counteredOwnerPs = getPlayerState(next, countered.playerId);
      const cLimboIdx = counteredOwnerPs.limbo.findIndex(c => c.id === countered.cardInstanceId);
      if (cLimboIdx !== -1) {
        const limbo = [...counteredOwnerPs.limbo];
        const card = limbo.splice(cLimboIdx, 1)[0];
        const yard = [...counteredOwnerPs.yard, card];
        next = setPlayerState(next, countered.playerId, { ...counteredOwnerPs, limbo, yard });
      }
      const counteredDef = CARD_DEFS[countered.cardDefId];
      next = addLog(next, `Cancel countered ${counteredDef?.name ?? 'unknown'}.`);
    }
  } else if (def.spellType === 'grow') {
    const psGrow = getPlayerState(next, uid);
    const landscapeIdx = psGrow.deck.findIndex(c => CARD_DEFS[c.defId]?.type === 'landscape');
    if (landscapeIdx !== -1) {
      const deck = [...psGrow.deck];
      const lscape = { ...deck.splice(landscapeIdx, 1)[0], exhausted: true };
      const battlefield = [...psGrow.battlefield, lscape];
      next = setPlayerState(next, uid, { ...psGrow, deck, battlefield, needsNewAncient: true });
      next = checkWinConditions(next);
    }
  }
  return next;
}

function dealDamageToTarget(state: GameState, uid: string, target: string | undefined, damage: number): GameState {
  if (!target) return state;
  const oppUid = state.player1 === uid ? state.player2 : state.player1;
  if (target === 'opponent' || target === oppUid) {
    const opp = getOpponentState(state, uid);
    return setPlayerState(state, oppUid, { ...opp, willPower: Math.max(0, opp.willPower - damage) });
  }
  const opp = getOpponentState(state, uid);
  const cardIdx = opp.battlefield.findIndex(c => c.id === target);
  if (cardIdx !== -1) {
    const battlefield = [...opp.battlefield];
    const card = { ...battlefield[cardIdx], counters: battlefield[cardIdx].counters + damage };
    const def = CARD_DEFS[card.defId];
    if (def?.toughness !== undefined && card.counters >= def.toughness) {
      battlefield.splice(cardIdx, 1);
      const yard = [...opp.yard, card];
      return setPlayerState(state, oppUid, { ...opp, battlefield, yard });
    }
    battlefield[cardIdx] = card;
    return setPlayerState(state, oppUid, { ...opp, battlefield });
  }
  const own = getPlayerState(state, uid);
  const ownCardIdx = own.battlefield.findIndex(c => c.id === target);
  if (ownCardIdx !== -1) {
    const battlefield = [...own.battlefield];
    const card = { ...battlefield[ownCardIdx], counters: battlefield[ownCardIdx].counters + damage };
    const def = CARD_DEFS[card.defId];
    if (def?.toughness !== undefined && card.counters >= def.toughness) {
      battlefield.splice(ownCardIdx, 1);
      const yard = [...own.yard, card];
      return setPlayerState(state, uid, { ...own, battlefield, yard });
    }
    battlefield[ownCardIdx] = card;
    return setPlayerState(state, uid, { ...own, battlefield });
  }
  return state;
}

export function declareAttacker(state: GameState, uid: string, cardId: string): GameState {
  if (state.currentTurn !== uid || state.combatStep !== 'attackers') return state;
  const ps = getPlayerState(state, uid);
  const card = ps.battlefield.find(c => c.id === cardId);
  if (!card) return state;
  const def = CARD_DEFS[card.defId];
  if (!def || def.type !== 'being') return state;
  if (card.exhausted && !def.isFlyer) return state;
  // Wasp must wait one full turn before it can attack
  if (def.id === 'wasp' && card.summonedThisTurn) return state;

  const attackers = [...ps.attackers];
  const idx = attackers.indexOf(cardId);
  if (idx !== -1) {
    attackers.splice(idx, 1);
  } else {
    attackers.push(cardId);
  }
  return setPlayerState(state, uid, { ...ps, attackers });
}

export function declareBlocker(state: GameState, uid: string, blockerId: string, attackerId: string): GameState {
  if (state.currentTurn === uid) return state;
  if (state.combatStep !== 'blocks') return state;
  const ps = getPlayerState(state, uid);
  const blocker = ps.battlefield.find(c => c.id === blockerId);
  if (!blocker || blocker.exhausted) return state;
  const def = CARD_DEFS[blocker.defId];
  if (!def || def.type !== 'being') return state;

  // Cannot block a non-attacking being
  const attackerUid = state.player1 === uid ? state.player2 : state.player1;
  const atkPs = getPlayerState(state, attackerUid);
  if (!atkPs.attackers.includes(attackerId)) return state;

  // Flyers (wasps) can only be blocked by other flyers
  const attackerCard = atkPs.battlefield.find(c => c.id === attackerId);
  const attackerDef = attackerCard ? CARD_DEFS[attackerCard.defId] : null;
  if (attackerDef?.isFlyer && !def.isFlyer) return state;

  const blockers = { ...ps.blockers, [blockerId]: attackerId };
  return setPlayerState(state, uid, { ...ps, blockers });
}

function resolveCombat(state: GameState, mode: 'additive' | 'multiplicative' = 'additive'): GameState {
  const attackerUid = state.currentTurn;
  const defenderUid = state.player1 === attackerUid ? state.player2 : state.player1;
  const atkPs = getPlayerState(state, attackerUid);
  const defPs = getPlayerState(state, defenderUid);

  let newAtkBattlefield = [...atkPs.battlefield];
  let newDefBattlefield = [...defPs.battlefield];
  let newAtkYard = [...atkPs.yard];
  let newDefYard = [...defPs.yard];
  let defWP = defPs.willPower;

  // Collect unblocked attacker powers for combined damage calculation
  const unblockedPowers: number[] = [];

  for (const atkId of atkPs.attackers) {
    const atkCard = newAtkBattlefield.find(c => c.id === atkId);
    if (!atkCard) continue;
    const atkDef = CARD_DEFS[atkCard.defId];
    if (!atkDef) continue;

    const blockersForThis = Object.entries(defPs.blockers)
      .filter(([, aid]) => aid === atkId)
      .map(([bid]) => bid);

    if (blockersForThis.length === 0) {
      // Collect unblocked power for combined damage later
      unblockedPowers.push(atkDef.power ?? 0);
    } else {
      // Accumulate all blocker damage to the attacker, then apply once
      let totalAtkCounters = atkCard.counters ?? 0;

      for (const blkId of blockersForThis) {
        const blkIdx = newDefBattlefield.findIndex(c => c.id === blkId);
        if (blkIdx === -1) continue;
        const blkCard = newDefBattlefield[blkIdx];
        const blkDef = CARD_DEFS[blkCard.defId];
        if (!blkDef) continue;

        // Each blocker receives the attacker's full power as damage
        const blkCounters = (blkCard.counters ?? 0) + (atkDef.power ?? 0);
        // Accumulate this blocker's power against the attacker
        totalAtkCounters += (blkDef.power ?? 0);

        if (blkDef.toughness !== undefined && blkCounters >= blkDef.toughness) {
          newDefYard.push({ ...blkCard, counters: blkCounters });
          newDefBattlefield.splice(blkIdx, 1);
        } else {
          newDefBattlefield[blkIdx] = { ...blkCard, counters: blkCounters };
        }
      }

      // Apply accumulated blocker damage to the attacker after all blockers resolve
      const atkIdx = newAtkBattlefield.findIndex(c => c.id === atkId);
      if (atkIdx !== -1) {
        if (atkDef.toughness !== undefined && totalAtkCounters >= atkDef.toughness) {
          newAtkYard.push({ ...atkCard, counters: totalAtkCounters });
          newAtkBattlefield.splice(atkIdx, 1);
        } else {
          newAtkBattlefield[atkIdx] = { ...atkCard, counters: totalAtkCounters };
        }
      }
    }
  }

  // Apply unblocked damage using the chosen mode
  if (unblockedPowers.length > 0) {
    let unblockedDamage: number;
    if (mode === 'multiplicative') {
      unblockedDamage = unblockedPowers.reduce((acc, p) => acc * p, 1);
    } else {
      unblockedDamage = unblockedPowers.reduce((acc, p) => acc + p, 0);
    }
    defWP = Math.max(0, defWP - unblockedDamage);
  }

  newAtkBattlefield = newAtkBattlefield.map(c => {
    if (atkPs.attackers.includes(c.id)) {
      const def = CARD_DEFS[c.defId];
      if (!def?.isFlyer) return { ...c, exhausted: true };
    }
    return c;
  });

  let next = setPlayerState(state, attackerUid, {
    ...atkPs,
    battlefield: newAtkBattlefield,
    yard: newAtkYard,
    attackers: [],
    blockers: {}
  });
  next = setPlayerState(next, defenderUid, {
    ...defPs,
    battlefield: newDefBattlefield,
    yard: newDefYard,
    willPower: defWP,
    blockers: {}
  });
  return checkWinConditions(addLog(next, 'Combat resolved.'));
}

// Resolve the pending damage mode choice made by the attacking player at the start of damage
export function chooseCombatDamageMode(state: GameState, uid: string, mode: 'additive' | 'multiplicative'): GameState {
  if (!state.pendingDamageChoice) return state;
  if (state.currentTurn !== uid) return state;

  const withLog = addLog(state, `${uid} chose ${mode} unblocked damage.`);
  const afterDmg = resolveCombat(withLog, mode);
  return resetPriority(
    { ...afterDmg, combatStep: 'none', phase: 'play2', pendingDamageChoice: undefined },
    uid
  );
}

export function sacrificeLandscape(state: GameState, uid: string, cardId: string): GameState {
  const ps = getPlayerState(state, uid);
  const idx = ps.battlefield.findIndex(c => c.id === cardId);
  if (idx === -1) return state;
  const card = ps.battlefield[idx];
  if (CARD_DEFS[card.defId]?.type !== 'landscape') return state;

  const battlefield = [...ps.battlefield];
  battlefield.splice(idx, 1);
  const yard = [...ps.yard, card];
  const willPower = ps.willPower + 1;
  let next = setPlayerState(state, uid, { ...ps, battlefield, yard, willPower });
  next = addLog(next, `${uid} sacrificed a Landscape for 1 WP.`);
  return next;
}

export function useAncient(state: GameState, uid: string, target?: string): GameState {
  if (state.phase !== 'play1' && state.phase !== 'play2') return state;
  if (state.priorityPlayer !== uid) return state;
  const ps = getPlayerState(state, uid);
  if (!ps.ancient || ps.ancient.exhausted) return state;

  const ancientDef = CARD_DEFS[ps.ancient.defId];
  if (!ancientDef) return state;

  const oppUid = state.player1 === uid ? state.player2 : state.player1;

  let next = setPlayerState(state, uid, {
    ...ps,
    ancient: { ...ps.ancient, exhausted: true }
  });

  switch (ancientDef.id) {
    case 'nest_of_swarm': {
      const t1 = makeInstance('insect', uid);
      const t2 = makeInstance('insect', uid);
      const psCur = getPlayerState(next, uid);
      next = setPlayerState(next, uid, {
        ...psCur,
        battlefield: [...psCur.battlefield, t1, t2]
      });
      break;
    }
    case 'misty_isle': {
      next = addLog(next, `${uid} used Misty Isle — damage prevented this turn.`);
      break;
    }
    case 'smoldering_volcano': {
      next = dealDamageToTarget(next, uid, target, 3);
      break;
    }
    case 'cavern_of_the_see': {
      if (target) {
        const oppPs = getPlayerState(next, oppUid);
        const idx = oppPs.hand.findIndex(c => c.id === target);
        if (idx !== -1) {
          const newHand = [...oppPs.hand];
          const recycled = newHand.splice(idx, 1)[0];
          const newDeck = shuffle([...oppPs.deck, recycled]);
          next = setPlayerState(next, oppUid, { ...oppPs, hand: newHand, deck: newDeck });
          next = addLog(next, `${uid} used Cavern of the See — opponent recycled a card.`);
        }
      } else {
        next = addLog(next, `${uid} used Cavern of the See.`);
      }
      break;
    }
    case 'field_of_imagination': {
      const psCur = getPlayerState(next, uid);
      const handSize = psCur.hand.length;
      const newDeck = shuffle([...psCur.deck, ...psCur.hand]);
      next = setPlayerState(next, uid, { ...psCur, hand: [], deck: newDeck });
      next = drawCards(next, uid, handSize);
      const isP1 = state.player1 === uid;
      next = isP1
        ? { ...next, p1FieldOfImaginationSacCount: next.p1FieldOfImaginationSacCount + 1 }
        : { ...next, p2FieldOfImaginationSacCount: next.p2FieldOfImaginationSacCount + 1 };
      break;
    }
  }

  next = addLog(next, `${uid} used Ancient: ${ancientDef.name}.`);
  next = { ...next, priorityPlayer: oppUid };
  return checkWinConditions(next);
}

function endTurn(state: GameState): GameState {
  const uid = state.currentTurn;
  const nextUid = state.player1 === uid ? state.player2 : state.player1;

  // Resolve any pending stack items before ending the turn so beings enter the battlefield
  let working = state.stack.length > 0 ? resolveEntireStack(state) : state;

  let next = working;

  const isP1Next = state.player1 === nextUid;
  const newTurnCount = isP1Next
    ? { p1TurnCount: state.p1TurnCount + 1 }
    : { p2TurnCount: state.p2TurnCount + 1 };

  next = resetPriority({
    ...next,
    ...newTurnCount,
    currentTurn: nextUid,
    phase: 'replenish',
    combatStep: 'none',
    pendingDamageChoice: undefined,
    turnNumber: next.turnNumber + 1,
    p1LandscapesThisTurn: state.player1 === nextUid ? 0 : next.p1LandscapesThisTurn,
    p2LandscapesThisTurn: state.player2 === nextUid ? 0 : next.p2LandscapesThisTurn,
    stack: []
  }, nextUid);

  // Clear any lingering attacker/blocker state from both players to prevent
  // stale data from a previous combat round carrying over into the next turn.
  const p1 = state.player1;
  const p2 = state.player2;
  const ps1 = getPlayerState(next, p1);
  const ps2 = getPlayerState(next, p2);
  if (ps1.attackers.length > 0 || Object.keys(ps1.blockers).length > 0) {
    next = setPlayerState(next, p1, { ...ps1, attackers: [], blockers: {} });
  }
  if (ps2.attackers.length > 0 || Object.keys(ps2.blockers).length > 0) {
    next = setPlayerState(next, p2, { ...ps2, attackers: [], blockers: {} });
  }

  // Reset damage (counters) on all beings for both players at end of turn
  const resetDamage = (playerUid: string) => {
    const pps = getPlayerState(next, playerUid);
    const bf = pps.battlefield.map(c => {
      if (CARD_DEFS[c.defId]?.type === 'being' && c.counters > 0) {
        return { ...c, counters: 0 };
      }
      return c;
    });
    next = setPlayerState(next, playerUid, { ...pps, battlefield: bf });
  };
  resetDamage(p1);
  resetDamage(p2);

  next = replenishPhase(next, nextUid);
  // Note: do NOT call drawPhase here — advancePhase(replenish→draw) will handle it.
  // Calling it here would cause a double-draw since the UI auto-advances phases.
  next = addLog(next, `--- Turn ${next.turnNumber}: ${nextUid} ---`);
  return next;
}

function checkWinConditions(state: GameState): GameState {
  // FINAL BLOW: both players at 0 WP simultaneously — last stack card player wins
  if (state.p1State.willPower <= 0 && state.p2State.willPower <= 0) {
    const lastPlayer = state.stackHistoryPlays.length > 0
      ? state.stackHistoryPlays[state.stackHistoryPlays.length - 1].playerId
      : state.currentTurn;
    const msg = `⚡ FINAL BLOW: Both players at 0 WP! ${lastPlayer} wins!`;
    return addLog({ ...state, winner: lastPlayer }, msg);
  }

  const checkPlayer = (uid: string, ps: PlayerGameState): string | undefined => {
    const landscapes = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape').length;
    if (landscapes >= WIN_CONDITION_LANDSCAPES) return uid;

    const opp = getOpponentState(state, uid);
    if (opp.willPower <= 0) return uid;

    const isP1 = state.player1 === uid;
    const foiCount = isP1 ? state.p1FieldOfImaginationSacCount : state.p2FieldOfImaginationSacCount;
    if (foiCount >= WIN_CONDITION_FOI_SAC) return uid;

    return undefined;
  };

  const winner = checkPlayer(state.player1, state.p1State)
    ?? checkPlayer(state.player2, state.p2State);

  if (winner) {
    return addLog({ ...state, winner }, `${winner} WINS!`);
  }
  return state;
}

export function sacrificeAncient(state: GameState, uid: string): GameState {
  const ps = getPlayerState(state, uid);
  if (!ps.ancient) return state;
  const yard = [...ps.yard, ps.ancient];
  let next = setPlayerState(state, uid, { ...ps, ancient: null, yard });
  next = addLog(next, `${uid} sacrificed their Ancient.`);
  return next;
}

// RITUAL ZONE: cards can be dragged here; matched sequences trigger effects
export function addToRitualZone(state: GameState, uid: string, cardId: string): GameState {
  const ps = getPlayerState(state, uid);
  const bfIdx = ps.battlefield.findIndex(c => c.id === cardId);
  if (bfIdx === -1) return state;
  const card = ps.battlefield[bfIdx];
  const cardDef = CARD_DEFS[card.defId];
  if (!cardDef) return state;
  // Allow landscapes and beings from battlefield into ritual zone
  if (cardDef.type !== 'landscape' && cardDef.type !== 'being') return state;

  const battlefield = [...ps.battlefield];
  battlefield.splice(bfIdx, 1);
  const ritualZone = [...ps.ritualZone, card];
  let next = setPlayerState(state, uid, { ...ps, battlefield, ritualZone });
  next = addLog(next, `${uid} placed ${cardDef.name} in the Ritual Zone (${ritualZone.length} card(s)).`);
  return processRitual(next, uid);
}

// Add a spell from hand to the ritual zone
export function addSpellToRitualZone(state: GameState, uid: string, cardId: string): GameState {
  const ps = getPlayerState(state, uid);
  const handIdx = ps.hand.findIndex(c => c.id === cardId);
  if (handIdx === -1) return state;
  const card = ps.hand[handIdx];
  const cardDef = CARD_DEFS[card.defId];
  if (!cardDef || cardDef.type !== 'spell') return state;

  const hand = [...ps.hand];
  hand.splice(handIdx, 1);
  const ritualZone = [...ps.ritualZone, card];
  let next = setPlayerState(state, uid, { ...ps, hand, ritualZone });
  next = addLog(next, `${uid} placed ${cardDef.name} in the Ritual Zone (${ritualZone.length} card(s)).`);
  return processRitual(next, uid);
}

export function removeFromRitualZone(state: GameState, uid: string, cardId: string): GameState {
  const ps = getPlayerState(state, uid);
  const rzIdx = ps.ritualZone.findIndex(c => c.id === cardId);
  if (rzIdx === -1) return state;
  const ritualZone = [...ps.ritualZone];
  const card = ritualZone.splice(rzIdx, 1)[0];
  // Return the landscape to the battlefield in an unexhausted state (intentional)
  const battlefield = [...ps.battlefield, { ...card, exhausted: false }];
  let next = setPlayerState(state, uid, { ...ps, battlefield, ritualZone });
  next = addLog(next, `${uid} returned a Landscape from the Ritual Zone to the battlefield.`);
  return next;
}

// ─── Ritual Sequence Definitions ────────────────────────────────────────────

interface RitualRequirement {
  cardType?: string;
  spellType?: string;
  defId?: string;
  isFlyer?: boolean;
  exactPower?: number;
}

interface ActionRitualDef {
  name: string;
  sequence: RitualRequirement[];
  yardCondition?: (ps: PlayerGameState) => boolean;
}

// Helper: check if a card instance matches a ritual requirement
function matchesRitualEntry(card: CardInstance, req: RitualRequirement): boolean {
  const def = CARD_DEFS[card.defId];
  if (!def) return false;
  if (req.defId !== undefined && card.defId !== req.defId) return false;
  if (req.cardType !== undefined && def.type !== req.cardType) return false;
  if (req.spellType !== undefined && def.spellType !== req.spellType) return false;
  if (req.isFlyer !== undefined && !!def.isFlyer !== req.isFlyer) return false;
  if (req.exactPower !== undefined && def.power !== req.exactPower) return false;
  return true;
}

const ACTION_RITUAL_DEFS: ActionRitualDef[] = [
  {
    name: 'Landscape Draw',
    sequence: [{ cardType: 'landscape' }, { cardType: 'landscape' }],
  },
  {
    name: 'Ignite Surge',
    // landscape/landscape/being_two/ignite → ignite deals +1 damage
    sequence: [
      { cardType: 'landscape' },
      { cardType: 'landscape' },
      { defId: 'merfolk' },
      { cardType: 'spell', spellType: 'ignite' },
    ],
  },
  {
    name: 'Primal Ignite',
    // landscape/landscape/being_one/being_one/ignite → ignite deals +1 damage
    sequence: [
      { cardType: 'landscape' },
      { cardType: 'landscape' },
      { defId: 'insect' },
      { defId: 'insect' },
      { cardType: 'spell', spellType: 'ignite' },
    ],
  },
  {
    name: 'Flock Control',
    // two flyers → gain control of target being, draw a card
    sequence: [
      { cardType: 'being', isFlyer: true },
      { cardType: 'being', isFlyer: true },
    ],
  },
  {
    name: 'Void Cancel',
    // cancel when yard >= 5 → exile opponent's yard
    sequence: [{ cardType: 'spell', spellType: 'cancel' }],
    yardCondition: (ps: PlayerGameState) => ps.yard.length >= 5,
  },
];

// Return ritual names whose sequence is a prefix-match of the current ritual zone
export function getPartialRitualMatches(rz: CardInstance[]): string[] {
  if (rz.length === 0) return [];
  return ACTION_RITUAL_DEFS
    .filter(r => {
      if (rz.length >= r.sequence.length) return false; // complete (not partial)
      return r.sequence.slice(0, rz.length).every((req, i) => matchesRitualEntry(rz[i], req));
    })
    .map(r => r.name);
}

// Check if a card would be valid as the next card in the ritual zone
export function isCardValidForRitualZone(state: GameState, uid: string, card: CardInstance): boolean {
  const ps = getPlayerState(state, uid);
  const pos = ps.ritualZone.length;
  for (const ritual of ACTION_RITUAL_DEFS) {
    if (pos >= ritual.sequence.length) continue;
    // Current ritual zone must match the first `pos` positions of this ritual
    const prefixMatch = ritual.sequence.slice(0, pos).every((req, i) => matchesRitualEntry(ps.ritualZone[i], req));
    if (!prefixMatch) continue;
    // Card must match position `pos`
    if (matchesRitualEntry(card, ritual.sequence[pos])) return true;
  }
  return false;
}

function processRitual(state: GameState, uid: string): GameState {
  const ps = getPlayerState(state, uid);
  const rz = ps.ritualZone;
  if (rz.length === 0) return state;

  for (const ritual of ACTION_RITUAL_DEFS) {
    if (rz.length < ritual.sequence.length) continue;
    const matches = ritual.sequence.every((req, i) => matchesRitualEntry(rz[i], req));
    if (!matches) continue;
    if (ritual.yardCondition && !ritual.yardCondition(ps)) continue;

    // Ritual fires — consume the used cards from ritual zone
    const usedCards = rz.slice(0, ritual.sequence.length);
    const remaining = rz.slice(ritual.sequence.length);
    const newYard = [...ps.yard, ...usedCards];

    let next = setPlayerState(state, uid, { ...ps, ritualZone: remaining, yard: newYard });

    switch (ritual.name) {
      case 'Landscape Draw': {
        next = drawCards(next, uid, 1);
        const msg = '🌿 LANDSCAPE RITUAL: Sacrificed 2 landscapes, drew 1 card!';
        next = addLog(next, `${uid} completed Landscape Draw ritual.`);
        next = { ...next, pendingRitualPopup: msg };
        break;
      }
      case 'Ignite Surge':
      case 'Primal Ignite': {
        // Fire ignite for 3 damage (2+1 boost) — needs target selection
        const msg = `🔥 ${ritual.name.toUpperCase()}: Ignite charges with +1 bonus damage! Choose a target.`;
        next = addLog(next, `${uid} completed ${ritual.name} ritual — ritual ignite pending!`);
        next = {
          ...next,
          pendingRitualTarget: { ritualName: ritual.name, uid, igniteBoost: 1 },
          pendingRitualPopup: msg,
        };
        break;
      }
      case 'Flock Control': {
        // Gain control of target being — needs target selection
        const msg = '🦅 FLOCK CONTROL: Sacrifice two flyers — choose an opponent being to gain control of!';
        next = addLog(next, `${uid} completed Flock Control ritual — target selection pending!`);
        next = {
          ...next,
          pendingRitualTarget: { ritualName: 'Flock Control', uid },
          pendingRitualPopup: msg,
        };
        break;
      }
      case 'Void Cancel': {
        // Exile opponent's yard
        const oppUid = state.player1 === uid ? state.player2 : state.player1;
        const oppPs = getOpponentState(next, uid);
        const exiled = [...oppPs.exile, ...oppPs.yard];
        next = setPlayerState(next, oppUid, { ...oppPs, yard: [], exile: exiled });
        const voidMsg = '🚫 VOID CANCEL: 5-card yard threshold met — opponent\'s graveyard exiled!';
        next = addLog(next, `${uid} completed Void Cancel — exiled opponent's yard.`);
        next = { ...next, pendingRitualPopup: voidMsg };
        break;
      }
    }
    return next;
  }

  return state;
}

// ─── Resolve pending ritual target (ignite / flock control) ─────────────────

export function resolveRitualTarget(state: GameState, uid: string, target: string): GameState {
  const ritual = state.pendingRitualTarget;
  if (!ritual || ritual.uid !== uid) return state;

  let next: GameState = { ...state, pendingRitualTarget: undefined };

  if (ritual.ritualName === 'Ignite Surge' || ritual.ritualName === 'Primal Ignite') {
    const boost = ritual.igniteBoost ?? 1;
    const damage = 2 + boost;
    next = dealDamageToTarget(next, uid, target, damage);
    next = addLog(next, `${uid} Ritual Ignite deals ${damage} damage to target!`);
  } else if (ritual.ritualName === 'Flock Control') {
    const oppUid = state.player1 === uid ? state.player2 : state.player1;
    const oppPs = getOpponentState(next, uid);
    const cardIdx = oppPs.battlefield.findIndex(c => c.id === target);
    if (cardIdx !== -1) {
      const card = { ...oppPs.battlefield[cardIdx], owner: uid };
      const newOppBf = [...oppPs.battlefield];
      newOppBf.splice(cardIdx, 1);
      next = setPlayerState(next, oppUid, { ...oppPs, battlefield: newOppBf });
      const myPs = getPlayerState(next, uid);
      next = setPlayerState(next, uid, { ...myPs, battlefield: [...myPs.battlefield, card] });
      next = drawCards(next, uid, 1);
      next = addLog(next, `${uid} gained control of ${CARD_DEFS[card.defId]?.name ?? 'being'} and drew a card!`);
    }
  }
  return checkWinConditions(next);
}

// ─── Stack Ritual Detection ──────────────────────────────────────────────────

interface StackRitualDef {
  name: string;
  sequence: Array<{ defId?: string; spellType?: string; isFlyer?: boolean; exactPower?: number; anyPlayer?: boolean }>;
  requiresDifferentPlayers?: boolean; // e.g. grow/grow from different players
}

function matchesStackEntry(
  entry: { defId: string; playerId: string },
  req: { defId?: string; spellType?: string; isFlyer?: boolean; exactPower?: number }
): boolean {
  const def = CARD_DEFS[entry.defId];
  if (!def) return false;
  if (req.defId !== undefined && entry.defId !== req.defId) return false;
  if (req.spellType !== undefined && def.spellType !== req.spellType) return false;
  if (req.isFlyer !== undefined && !!def.isFlyer !== req.isFlyer) return false;
  if (req.exactPower !== undefined && def.power !== req.exactPower) return false;
  return true;
}

const STACK_RITUAL_DEFS: StackRitualDef[] = [
  {
    name: 'Double Cancel Spike',
    // cancel/cancel/spike → +2 damage from spike
    sequence: [{ spellType: 'cancel' }, { spellType: 'cancel' }, { spellType: 'spike' }],
  },
  {
    name: 'Power Summon',
    // being power 5 / spike / grow → create a being_two token
    sequence: [{ exactPower: 5 }, { spellType: 'spike' }, { spellType: 'grow' }],
  },
  {
    name: 'Flame Wave',
    // ignite/ignite/grow → destroy target player's non-ancient landscape
    sequence: [{ spellType: 'ignite' }, { spellType: 'ignite' }, { spellType: 'grow' }],
  },
  {
    name: 'Storm Flyer',
    // flyer/cancel/ignite → create a 3/1 flyer token
    sequence: [{ isFlyer: true }, { spellType: 'cancel' }, { spellType: 'ignite' }],
  },
  {
    name: 'Ancient Stasis',
    // grow/grow from different players → negate re-selecting ancient
    sequence: [{ spellType: 'grow' }, { spellType: 'grow' }],
    requiresDifferentPlayers: true,
  },
  {
    name: 'Knowledge Draw',
    // grow/cancel → each player draws a card
    sequence: [{ spellType: 'grow' }, { spellType: 'cancel' }],
  },
];

function findStackRitual(
  history: Array<{ defId: string; playerId: string }>
): StackRitualDef | null {
  if (history.length < 2) return null;

  for (const ritual of STACK_RITUAL_DEFS) {
    const seqLen = ritual.sequence.length;
    if (history.length < seqLen) continue;

    // Check every window of the correct length
    for (let start = 0; start <= history.length - seqLen; start++) {
      const window = history.slice(start, start + seqLen);
      const matches = ritual.sequence.every((req, i) => matchesStackEntry(window[i], req));
      if (!matches) continue;

      if (ritual.requiresDifferentPlayers) {
        const players = new Set(window.map(e => e.playerId));
        if (players.size < 2) continue;
      }
      return ritual;
    }
  }
  return null;
}

function checkStackRituals(
  state: GameState,
  history: Array<{ defId: string; playerId: string }>
): GameState {
  const ritual = findStackRitual(history);
  if (!ritual) return state;

  let next = state;
  const p1 = state.player1;
  const p2 = state.player2;

  switch (ritual.name) {
    case 'Double Cancel Spike': {
      // +2 spike damage → apply 2 extra damage to whoever spike was targeting
      // We don't know the original target easily, so award +2 WP damage to opponent of spike caster
      const spikePlays = history.filter(e => CARD_DEFS[e.defId]?.spellType === 'spike');
      if (spikePlays.length > 0) {
        const spikeCaster = spikePlays[spikePlays.length - 1].playerId;
        const spikeOpp = spikeCaster === p1 ? p2 : p1;
        const oppPs = getPlayerState(next, spikeOpp);
        next = setPlayerState(next, spikeOpp, { ...oppPs, willPower: Math.max(0, oppPs.willPower - 2) });
        const msg = '⚡ DOUBLE CANCEL SPIKE: Spike deals +2 bonus damage!';
        next = addLog(next, msg);
        next = { ...next, pendingRitualPopup: msg };
      }
      break;
    }
    case 'Power Summon': {
      // Create a merfolk (being_2) token for the grow caster
      const growPlays = history.filter(e => CARD_DEFS[e.defId]?.spellType === 'grow');
      if (growPlays.length > 0) {
        const growCaster = growPlays[growPlays.length - 1].playerId;
        const token = makeInstance('merfolk', growCaster);
        const casterPs = getPlayerState(next, growCaster);
        next = setPlayerState(next, growCaster, { ...casterPs, battlefield: [...casterPs.battlefield, token] });
        const msg = '⭐ POWER SUMMON: A Merfolk token enters the battlefield!';
        next = addLog(next, msg);
        next = { ...next, pendingRitualPopup: msg };
      }
      break;
    }
    case 'Flame Wave': {
      // Destroy target player's non-ancient landscape
      // Remove the first non-ancient landscape from the opponent of the grow caster
      const growPlaysF = history.filter(e => CARD_DEFS[e.defId]?.spellType === 'grow');
      if (growPlaysF.length > 0) {
        const growCasterF = growPlaysF[growPlaysF.length - 1].playerId;
        const targetUid = growCasterF === p1 ? p2 : p1;
        const targetPs = getPlayerState(next, targetUid);
        const lIdx = targetPs.battlefield.findIndex(c => CARD_DEFS[c.defId]?.type === 'landscape');
        if (lIdx !== -1) {
          const bf = [...targetPs.battlefield];
          const land = bf.splice(lIdx, 1)[0];
          const yard = [...targetPs.yard, land];
          next = setPlayerState(next, targetUid, { ...targetPs, battlefield: bf, yard });
        }
        const msg = '🔥 FLAME WAVE: Opponent\'s landscape is destroyed!';
        next = addLog(next, msg);
        next = { ...next, pendingRitualPopup: msg };
      }
      break;
    }
    case 'Storm Flyer': {
      // Create a 3/1 flyer token for the ignite caster
      const ignitePlays = history.filter(e => CARD_DEFS[e.defId]?.spellType === 'ignite');
      if (ignitePlays.length > 0) {
        const igniteCaster = ignitePlays[ignitePlays.length - 1].playerId;
        const token = makeInstance('flyer_token', igniteCaster);
        const casterPs = getPlayerState(next, igniteCaster);
        next = setPlayerState(next, igniteCaster, { ...casterPs, battlefield: [...casterPs.battlefield, token] });
        const msg = '⚡ STORM FLYER: A 3/1 flyer token enters the battlefield!';
        next = addLog(next, msg);
        next = { ...next, pendingRitualPopup: msg };
      }
      break;
    }
    case 'Ancient Stasis': {
      // Negate re-selecting ancients for both players this round
      const ps1 = getPlayerState(next, p1);
      const ps2 = getPlayerState(next, p2);
      next = setPlayerState(next, p1, { ...ps1, needsNewAncient: false });
      next = setPlayerState(next, p2, { ...ps2, needsNewAncient: false });
      const msg = '🌀 ANCIENT STASIS: Both Grow spells cancel — neither player re-selects their Ancient!';
      next = addLog(next, msg);
      next = { ...next, pendingRitualPopup: msg };
      break;
    }
    case 'Knowledge Draw': {
      // Each player draws a card
      next = drawCards(next, p1, 1);
      next = drawCards(next, p2, 1);
      const msg = '📖 KNOWLEDGE DRAW: Grow + Cancel ritual — each player draws a card!';
      next = addLog(next, msg);
      next = { ...next, pendingRitualPopup: msg };
      break;
    }
  }

  return checkWinConditions(next);
}

// ─── Global Ritual Actions ───────────────────────────────────────────────────

// CULTIVATE: sacrifice beings with total power equal to a yard being to summon it exhausted
export function cultivate(
  state: GameState, uid: string, yardBeingId: string, sacrificeIds: string[]
): GameState {
  if (state.phase !== 'play1' && state.phase !== 'play2') return state;
  if (state.currentTurn !== uid) return state;

  const ps = getPlayerState(state, uid);
  const yardIdx = ps.yard.findIndex(c => c.id === yardBeingId);
  if (yardIdx === -1) return state;
  const yardBeing = ps.yard[yardIdx];
  const yardBeingDef = CARD_DEFS[yardBeing.defId];
  if (!yardBeingDef || yardBeingDef.type !== 'being') return state;

  const targetPower = yardBeingDef.power ?? 0;

  const sacrificed = sacrificeIds
    .map(id => ps.battlefield.find(c => c.id === id))
    .filter(Boolean) as CardInstance[];
  if (sacrificed.length !== sacrificeIds.length) return state;
  if (!sacrificed.every(c => CARD_DEFS[c.defId]?.type === 'being')) return state;

  // Total sacrificed power must equal the yard being's power
  const sacrificedPower = sacrificed.reduce((s, c) => s + (CARD_DEFS[c.defId]?.power ?? 0), 0);
  if (sacrificedPower !== targetPower) return state;

  const battlefield = ps.battlefield.filter(c => !sacrificeIds.includes(c.id));
  let newYard = [...ps.yard];
  newYard.splice(newYard.findIndex(c => c.id === yardBeingId), 1);
  newYard = [...newYard, ...sacrificed];

  const summonedBeing: CardInstance = { ...yardBeing, exhausted: true, summonedThisTurn: true, counters: 0 };
  let next = setPlayerState(state, uid, {
    ...ps, battlefield: [...battlefield, summonedBeing], yard: newYard
  });
  const msg = `🌱 CULTIVATE: ${yardBeingDef.name} summoned from yard (exhausted, cannot attack)!`;
  next = addLog(next, msg);
  next = { ...next, pendingRitualPopup: msg };
  return checkWinConditions(next);
}

// STUDY: cast a spell from yard by sacrificing beings/landscapes; player takes double WP damage; exile spell
export function study(
  state: GameState, uid: string, yardSpellId: string, sacrificeIds: string[], target?: string
): GameState {
  if (state.phase !== 'play1' && state.phase !== 'play2') return state;
  if (state.currentTurn !== uid) return state;

  const ps = getPlayerState(state, uid);
  const yardIdx = ps.yard.findIndex(c => c.id === yardSpellId);
  if (yardIdx === -1) return state;
  const yardSpell = ps.yard[yardIdx];
  const spellDef = CARD_DEFS[yardSpell.defId];
  if (!spellDef || spellDef.type !== 'spell') return state;

  const spellCost = spellDef.cost ?? 0;

  const sacrificed = sacrificeIds
    .map(id => ps.battlefield.find(c => c.id === id))
    .filter(Boolean) as CardInstance[];
  if (sacrificed.length !== sacrificeIds.length) return state;
  if (sacrificed.length < spellCost) return state;

  const battlefield = ps.battlefield.filter(c => !sacrificeIds.includes(c.id));
  let newYard = [...ps.yard];
  newYard.splice(newYard.findIndex(c => c.id === yardSpellId), 1);
  newYard = [...newYard, ...sacrificed];
  const exile = [...ps.exile, yardSpell];

  // Double WP damage
  const damage = 2 * spellCost;
  const newWP = Math.max(0, ps.willPower - damage);

  let next = setPlayerState(state, uid, {
    ...ps, battlefield, yard: newYard, exile, willPower: newWP
  });

  // Resolve the spell effect
  next = resolveSpellEffect(next, uid, yardSpell.defId, target);

  const msg = `📚 STUDY: ${spellDef.name} cast from yard! ${uid} takes ${damage} WP damage (spell exiled).`;
  next = addLog(next, msg);
  next = { ...next, pendingRitualPopup: msg };
  return checkWinConditions(next);
}

// EVOLVE: spend WP ≤ landscape count, transform one landscape into a WP/WP-2 being
export function evolve(
  state: GameState, uid: string, wpToSpend: number, landscapeId: string
): GameState {
  if (state.phase !== 'play1' && state.phase !== 'play2') return state;
  if (state.currentTurn !== uid) return state;

  const ps = getPlayerState(state, uid);
  const landscapes = ps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'landscape');
  if (wpToSpend > landscapes.length || wpToSpend <= 0) return state;
  if (wpToSpend > ps.willPower) return state;

  const lIdx = ps.battlefield.findIndex(c => c.id === landscapeId);
  if (lIdx === -1) return state;
  if (CARD_DEFS[ps.battlefield[lIdx].defId]?.type !== 'landscape') return state;

  const evolvedDefId = `evolved_${wpToSpend}`;
  const evolvedCard = makeInstance(evolvedDefId, uid);
  evolvedCard.exhausted = true;
  evolvedCard.summonedThisTurn = true;

  const battlefield = [...ps.battlefield];
  battlefield.splice(lIdx, 1, evolvedCard);
  const t = Math.max(1, wpToSpend - 2);

  let next = setPlayerState(state, uid, {
    ...ps, battlefield, willPower: ps.willPower - wpToSpend
  });
  const msg = `🌀 EVOLVE: Landscape transformed into ${wpToSpend}/${t} being! Spent ${wpToSpend} WP.`;
  next = addLog(next, msg);
  next = { ...next, pendingRitualPopup: msg };
  return checkWinConditions(next);
}

// NOURISH: sacrifice a being to return a landscape from yard to hand
export function nourish(
  state: GameState, uid: string, sacrificeBeingId: string, yardLandscapeId: string
): GameState {
  if (state.phase !== 'play1' && state.phase !== 'play2') return state;
  if (state.currentTurn !== uid) return state;

  const ps = getPlayerState(state, uid);
  const bfIdx = ps.battlefield.findIndex(c => c.id === sacrificeBeingId);
  if (bfIdx === -1) return state;
  const being = ps.battlefield[bfIdx];
  if (CARD_DEFS[being.defId]?.type !== 'being') return state;

  const yardIdx = ps.yard.findIndex(c => c.id === yardLandscapeId);
  if (yardIdx === -1) return state;
  const landscape = ps.yard[yardIdx];
  if (CARD_DEFS[landscape.defId]?.type !== 'landscape') return state;

  const battlefield = [...ps.battlefield];
  battlefield.splice(bfIdx, 1);
  const newYard = [...ps.yard];
  newYard.splice(yardIdx, 1);
  const yardWithBeing = [...newYard, being];
  const hand = [...ps.hand, landscape];

  let next = setPlayerState(state, uid, {
    ...ps, battlefield, yard: yardWithBeing, hand
  });
  const msg = `🌿 NOURISH: ${CARD_DEFS[being.defId]?.name} sacrificed — Landscape returned to hand!`;
  next = addLog(next, msg);
  next = { ...next, pendingRitualPopup: msg };
  return next;
}

// LAST BREATH: if yard >= 10, exile all yard cards and set WP to 1
export function lastBreath(state: GameState, uid: string): GameState {
  if (state.phase !== 'play1' && state.phase !== 'play2') return state;
  if (state.currentTurn !== uid) return state;

  const ps = getPlayerState(state, uid);
  if (ps.yard.length < 10) return state;

  const exile = [...ps.exile, ...ps.yard];
  let next = setPlayerState(state, uid, { ...ps, yard: [], exile, willPower: 1 });
  const msg = '💀 LAST BREATH: Exile your entire yard — WP set to 1. Desperate times!';
  next = addLog(next, msg);
  next = { ...next, pendingRitualPopup: msg };
  return next;
}

// SAC ANCIENT + 2 LANDSCAPES: draw 3 cards, discard 1
export function sacAncientAndLandscapes(
  state: GameState, uid: string, landscapeIds: string[]
): GameState {
  if (state.phase !== 'play1' && state.phase !== 'play2') return state;
  if (state.priorityPlayer !== uid) return state;
  if (landscapeIds.length < 2) return state;

  const ps = getPlayerState(state, uid);
  if (!ps.ancient) return state;

  const lands = landscapeIds
    .map(id => ps.battlefield.find(c => c.id === id))
    .filter(Boolean) as CardInstance[];
  if (lands.length < 2) return state;
  if (!lands.every(c => CARD_DEFS[c.defId]?.type === 'landscape')) return state;

  const battlefield = ps.battlefield.filter(c => !landscapeIds.slice(0, 2).includes(c.id));
  const newYard = [...ps.yard, ps.ancient, ...lands.slice(0, 2)];

  let next = setPlayerState(state, uid, {
    ...ps, battlefield, yard: newYard, ancient: null
  });
  next = drawCards(next, uid, 3);
  // Signal discard-1 via popup — actual discard handled in UI
  const msg = '🌟 ANCIENT SACRIFICE: Drew 3 cards. You must discard 1 card.';
  next = addLog(next, msg);
  next = { ...next, pendingRitualPopup: msg };
  return next;
}
