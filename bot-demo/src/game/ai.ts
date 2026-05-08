/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  WILLOW — Adaptive AI for Scape Bot Demo                                ║
 * ║                                                                          ║
 * ║  Markov-chain learning with Q-value estimation, player pattern           ║
 * ║  recognition, and game-theory heuristics.                                ║
 * ║                                                                          ║
 * ║  Persists learned data in localStorage; exportable / importable.         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  GameState, PlayerGameState, CardInstance,
} from '../types';
import { CARD_DEFS } from './constants';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'willow_ai_model_v1';
const LEARNING_RATE_KEY = 'willow_learning_rate';
const MODEL_VERSION = 1;
const MAX_MODEL_BYTES = 2 * 1024 * 1024; // 2 MB
const DEFAULT_LEARNED_THRESHOLD = 1;     // Minimum visits before pattern extraction
const DEFAULT_LEARNED_REWARD_MIN = 0;    // Minimum avg reward — 0 means any net-positive result is captured
const DISCOUNT_FACTOR = 0.95;            // γ for backward reward propagation
const MAX_LEARNED_PATTERNS = 500;
const PRUNE_MIN_COUNT = 2;               // Transitions below this are pruned first
const PRUNE_AGGRESSIVE_COUNT = 5;        // Second-pass prune threshold

// ─── Electron API type augmentation ──────────────────────────────────────────

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      readModelFile?: () => Promise<string | null>;
      writeModelFile?: (data: string) => Promise<boolean>;
    };
  }
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.readModelFile != null;
}



export type BotAction =
  | 'play_landscape'
  | 'play_being_1' | 'play_being_2' | 'play_being_3' | 'play_being_4' | 'play_being_5'
  | 'play_flyer'
  | 'cast_ignite_being' | 'cast_ignite_opponent'
  | 'cast_spike_being' | 'cast_spike_opponent'
  | 'cast_cancel'
  | 'cast_grow'
  | 'attack_all' | 'attack_selective' | 'no_attack'
  | 'block_all' | 'block_selective' | 'no_block'
  | 'damage_additive' | 'damage_multiplicative'
  | 'respond_cancel' | 'respond_pass'
  | 'use_ancient'
  | 'pass_priority'
  | 'skip'
  // Ritual actions
  | 'ritual_landscape_draw'
  | 'ritual_void_cancel'
  | 'ritual_cultivate'
  | 'ritual_nourish'
  | 'ritual_evolve';

// ─── Internal Types ──────────────────────────────────────────────────────────

type WPBracket = 'critical' | 'low' | 'mid' | 'high';
type HandBracket = 'empty' | 'few' | 'normal' | 'many';
type TempoBracket = 'opening' | 'early' | 'mid' | 'late';
type BoardAdv = 'losing' | 'even' | 'winning';
type YardBracket = 'empty' | 'small' | 'medium' | 'large';

interface CompressedState {
  phase: string;
  combatStep: string;
  tempo: TempoBracket;
  botWP: WPBracket;
  playerWP: WPBracket;
  botPower: number;     // total being power on battlefield (bucketed)
  playerPower: number;
  botLands: number;     // capped at 6
  playerLands: number;
  mana: number;         // available (unexhausted) landscapes, capped
  botHand: HandBracket;
  playerHand: HandBracket;
  stackDepth: number;   // 0, 1, or 2+
  topStackType: string; // '' | 'being' | 'spell_ignite' | 'spell_cancel' etc.
  hasCancel: boolean;
  hasGrow: boolean;
  boardAdv: BoardAdv;
  // Ritual features
  hasRitualProgress: boolean; // any card already in bot's ritual zone
  hasYardBeings: boolean;     // can potentially Cultivate
  hasYardLandscapes: boolean; // can potentially Nourish
  botYard: YardBracket;       // for Void Cancel / Last Breath awareness
}

interface TransitionRecord {
  n: number;       // visit count
  r: number;       // total reward accumulated
  next: Record<string, number>; // next-state hash → count
}

interface LearnedPattern {
  sh: string;       // state hash trigger
  a: BotAction;     // recommended action
  c: number;        // confidence (0-1)
  n: number;        // times extracted / validated
  r: number;        // average reward
}

interface PlayerNGram {
  seq: string;        // joined action sequence
  botResp: BotAction; // what the bot did in response
  n: number;          // count
  r: number;          // total reward
}

interface WillowModel {
  v: number;                    // version
  gp: number;                   // games played
  w: number;                    // wins
  l: number;                    // losses
  // Q-table: stateHash → action → TransitionRecord
  qt: Record<string, Record<string, TransitionRecord>>;
  // Learned high-confidence patterns (the "learned keys")
  lp: LearnedPattern[];
  // Player action n-grams for pattern prediction
  pg: Record<string, PlayerNGram>;
  ts: number;                   // last updated timestamp
  tn: number;                   // total transitions count (for quick size estimate)
}

