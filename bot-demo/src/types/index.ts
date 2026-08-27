export interface User {
  uid: string;
  username: string;
  rank: number;
  wins: number;
  losses: number;
  online: boolean;
  lastSeen: number;
  friends: string[];
  avatarColor: string;
  sp?: number;
  unlockedSkins?: string[];
  isAdmin?: boolean;
  botWins?: number;
  /** Set when the player leaves a multiplayer game mid-match to return later */
  activeRoomId?: string;
  /** Timestamp (ms) when the player left the active game */
  leftGameAt?: number;
}

export interface Announcement {
  id: string;
  fromUid: string;
  fromUsername: string;
  text: string;
  timestamp: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface GlobalChatMessage {
  id: string;
  fromUid: string;
  fromUsername: string;
  avatarColor: string;
  text: string;
  timestamp: number;
}

export type CardType = 'being' | 'landscape' | 'ancient' | 'spell';
export type SpellType = 'ignite' | 'cancel' | 'spike' | 'grow';
export type BeingSize = 1 | 2 | 3 | 4 | 5;

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  power?: number;
  toughness?: number;
  cost?: number;
  spellType?: SpellType;
  isFlyer?: boolean;
  isAncient?: boolean;
  description: string;
  imageUrl?: string;
  dots?: number;
}

export interface CardInstance {
  id: string;
  defId: string;
  exhausted: boolean;
  counters: number;
  owner: string;
  summonedThisTurn?: boolean;
}

export type GamePhase = 'replenish' | 'draw' | 'play1' | 'combat' | 'play2' | 'end';
export type CombatStep = 'none' | 'pre' | 'attackers' | 'blocks' | 'pre-damage' | 'damage';

/**
 * One *priority window*: a single round of "each player may act, then pass".
 *
 * The window is identified by the stack it was opened over, so any change to the
 * stack invalidates it and a late or duplicate pass cannot corrupt the gate. An
 * empty `stackOrder` is a legitimate window over an empty stack — that is how the
 * pre-damage combat gate works, using the same mechanism as the stack rather than a
 * separate flag.
 *
 * See `priorityWindowMatches` / `recordPriorityPass` / `resetPriority` in
 * `game/engine.ts`; nothing should construct or mutate this by hand.
 */
export interface StackPassPriorityState {
  // Snapshot of the stack this window was opened over: entry id -> 1-based position.
  stackOrder: Record<string, number>;
  // Who has passed inside this window: player uid -> 1-based pass order.
  passOrder: Record<string, number>;
}

export interface GameState {
  id: string;
  player1: string;
  player2: string;
  currentTurn: string;
  phase: GamePhase;
  combatStep: CombatStep;
  p1State: PlayerGameState;
  p2State: PlayerGameState;
  stack: StackEntry[];
  log: string[];
  winner?: string;
  startedAt: number;
  turnNumber: number;
  p1LandscapesThisTurn: number;
  p2LandscapesThisTurn: number;
  p1ConsecutiveTurnsNoLandscape: number;
  p2ConsecutiveTurnsNoLandscape: number;
  p1ConsecutiveTurnsNoSpell: number;
  p2ConsecutiveTurnsNoSpell: number;
  p1FieldOfImaginationSacCount: number;
  p2FieldOfImaginationSacCount: number;
  priorityPlayer: string;
  p1TurnCount: number;
  p2TurnCount: number;
  // Player ranks at game start (used for SP reward calculation)
  p1Rank: number;
  p2Rank: number;
  // Ritual tracking
  stackHistoryPlays: Array<{ defId: string; playerId: string }>;
  stackWarPlayer?: string;
  pendingRitualPopup?: string;
  pendingRitualTarget?: { ritualName: string; uid: string; igniteBoost?: number };
  // True once at least one player has passed in the current priority window. This is
  // a display/compatibility hint only — whether the window is closed is decided by
  // `stackPassPriority.passOrder`, never by this flag.
  stackPassedOnce?: boolean;
  // The current priority window. Undefined means no window is open.
  stackPassPriority?: StackPassPriorityState;
  // Combat damage choice
  pendingDamageChoice?: boolean;
  // Global UI popup for both players (e.g. ritual announcements, game events)
  globalPopup?: { message: string; type?: 'info' | 'warning' | 'success' };
  // Monotonically-increasing sequence number used for Firebase conflict resolution
  seq: number;
}

export interface PlayerGameState {
  uid: string;
  willPower: number;
  hand: CardInstance[];
  deck: CardInstance[];
  battlefield: CardInstance[];
  limbo: CardInstance[];
  yard: CardInstance[];
  exile: CardInstance[];
  ancient: CardInstance | null;
  attackers: string[];
  blockers: Record<string, string>;
  ready: boolean;
  landscapeCountThisTurn: number;
  needsNewAncient?: boolean;
  ritualZone: CardInstance[];
  igniteBoost: number;
}

export interface StackEntry {
  id: string;
  cardInstanceId: string;
  cardDefId: string;
  playerId: string;
  target?: string;
}

export interface Challenge {
  id: string;
  fromUid: string;
  fromUsername: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  /** Set when challenge is accepted — points the challenger to the new game room */
  gameRoomId?: string;
}

export interface MatchmakingEntry {
  uid: string;
  username: string;
  rank: number;
  joinedAt: number;
  /** Set when a match is found — both players read this to navigate */
  matchedRoomId?: string;
  matchedP1?: string;
  matchedP2?: string;
}

export interface GameRoom {
  id: string;
  player1: string;
  player2: string;
  p1Ready: boolean;
  p2Ready: boolean;
  gameStarted: boolean;
  gameState?: GameState;
  createdAt: number;
  /**
   * Tracks absences: maps uid → timestamp (ms) when that player left to the lobby.
   * Cleared when the player returns.  When a player has been absent for ≥ 3 minutes
   * the remaining player wins automatically.
   */
  playerAbsences?: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  fromUid: string;
  fromUsername: string;
  text: string;
  timestamp: number;
}

export interface FriendChat {
  messages: Record<string, ChatMessage>;
}

export interface Tournament {
  id: string;
  name: string;
  createdBy: string;
  players: string[];
  maxPlayers: number;
  status: 'open' | 'active' | 'complete';
  bracket: BracketMatch[];
  createdAt: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  player1?: string;
  player2?: string;
  winner?: string;
  gameRoomId?: string;
}