interface ActionRecord {
  sh: string;       // state hash at decision time
  a: string;        // action taken
  who: 'bot' | 'player';
  imm: number;      // immediate reward signal
}

interface GameRecording {
  actions: ActionRecord[];
  botUid: string;
  playerUid: string;
}

// ─── Helper Utilities ────────────────────────────────────────────────────────

function getPS(gs: GameState, uid: string): PlayerGameState {
  return gs.p1State.uid === uid ? gs.p1State : gs.p2State;
}

function getOppPS(gs: GameState, uid: string): PlayerGameState {
  return gs.p1State.uid === uid ? gs.p2State : gs.p1State;
}

function discretizeWP(wp: number): WPBracket {
  if (wp <= 5) return 'critical';
  if (wp <= 12) return 'low';
  if (wp <= 20) return 'mid';
  return 'high';
}

function discretizeHand(size: number): HandBracket {
  if (size === 0) return 'empty';
  if (size <= 2) return 'few';
  if (size <= 5) return 'normal';
  return 'many';
}

function getTempo(turnNumber: number): TempoBracket {
  if (turnNumber <= 2) return 'opening';
  if (turnNumber <= 5) return 'early';
  if (turnNumber <= 10) return 'mid';
  return 'late';
}

function totalPower(bf: CardInstance[]): number {
  let p = 0;
  for (const c of bf) {
    const def = CARD_DEFS[c.defId];
    if (def?.type === 'being') p += (def.power ?? 0) + c.counters;
  }
  return p;
}

function bucketPower(p: number): number {
  if (p <= 0) return 0;
  if (p <= 3) return 1;
  if (p <= 7) return 2;
  if (p <= 12) return 3;
  return 4;
}

function countAvailableMana(ps: PlayerGameState): number {
  let m = 0;
  for (const c of ps.battlefield) {
    if (CARD_DEFS[c.defId]?.type === 'landscape' && !c.exhausted) m++;
  }
  return Math.min(m, 6);
}

function countLandscapes(ps: PlayerGameState): number {
  let n = 0;
  for (const c of ps.battlefield) {
    if (CARD_DEFS[c.defId]?.type === 'landscape') n++;
  }
  return Math.min(n, 6);
}

function boardAdvantage(botPower: number, playerPower: number): BoardAdv {
  const diff = botPower - playerPower;
  if (diff >= 3) return 'winning';
  if (diff <= -3) return 'losing';
  return 'even';
}

function topStackType(gs: GameState): string {
  if (gs.stack.length === 0) return '';
  const top = gs.stack[gs.stack.length - 1];
  const def = CARD_DEFS[top.cardDefId];
  if (!def) return '';
  if (def.type === 'being') return 'being';
  if (def.type === 'spell') return `spell_${def.spellType ?? 'unknown'}`;
  return def.type;
}

function hasCardType(hand: CardInstance[], spellType: string): boolean {
  return hand.some(c => CARD_DEFS[c.defId]?.spellType === spellType);
}

// ─── State Compression & Hashing ─────────────────────────────────────────────

function discretizeYard(size: number): YardBracket {
  if (size === 0) return 'empty';
  if (size <= 3) return 'small';
  if (size <= 7) return 'medium';
  return 'large';
}

function compressState(gs: GameState, botUid: string): CompressedState {
  const bps = getPS(gs, botUid);
  const pps = getOppPS(gs, botUid);

  const bp = totalPower(bps.battlefield);
  const pp = totalPower(pps.battlefield);

  return {
    phase: gs.phase,
    combatStep: gs.combatStep,
    tempo: getTempo(gs.turnNumber),
    botWP: discretizeWP(bps.willPower),
    playerWP: discretizeWP(pps.willPower),
    botPower: bucketPower(bp),
    playerPower: bucketPower(pp),
    botLands: countLandscapes(bps),
    playerLands: countLandscapes(pps),
    mana: countAvailableMana(bps),
    botHand: discretizeHand(bps.hand.length),
    playerHand: discretizeHand(pps.hand.length),
    stackDepth: Math.min(gs.stack.length, 2),
    topStackType: topStackType(gs),
    hasCancel: hasCardType(bps.hand, 'cancel'),
    hasGrow: hasCardType(bps.hand, 'grow'),
    boardAdv: boardAdvantage(bp, pp),
    hasRitualProgress: bps.ritualZone.length > 0,
    hasYardBeings: bps.yard.some(c => CARD_DEFS[c.defId]?.type === 'being'),
    hasYardLandscapes: bps.yard.some(c => CARD_DEFS[c.defId]?.type === 'landscape'),
    botYard: discretizeYard(bps.yard.length),
  };
}

function hashState(cs: CompressedState): string {
  return [
    cs.phase, cs.combatStep, cs.tempo,
    cs.botWP, cs.playerWP,
    cs.botPower, cs.playerPower,
    cs.botLands, cs.playerLands, cs.mana,
    cs.botHand, cs.playerHand,
    cs.stackDepth, cs.topStackType,
    cs.hasCancel ? 1 : 0, cs.hasGrow ? 1 : 0,
    cs.boardAdv,
    cs.hasRitualProgress ? 1 : 0,
    cs.hasYardBeings ? 1 : 0, cs.hasYardLandscapes ? 1 : 0,
    cs.botYard,
  ].join('|');
}

// ─── Heuristic Priors (fallback Q-values when no data) ──────────────────────

const HEURISTIC_PRIORS: Partial<Record<BotAction, number>> = {
  play_landscape: 0.35,
  play_being_1: 0.15,
  play_being_2: 0.25,
  play_being_3: 0.30,
  play_being_4: 0.35,
  play_being_5: 0.40,
  play_flyer: 0.38,
  cast_ignite_being: 0.35,
  cast_ignite_opponent: 0.20,
  cast_spike_being: 0.32,
  cast_spike_opponent: 0.18,
  cast_cancel: 0.10,   // proactive cancel is bad; save for response
  cast_grow: 0.25,
  attack_all: 0.25,
  attack_selective: 0.20,
  no_attack: 0.05,
  block_all: 0.30,
  block_selective: 0.25,
  no_block: 0.05,
  damage_additive: 0.20,
  damage_multiplicative: 0.20,
  respond_cancel: 0.45,
  respond_pass: 0.10,
  use_ancient: 0.30,
  pass_priority: 0.05,
  skip: 0.0,
  // Ritual actions — generally high value when conditions are met
  ritual_landscape_draw: 0.45,
  ritual_void_cancel: 0.40,
  ritual_cultivate: 0.38,
  ritual_nourish: 0.30,
  ritual_evolve: 0.28,
};

// ─── Default Model ───────────────────────────────────────────────────────────

function createDefaultModel(): WillowModel {
  return {
    v: MODEL_VERSION,
    gp: 0,
    w: 0,
    l: 0,
    qt: {},
    lp: [],
    pg: {},
    ts: Date.now(),
    tn: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WillowAI — Main Class
// ═══════════════════════════════════════════════════════════════════════════════

export class WillowAI {
  private model: WillowModel;
  private recording: GameRecording | null = null;


  constructor() {
    this.model = this.loadFromStorage() ?? createDefaultModel();
  }

  // ── Learning Rate (static, stored in localStorage) ─────────────────────────

  /** Get learning rate 0..1 (0 = cautious / slow, 1 = aggressive / fast) */
  static getLearningRate(): number {
    try {
      const v = parseFloat(localStorage.getItem(LEARNING_RATE_KEY) ?? '');
      if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
    } catch { /* ignore */ }
    return 0.5; // default mid
  }

  static setLearningRate(rate: number): void {
    const clamped = Math.max(0, Math.min(1, rate));
    try { localStorage.setItem(LEARNING_RATE_KEY, clamped.toFixed(2)); } catch { /* ignore */ }
  }

  // ── Game Lifecycle ─────────────────────────────────────────────────────────

  /** Call at the start of each new game. */
  startGame(botUid: string, playerUid: string): void {
    this.recording = {
      actions: [],
      botUid,
      playerUid,
    };
  }

  /** Call at the end of each game. Triggers backward-pass learning. */
  onGameEnd(winnerUid: string | undefined, botUid: string): void {
    if (!this.recording) return;
    const botWon = winnerUid === botUid;
    const terminalReward = botWon ? 1.0 : -1.0;

    this.learnFromGame(terminalReward);

    this.model.gp++;
    if (botWon) this.model.w++; else this.model.l++;
    this.model.ts = Date.now();

    this.extractLearnedPatterns();
    this.pruneIfNeeded();
    this.saveToStorage();
    this.recording = null;
  }

  // ── Recording ──────────────────────────────────────────────────────────────

  /** Record a bot action at the current state. */
  recordBotAction(gs: GameState, botUid: string, action: BotAction, immediateReward = 0): void {
    if (!this.recording) return;
    const cs = compressState(gs, botUid);
    const sh = hashState(cs);
    this.recording.actions.push({
      sh, a: action, who: 'bot', imm: immediateReward,
    });
  }

  /** Record a player action observed from state change. */
  recordPlayerAction(gs: GameState, botUid: string, action: string, immediateReward = 0): void {
    if (!this.recording) return;
    const cs = compressState(gs, botUid);
    const sh = hashState(cs);
    this.recording.actions.push({
      sh, a: action, who: 'player', imm: immediateReward,
    });
    // Track player action sequences for pattern recognition
    this.trackPlayerNGram(action, gs, botUid);
  }

  // ── Decision Methods ───────────────────────────────────────────────────────

  /**
   * Given a compressed game state and available actions, return the best
   * action according to Willow's learned Q-values + heuristics.
   * Uses ε-greedy exploration.
   */
  selectAction(gs: GameState, botUid: string, available: BotAction[]): BotAction {
    if (available.length === 0) return 'skip';
    if (available.length === 1) return available[0];

    const cs = compressState(gs, botUid);
    const sh = hashState(cs);

    // 1) Check learned patterns (fast path)
    const learned = this.checkLearnedPattern(sh, available);
    if (learned) return learned;

    // 2) ε-greedy: explore or exploit
    const eps = this.explorationRate();
    if (Math.random() < eps) {
      return available[Math.floor(Math.random() * available.length)];
    }

    // 3) Exploit: pick action with highest Q-value
    let bestAction = available[0];
    let bestQ = -Infinity;

    for (const a of available) {
      const q = this.getQValue(sh, a);
      if (q > bestQ) {
        bestQ = q;
        bestAction = a;
      }
    }
    return bestAction;
  }

  /**
   * Recommend whether the bot should counter the top stack entry.
   * Returns the action and a confidence score.
   */
  shouldCounter(gs: GameState, botUid: string): { action: BotAction; confidence: number } {
    const cs = compressState(gs, botUid);
    const sh = hashState(cs);
    const bps = getPS(gs, botUid);

    // Check if bot even has cancel + mana
    const cancelCard = bps.hand.find(c => CARD_DEFS[c.defId]?.spellType === 'cancel');
    if (!cancelCard) return { action: 'respond_pass', confidence: 1.0 };

    const cancelCost = CARD_DEFS[cancelCard.defId]?.cost ?? 0;
    if (bps.willPower < cancelCost) return { action: 'respond_pass', confidence: 1.0 };

    // Evaluate both options via Q-values
    const qCancel = this.getQValue(sh, 'respond_cancel');
    const qPass = this.getQValue(sh, 'respond_pass');

    // Check learned patterns
    const learned = this.checkLearnedPattern(sh, ['respond_cancel', 'respond_pass']);
    if (learned) {
      return {
        action: learned,
        confidence: 0.9,
      };
    }

    // Game-theory heuristic: always counter high-impact spells
    const top = gs.stack.length > 0 ? gs.stack[gs.stack.length - 1] : null;
    if (top) {
      const topDef = CARD_DEFS[top.cardDefId];
      // High-priority counters: grow (card advantage), spike/ignite targeting us
      if (topDef?.spellType === 'grow') {
        return { action: 'respond_cancel', confidence: Math.max(0.7, qCancel) };
      }
      if ((topDef?.spellType === 'ignite' || topDef?.spellType === 'spike') &&
          (top.target === 'opponent' || top.target === botUid)) {
        return { action: 'respond_cancel', confidence: Math.max(0.8, qCancel) };
      }
    }

    if (qCancel > qPass + 0.1) {
      return { action: 'respond_cancel', confidence: Math.min(0.95, qCancel) };
    }
    return { action: 'respond_pass', confidence: Math.min(0.95, qPass || 0.5) };
  }

  /**
   * Recommend play order for the bot's hand during a play phase.
   * Returns cards sorted by Willow's evaluation (best first).
   */
  recommendPlayOrder(gs: GameState, botUid: string, hand: CardInstance[]): CardInstance[] {
    const cs = compressState(gs, botUid);
    const sh = hashState(cs);

    return [...hand].sort((a, b) => {
      const actionA = this.cardToAction(a);
      const actionB = this.cardToAction(b);
      const qA = this.getQValue(sh, actionA);
      const qB = this.getQValue(sh, actionB);
      return qB - qA; // Higher Q-value first
    });
  }

  /**
   * Recommend spell target selection.
   * Returns 'best_being' to target the highest-value being, or 'opponent' for direct damage.
   */
  recommendSpellTarget(
    gs: GameState, botUid: string, spellType: 'ignite' | 'spike',
  ): 'best_being' | 'opponent' {
    const cs = compressState(gs, botUid);
    const sh = hashState(cs);

    const actionBeing = spellType === 'ignite' ? 'cast_ignite_being' : 'cast_spike_being';
    const actionOpp = spellType === 'ignite' ? 'cast_ignite_opponent' : 'cast_spike_opponent';

    const qBeing = this.getQValue(sh, actionBeing);
    const qOpp = this.getQValue(sh, actionOpp);

    // Heuristic override: if opponent has dangerous beings, prefer targeting them
    const pps = getOppPS(gs, botUid);
    const threatPower = totalPower(pps.battlefield);
    if (threatPower >= 5 && qBeing >= qOpp - 0.15) return 'best_being';

    return qBeing >= qOpp ? 'best_being' : 'opponent';
  }

  /**
   * Recommend attack strategy. Considers board state and learned patterns.
   */
  recommendAttackStrategy(gs: GameState, botUid: string): 'all' | 'selective' | 'none' {
    const cs = compressState(gs, botUid);
    const sh = hashState(cs);

    const available: BotAction[] = ['attack_all', 'attack_selective', 'no_attack'];
    const learned = this.checkLearnedPattern(sh, available);
    if (learned) {
      if (learned === 'attack_all') return 'all';
      if (learned === 'attack_selective') return 'selective';
      return 'none';
    }

    // Game-theory: evaluate risk vs reward
    const bps = getPS(gs, botUid);
    const pps = getOppPS(gs, botUid);
    const playerBeings = pps.battlefield.filter(c => CARD_DEFS[c.defId]?.type === 'being' && !c.exhausted);

    // If player has no blockers, always attack all
    if (playerBeings.length === 0) return 'all';

    // Evaluate via Q-values
    const qAll = this.getQValue(sh, 'attack_all');
    const qSel = this.getQValue(sh, 'attack_selective');
    const qNone = this.getQValue(sh, 'no_attack');

    // Heuristic: if we have significant board advantage, go aggressive
    if (totalPower(bps.battlefield) > totalPower(pps.battlefield) + 4) {
      return qAll >= qSel - 0.1 ? 'all' : 'selective';
    }

    if (qAll >= qSel && qAll >= qNone) return 'all';
    if (qSel >= qNone) return 'selective';
    return 'none';
  }

  /**
   * For selective attacks, evaluate which beings should attack.
   * Returns IDs of beings that should attack.
   */
  evaluateAttackers(
    gs: GameState, botUid: string, eligible: CardInstance[],
  ): string[] {
    if (eligible.length === 0) return [];
    const pps = getOppPS(gs, botUid);
    const playerBlockers = pps.battlefield.filter(c => {
      const def = CARD_DEFS[c.defId];
      return def?.type === 'being' && !c.exhausted;
    });

    // If no blockers, attack with everything
    if (playerBlockers.length === 0) return eligible.map(c => c.id);

    const maxBlockerToughness = Math.max(
      ...playerBlockers.map(c => (CARD_DEFS[c.defId]?.toughness ?? 0) + c.counters), 0,
    );

    // Attack with beings that either:
    // 1) Are flyers (harder to block)
    // 2) Have power > max blocker toughness (will survive trades)
    // 3) Have low value (expendable)
    const attackers: string[] = [];
    for (const c of eligible) {
      const def = CARD_DEFS[c.defId];
      if (!def) continue;
      const power = (def.power ?? 0) + c.counters;
      const toughness = (def.toughness ?? 0) + c.counters;

      if (def.isFlyer) { attackers.push(c.id); continue; }
      if (power > maxBlockerToughness) { attackers.push(c.id); continue; }
      if ((def.cost ?? 0) <= 2 && toughness <= 2) { attackers.push(c.id); continue; }
    }

    // If we'd attack none, at least send expendable units
    if (attackers.length === 0 && eligible.length > 0) {
      const cheapest = [...eligible].sort((a, b) =>
        (CARD_DEFS[a.defId]?.cost ?? 0) - (CARD_DEFS[b.defId]?.cost ?? 0),
      );
      attackers.push(cheapest[0].id);
    }

    return attackers;
  }

  /**
   * Recommend blocking assignments. Returns a map of attackerId → blockerId.
   */
  recommendBlockers(
    gs: GameState, botUid: string,
    attackerIds: string[], availableBlockers: CardInstance[],
  ): Record<string, string> {
    const assignments: Record<string, string> = {};
    const usedBlockers = new Set<string>();
    const pps = getOppPS(gs, botUid);

    // Sort attackers by threat level (highest power first)
    const sortedAttackers = [...attackerIds].sort((a, b) => {
      const cardA = pps.battlefield.find(c => c.id === a);
      const cardB = pps.battlefield.find(c => c.id === b);
      const powA = cardA ? (CARD_DEFS[cardA.defId]?.power ?? 0) + cardA.counters : 0;
      const powB = cardB ? (CARD_DEFS[cardB.defId]?.power ?? 0) + cardB.counters : 0;
      return powB - powA;
    });

    for (const atkId of sortedAttackers) {
      const atkCard = pps.battlefield.find(c => c.id === atkId);
      const atkDef = atkCard ? CARD_DEFS[atkCard.defId] : null;
      if (!atkDef) continue;

      const atkPower = (atkDef.power ?? 0) + (atkCard?.counters ?? 0);

      // Find best blocker: prefers one that can kill the attacker and survive
      let bestBlocker: CardInstance | null = null;
      let bestScore = -Infinity;

      for (const blocker of availableBlockers) {
        if (usedBlockers.has(blocker.id)) continue;
        const bDef = CARD_DEFS[blocker.defId];
        if (!bDef) continue;

        // Flying restriction: non-flyer can't block flyer
        if (atkDef.isFlyer && !bDef.isFlyer) continue;

        const bPower = (bDef.power ?? 0) + blocker.counters;
        const bTough = (bDef.toughness ?? 0) + blocker.counters;
        const atkTough = (atkDef.toughness ?? 0) + (atkCard?.counters ?? 0);

        // Scoring:
        // +3 if blocker kills attacker
        // +2 if blocker survives
        // -1 per cost of blocker lost (trade penalty)
        let score = 0;
        if (bPower >= atkTough) score += 3;    // kills attacker
        if (bTough > atkPower) score += 2;     // survives
        else score -= (bDef.cost ?? 1);         // blocker dies: penalty proportional to cost
        // Prefer blocking high-power attackers
        score += atkPower * 0.5;

        if (score > bestScore) {
          bestScore = score;
          bestBlocker = blocker;
        }
      }

      // Only assign blocker if the trade is favorable (score > 0) or attacker is very threatening
      if (bestBlocker && (bestScore > 0 || atkPower >= 3)) {
        assignments[atkId] = bestBlocker.id;
        usedBlockers.add(bestBlocker.id);
      }
    }

    return assignments;
  }

  /**
   * Recommend damage mode when the bot has unblocked attackers.
   * Uses Q-values but with a mathematical verification.
   */
  recommendDamageMode(
    gs: GameState, botUid: string, unblockedPowers: number[],
  ): 'additive' | 'multiplicative' {
    if (unblockedPowers.length <= 1) return 'additive';

    const additive = unblockedPowers.reduce((a, b) => a + b, 0);
    const multiplicative = unblockedPowers.reduce((a, b) => a * b, 1);

    // Mathematical: always pick the higher damage
    const mathBest = multiplicative >= additive ? 'multiplicative' : 'additive';

    // Check if Q-values suggest otherwise (player might have healing etc.)
    const cs = compressState(gs, botUid);
    const sh = hashState(cs);
    const qAdd = this.getQValue(sh, 'damage_additive');
    const qMul = this.getQValue(sh, 'damage_multiplicative');

    // Only override math-best if Q-value strongly disagrees
    if (mathBest === 'multiplicative' && qAdd > qMul + 0.3) return 'additive';
    if (mathBest === 'additive' && qMul > qAdd + 0.3) return 'multiplicative';

    return mathBest;
  }

  /**
   * Predict what the player is likely to do next based on n-gram patterns.
   * Returns the most likely player action description, or null if no pattern.
   */
  predictPlayerAction(recentPlayerActions: string[]): string | null {
    if (recentPlayerActions.length < 2) return null;

    // Check 3-grams then 2-grams
    for (let n = Math.min(3, recentPlayerActions.length); n >= 2; n--) {
      const seq = recentPlayerActions.slice(-n).join('→');
      const entry = this.model.pg[seq];
      if (entry && entry.n >= 3) {
        return `predicted: likely to follow pattern "${seq}"`;
      }
    }
    return null;
  }

  // ── Model Management ───────────────────────────────────────────────────────

  exportModel(): string {
    return JSON.stringify(this.model);
  }

  importModel(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || parsed.v !== MODEL_VERSION) return false;
      if (typeof parsed.gp !== 'number' || typeof parsed.qt !== 'object') return false;
      this.model = parsed as WillowModel;
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  getStats(): {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: string;
    patternsLearned: number;
    totalTransitions: number;
    qtEntries: number;
    modelSizeKB: number;
    explorationRate: string;
  } {
    const size = new Blob([JSON.stringify(this.model)]).size;
    return {
      gamesPlayed: this.model.gp,
      wins: this.model.w,
      losses: this.model.l,
      winRate: this.model.gp > 0
        ? (this.model.w / this.model.gp * 100).toFixed(1) + '%'
        : 'N/A',
      patternsLearned: this.model.lp.length,
      totalTransitions: this.model.tn,
      qtEntries: Object.values(this.model.qt).reduce((s, v) => s + Object.keys(v).length, 0),
      modelSizeKB: Math.round(size / 1024),
      explorationRate: (this.explorationRate() * 100).toFixed(1) + '%',
    };
  }

  resetModel(): void {
    this.model = createDefaultModel();
    this.saveToStorage();
  }

  // ── Q-Value Access ─────────────────────────────────────────────────────────

  private getQValue(stateHash: string, action: BotAction | string): number {
    const stateEntry = this.model.qt[stateHash];
    if (stateEntry) {
      const tr = stateEntry[action];
      if (tr && tr.n > 0) {
        return tr.r / tr.n;
      }
    }
    // Fall back to heuristic prior
    return HEURISTIC_PRIORS[action as BotAction] ?? 0.0;
  }

  private explorationRate(): number {
    const lr = WillowAI.getLearningRate();
    // Higher learning rate → faster decay of exploration (more exploitation).
    // Reduced initial rate (0.4) and faster decay so patterns are exploited after ~20 games.
    const decayBase = 0.88 + (1 - lr) * 0.08; // lr=1→0.88, lr=0→0.96
    return Math.max(0.05, 0.4 * Math.pow(decayBase, this.model.gp));
  }

  // ── Learned Pattern Check ──────────────────────────────────────────────────

  private checkLearnedPattern(stateHash: string, available: BotAction[]): BotAction | null {
    const avSet = new Set<string>(available);
    let best: LearnedPattern | null = null;

    for (const lp of this.model.lp) {
      // Only use patterns with positive avg reward (avoid learned-loss patterns)
      if (lp.sh === stateHash && avSet.has(lp.a) && lp.c >= 0.4 && lp.r >= 0) {
        if (!best || lp.c > best.c || (lp.c === best.c && lp.r > best.r)) {
          best = lp;
        }
      }
    }
    return best?.a ?? null;
  }

  // ── Learning Engine ────────────────────────────────────────────────────────

  /**
   * Backward-pass learning: propagate terminal reward back through the game,
   * discounting by γ per action (Markov chain temporal difference update).
   */
  private learnFromGame(terminalReward: number): void {
    if (!this.recording) return;
    const botActions = this.recording.actions.filter(a => a.who === 'bot');
    if (botActions.length === 0) return;

    // Backward pass: assign discounted rewards
    let reward = terminalReward;
    for (let i = botActions.length - 1; i >= 0; i--) {
      const rec = botActions[i];
      const discounted = reward + rec.imm;

      // Update Q-table
      if (!this.model.qt[rec.sh]) this.model.qt[rec.sh] = {};
      const stateEntry = this.model.qt[rec.sh];

      if (!stateEntry[rec.a]) {
        stateEntry[rec.a] = { n: 0, r: 0, next: {} };
      }
      const tr = stateEntry[rec.a];
      tr.n++;
      tr.r += discounted;
      this.model.tn++;

      // Record transition to next state
      if (i < botActions.length - 1) {
        const nextSh = botActions[i + 1].sh;
        tr.next[nextSh] = (tr.next[nextSh] || 0) + 1;
      }

      // Discount for the next (earlier) action
      reward *= DISCOUNT_FACTOR;
    }
  }

  /**
   * Extract high-confidence state-action pairs into the "learned keys"
   * (fast-path patterns that bypass Q-value computation).
   */
  private extractLearnedPatterns(): void {
    const existing = new Map<string, LearnedPattern>();
    for (const lp of this.model.lp) {
      existing.set(`${lp.sh}|${lp.a}`, lp);
    }

    const lr = WillowAI.getLearningRate();
    // Higher learning rate → lower thresholds (learn faster)
    const threshold = Math.max(1, Math.round(DEFAULT_LEARNED_THRESHOLD * (1.5 - lr)));
    const rewardMin = DEFAULT_LEARNED_REWARD_MIN * (1.3 - lr * 0.6);

    for (const [sh, actions] of Object.entries(this.model.qt)) {
      for (const [a, tr] of Object.entries(actions)) {
        if (tr.n < threshold) continue;
        const avgReward = tr.r / tr.n;
        if (avgReward < rewardMin) continue;

        const confidence = tr.n / (tr.n + threshold + 1); // Bayesian-ish; +1 keeps it < 1
        const key = `${sh}|${a}`;

        if (existing.has(key)) {
          const lp = existing.get(key)!;
          lp.c = confidence;
          lp.n = tr.n;
          lp.r = avgReward;
        } else if (this.model.lp.length < MAX_LEARNED_PATTERNS) {
          const newLP: LearnedPattern = {
            sh, a: a as BotAction, c: confidence, n: tr.n, r: avgReward,
          };
          this.model.lp.push(newLP);
          existing.set(key, newLP);
        }
      }
    }

    // Sort by confidence descending, keep only top N
    this.model.lp.sort((a, b) => b.c - a.c || b.r - a.r);
    if (this.model.lp.length > MAX_LEARNED_PATTERNS) {
      this.model.lp.length = MAX_LEARNED_PATTERNS;
    }
  }

  // ── Player Pattern Tracking ────────────────────────────────────────────────

  private recentPlayerActions: string[] = [];

  private trackPlayerNGram(action: string, _gs: GameState, _botUid: string): void {
    this.recentPlayerActions.push(action);
    if (this.recentPlayerActions.length > 10) {
      this.recentPlayerActions.shift();
    }

    // Build 2-grams and 3-grams
    for (let n = 2; n <= Math.min(3, this.recentPlayerActions.length); n++) {
      const seq = this.recentPlayerActions.slice(-n).join('→');

      if (!this.model.pg[seq]) {
        this.model.pg[seq] = {
          seq,
          botResp: 'pass_priority',
          n: 0,
          r: 0,
        };
      }
      this.model.pg[seq].n++;
    }

    // Prune n-grams if too many (keep top 200 by count)
    const keys = Object.keys(this.model.pg);
    if (keys.length > 300) {
      const sorted = keys
        .map(k => ({ k, n: this.model.pg[k].n }))
        .sort((a, b) => b.n - a.n);
      const keep = new Set(sorted.slice(0, 200).map(e => e.k));
      for (const k of keys) {
        if (!keep.has(k)) delete this.model.pg[k];
      }
    }
  }

  // ── Pruning & Size Management ──────────────────────────────────────────────

  private pruneIfNeeded(): void {
    const json = JSON.stringify(this.model);
    if (json.length <= MAX_MODEL_BYTES) return;

    // Pass 1: remove low-count transitions
    for (const sh of Object.keys(this.model.qt)) {
      for (const a of Object.keys(this.model.qt[sh])) {
        if (this.model.qt[sh][a].n < PRUNE_MIN_COUNT) {
          delete this.model.qt[sh][a];
          this.model.tn = Math.max(0, this.model.tn - 1);
        }
      }
      if (Object.keys(this.model.qt[sh]).length === 0) delete this.model.qt[sh];
    }

    if (JSON.stringify(this.model).length <= MAX_MODEL_BYTES) return;

    // Pass 2: more aggressive prune
    for (const sh of Object.keys(this.model.qt)) {
      for (const a of Object.keys(this.model.qt[sh])) {
        if (this.model.qt[sh][a].n < PRUNE_AGGRESSIVE_COUNT) {
          delete this.model.qt[sh][a];
        }
      }
      if (Object.keys(this.model.qt[sh]).length === 0) delete this.model.qt[sh];
    }

    if (JSON.stringify(this.model).length <= MAX_MODEL_BYTES) return;

    // Pass 3: flush all transitions, keep only learned patterns
    this.model.qt = {};
    this.model.tn = 0;
    this.model.pg = {};
  }

  // ── Card → Action Mapping ──────────────────────────────────────────────────

  private cardToAction(card: CardInstance): BotAction {
    const def = CARD_DEFS[card.defId];
    if (!def) return 'skip';

    if (def.type === 'landscape') return 'play_landscape';
    if (def.type === 'ancient') return 'use_ancient';

    if (def.type === 'being') {
      if (def.isFlyer) return 'play_flyer';
      const cost = def.cost ?? 1;
      const clamped = Math.min(5, Math.max(1, cost)) as 1 | 2 | 3 | 4 | 5;
      return `play_being_${clamped}` as BotAction;
    }

    if (def.type === 'spell') {
      switch (def.spellType) {
        case 'ignite': return 'cast_ignite_being';
        case 'cancel': return 'cast_cancel';
        case 'spike': return 'cast_spike_being';
        case 'grow': return 'cast_grow';
        default: return 'skip';
      }
    }
    return 'skip';
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private saveToStorage(): void {
    const json = JSON.stringify(this.model);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // Storage full — try pruning harder
      this.model.qt = {};
      this.model.tn = 0;
      const pruned = JSON.stringify(this.model);
      try {
        localStorage.setItem(STORAGE_KEY, pruned);
      } catch {
        // Give up silently
      }
    }
    // Mirror to Electron file storage (fire-and-forget)
    if (isElectron()) {
      window.electronAPI!.writeModelFile!(json).catch(() => { /* ignore */ });
    }
  }

  private loadFromStorage(): WillowModel | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === MODEL_VERSION) return parsed as WillowModel;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * In Electron, read the model file from disk and sync it into localStorage if it
   * has more data (more games played) than what's currently stored. Call this once
   * at app startup before instantiating WillowAI for the first time.
   */
  static async syncFromElectronFile(): Promise<void> {
    if (!isElectron()) return;
    try {
      const raw = await window.electronAPI!.readModelFile!();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== MODEL_VERSION) return;

      // Compare with what's in localStorage — keep whichever has more data
      let localGP = 0;
      try {
        const localRaw = localStorage.getItem(STORAGE_KEY);
        if (localRaw) {
          const localParsed = JSON.parse(localRaw);
          localGP = localParsed?.gp ?? 0;
        }
      } catch { /* ignore */ }

      if ((parsed.gp ?? 0) > localGP) {
        localStorage.setItem(STORAGE_KEY, raw);
      }
    } catch {
      // File missing or corrupt — no-op
    }
  }
}
