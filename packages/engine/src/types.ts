/**
 * Types centraux du moteur « Baston de Sorciers ».
 *
 * Règle d'or : ce module ne contient que des données sérialisables (JSON).
 * L'état complet (`GameState`) ne quitte jamais le serveur ; les clients reçoivent
 * des projections (`PublicGameState`, `PrivatePlayerState`) produites par `views.ts`.
 */

// ---------------------------------------------------------------------------
// Identifiants
// ---------------------------------------------------------------------------

export type PlayerId = string;
export type SummonId = string;
/** Un joueur ou une invocation : tout ce qui a des PV et peut être ciblé. */
export type EntityId = PlayerId | SummonId;
export type CardDefId = string;
export type CardInstanceId = string;
export type StatusDefId = string;
export type SummonDefId = string;

// ---------------------------------------------------------------------------
// Cartes
// ---------------------------------------------------------------------------

export const SCHOOLS = ["BRAISE", "OMBRE", "SEVE", "ETHER", "CHIMERE"] as const;
export type School = (typeof SCHOOLS)[number];

/** Ordre de résolution des emplacements d'un sort. */
export const RUNE_SLOTS = ["AMORCE", "TORSION", "FRAPPE"] as const;
export type RuneSlot = (typeof RUNE_SLOTS)[number];

export type CardKind = "RUNE" | "RELIC" | "GRUDGE";
export type PileId = "GRIMOIRE" | "COFFRE" | "OUTRE_TOMBE";

export interface CardDefinition {
  id: CardDefId;
  kind: CardKind;
  name: string;
  /** Texte de règles affiché au joueur. */
  text: string;
  flavor?: string;
  /** Emplacement (runes uniquement ; une rune instable peut aller n'importe où). */
  slot?: RuneSlot;
  /** 0 école (instable), 1 école, ou 2 écoles (rune bi-école). */
  schools: School[];
  /** Rune instable : remplacée au dévoilement par la 1re rune compatible de la pioche. */
  unstable?: boolean;
  /** Valeur d'initiative (Frappes uniquement, plus haut = plus rapide à nombre de runes égal). */
  initiative?: number;
  /** Runes : effets à la résolution. Rancunes : effets en début de manche. Reliques : ignoré. */
  effects: EffectNode[];
  /** Reliques : capacités passives tant que la relique est possédée. */
  passives?: PassiveDefinition[];
  /** Relique éternelle : conservée à la mort de son porteur. */
  eternal?: boolean;
  /** Nombre d'exemplaires dans la pile correspondante. */
  copies: number;
}

export interface CardInstance {
  id: CardInstanceId;
  defId: CardDefId;
}

export interface Pile {
  id: PileId;
  /** Ordre de pioche : index 0 = dessus. Jamais transmis aux clients. */
  draw: CardInstanceId[];
  discard: CardInstanceId[];
}

// ---------------------------------------------------------------------------
// Effets (données pures, interprétées par le registre d'opérateurs)
// ---------------------------------------------------------------------------

export type AmountSource =
  | "ROLL_TOTAL" // total du dernier jet de Puissance
  | "TIER" // palier du dernier jet (1, 2 ou 3)
  | "RUNES_OF_SCHOOL" // nb de runes de `school` dans le sort courant
  | "STACKS" // cumuls du statut porteur du passif
  | "SELF_STATUS_STACKS" // cumuls du statut `status` sur le contrôleur
  | "EVENT_AMOUNT" // montant de l'événement déclencheur
  | "DEAD_PLAYERS" // nb de sorciers morts dans la manche
  | "MISSING_HP"; // PV manquants du contrôleur

export type Amount =
  | number
  | {
      from: AmountSource;
      school?: School;
      status?: StatusDefId;
      mul?: number;
      add?: number;
      min?: number;
      max?: number;
    };

export type TargetSelector =
  | "SELF" // l'entité qui agit (sorcier, ou invocation pour ses propres passifs)
  | "CONTROLLER" // le sorcier contrôleur
  | "HOLDER" // porteur du statut / de la relique dont provient le passif
  | "LEFT" // prochain sorcier vivant dans l'ordre des sièges
  | "RIGHT" // précédent sorcier vivant dans l'ordre des sièges
  | "ALL_FOES" // tous les sorciers adverses vivants
  | "ALL_PLAYERS" // tous les sorciers vivants
  | "STRONGEST_FOE" // adversaire vivant avec le plus de PV
  | "WEAKEST_FOE" // adversaire vivant avec le moins de PV
  | "RANDOM_FOE" // adversaire vivant tiré au sort (RNG serveur)
  | "ALL_FOE_SUMMONS"
  | "MY_KILLER" // sorcier ayant tué le contrôleur lors de la manche précédente
  | "EVENT_SOURCE"
  | "EVENT_TARGET"
  | "IT" // entité courante d'un FOR_EACH
  | "CHOSEN"; // choix du contrôleur

export interface TargetSpec {
  sel: TargetSelector;
  /** Pour CHOSEN : ensemble des cibles possibles. */
  among?: "FOES" | "FOES_AND_SUMMONS" | "ANY_PLAYER";
}

export type Condition =
  | { c: "HP_AT_MOST"; who: TargetSpec; value: number }
  | { c: "HAS_STATUS"; who: TargetSpec; status: StatusDefId }
  | { c: "IS_DEAD"; who: TargetSpec }
  | { c: "ROLL_AT_LEAST"; value: number }
  | { c: "RUNES_OF_SCHOOL_AT_LEAST"; school: School; value: number }
  | { c: "SPELL_SIZE_AT_LEAST"; value: number }
  | { c: "HAS_RELIC"; who: TargetSpec }
  | { c: "CHANCE"; percent: number }
  | { c: "AND"; of: Condition[] }
  | { c: "OR"; of: Condition[] }
  | { c: "NOT"; of: Condition };

export type EffectNode =
  | { op: "DAMAGE"; target: TargetSpec; amount: Amount; school?: School; tags?: string[] }
  | { op: "HEAL"; target: TargetSpec; amount: Amount }
  | { op: "DRAIN"; target: TargetSpec; amount: Amount; school?: School }
  | { op: "LOSE_HP"; target: TargetSpec; amount: Amount }
  | { op: "APPLY_STATUS"; target: TargetSpec; status: StatusDefId; stacks?: Amount; duration?: number | "PERMANENT" }
  | { op: "REMOVE_STATUS"; target: TargetSpec; polarity?: "BUFF" | "DEBUFF"; status?: StatusDefId }
  | { op: "DRAW"; target: TargetSpec; count: Amount }
  | { op: "DISCARD"; target: TargetSpec; count: Amount; mode: "RANDOM" | "CHOICE" }
  | { op: "STEAL_CARD"; from: TargetSpec; count: Amount }
  | { op: "GAIN_RELIC"; target: TargetSpec; count: Amount }
  | { op: "STEAL_RELIC"; from: TargetSpec }
  | { op: "SUMMON"; summon: SummonDefId }
  | { op: "POWER_ROLL"; school?: School | "SELF"; dice?: number; tiers: [EffectNode[], EffectNode[], EffectNode[]] }
  | { op: "IF"; cond: Condition; then: EffectNode[]; else?: EffectNode[] }
  | { op: "FOR_EACH"; target: TargetSpec; effects: EffectNode[] }
  | { op: "CHOOSE_OPTION"; prompt: string; options: { label: string; effects: EffectNode[] }[] }
  | { op: "RANDOM"; branches: { weight: number; effects: EffectNode[] }[] }
  | { op: "REPEAT"; times: Amount; effects: EffectNode[] }
  /** Résolution répétée : rejoue `effects` tant que `while` est vrai, au plus `max` fois au total. */
  | { op: "ECHO"; while: Condition; effects: EffectNode[]; max: number; iteration?: number; check?: boolean }
  /** Effet retardé : s'exécute une fois au prochain événement `on` concernant le contrôleur. */
  | { op: "DELAY"; on: TriggerType; effects: EffectNode[] };

export type EffectOp = EffectNode["op"];

// ---------------------------------------------------------------------------
// Passifs : déclencheurs et modificateurs
// ---------------------------------------------------------------------------

export type TriggerType =
  | "ON_ROUND_START"
  | "ON_TURN_START"
  | "ON_TURN_END"
  | "ON_SPELL_CAST"
  | "ON_DICE_ROLLED"
  | "ON_DAMAGE_DEALT"
  | "ON_DAMAGE_RECEIVED"
  | "ON_HEALED"
  | "ON_STATUS_RECEIVED"
  | "ON_DEATH"
  | "ON_KILL"
  | "ON_ANY_DEATH"
  | "ON_SUMMON_DIED";

export interface TriggerFilter {
  school?: School;
  /** Ignore les événements portant l'un de ces tags (ex. « reflected » pour éviter les boucles de renvoi). */
  notTags?: string[];
  minAmount?: number;
  /** L'autre partie de l'événement (source si on reçoit, cible si on inflige) est un adversaire. */
  otherIsFoe?: boolean;
}

export interface TriggerDefinition {
  on: TriggerType;
  filter?: TriggerFilter;
  effects: EffectNode[];
  /** Nombre maximal d'activations par tour pour ce passif. */
  maxPerTurn?: number;
}

export type ModifierHook = "DAMAGE_OUT" | "DAMAGE_IN" | "HEAL_IN" | "DICE" | "INITIATIVE" | "MAX_HP" | "HAND_SIZE";

export interface ModifierDefinition {
  hook: ModifierHook;
  /** ADD : +value × cumuls. MUL : ×value. IMMUNE : annule. ABSORB_STACKS : absorbe jusqu'aux cumuls du statut. */
  kind: "ADD" | "MUL" | "IMMUNE" | "ABSORB_STACKS";
  value?: number;
  filter?: { school?: School };
  /** Le statut perd un cumul chaque fois que ce modificateur s'applique. */
  consume?: boolean;
}

export interface PassiveDefinition {
  trigger?: TriggerDefinition;
  modifier?: ModifierDefinition;
}

// ---------------------------------------------------------------------------
// Statuts et invocations
// ---------------------------------------------------------------------------

export interface StatusDefinition {
  id: StatusDefId;
  name: string;
  text: string;
  polarity: "BUFF" | "DEBUFF";
  stacking: "STACK" | "REFRESH" | "IGNORE";
  maxStacks: number;
  defaultDuration: number | "PERMANENT";
  passives: PassiveDefinition[];
}

export interface StatusInstance {
  id: string;
  defId: StatusDefId;
  /** Entité ayant appliqué le statut (crédit des dégâts sur la durée). */
  sourceId: EntityId | null;
  stacks: number;
  /** Tours restants, décrémentés en fin de tour. */
  remaining: number | "PERMANENT";
  appliedAt: number;
}

export interface SummonDefinition {
  id: SummonDefId;
  name: string;
  text: string;
  maxHp: number;
  passives: PassiveDefinition[];
}

export interface Summon {
  id: SummonId;
  defId: SummonDefId;
  controllerId: PlayerId;
  hp: number;
  maxHp: number;
  statuses: StatusInstance[];
  enteredAt: number;
}

// ---------------------------------------------------------------------------
// Joueurs, sorts
// ---------------------------------------------------------------------------

export type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ABANDONED";

export interface Spell {
  runes: Partial<Record<RuneSlot, CardInstanceId>>;
  locked: boolean;
  revealed: boolean;
  /** Emplacements déjà résolus (ou annulés). */
  resolvedSlots: RuneSlot[];
  fizzled: boolean;
}

export interface Player {
  id: PlayerId;
  name: string;
  seat: number;
  hp: number;
  baseMaxHp: number;
  alive: boolean;
  crowns: number;
  hand: CardInstanceId[];
  spell: Spell | null;
  relics: CardInstanceId[];
  statuses: StatusInstance[];
  connection: ConnectionStatus;
  ready: boolean;
  diedThisRound: boolean;
  /** Sorcier responsable de la dernière mort (pour les Rancunes). */
  killedBy: PlayerId | null;
  /** Dernier sorcier adverse à lui avoir fait perdre des PV pendant la manche (crédit de l'élimination). */
  lastHitBy: PlayerId | null;
  stats: { damageDealt: number; kills: number; roundsWon: number };
}

// ---------------------------------------------------------------------------
// Résolution
// ---------------------------------------------------------------------------

export interface EventRef {
  type: GameEventType;
  sourceId?: EntityId;
  targetId?: EntityId;
  amount?: number;
}

export interface EffectContext {
  /** Entité qui agit (sorcier ou invocation). */
  sourceId: EntityId | null;
  /** Sorcier contrôleur (pour les choix, les voisins, « adversaires »…). */
  controllerId: PlayerId;
  /** Porteur du passif à l'origine de la tâche. */
  holderId?: EntityId;
  /** Carte à l'origine (rune, relique, rancune). */
  cardDefId?: CardDefId;
  /** Sorcier dont le sort est en cours (pour compter les runes). */
  spellOwnerId?: PlayerId;
  event?: EventRef;
  roll?: number;
  tier?: number;
  stacks?: number;
  it?: EntityId;
  /** Libellé lisible (« Pluie de cendres », « Brûlure »…). */
  label?: string;
}

export interface ResolutionTask {
  id: number;
  depth: number;
  node: EffectNode;
  ctx: EffectContext;
  /** Réponses aux choix déjà fournies pour cette tâche (clé → identifiants choisis). */
  answers: Record<string, string[]>;
  /** Événement ayant causé la tâche (chaîne de causalité). */
  causeSeq?: number;
}

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface PendingChoice {
  requestId: string;
  playerId: PlayerId;
  kind: "TARGET" | "OPTION" | "CARDS";
  /** Clé de réponse dans `ResolutionTask.answers`. */
  key: string;
  prompt: string;
  options: ChoiceOption[];
  min: number;
  max: number;
  timerId: string;
}

export interface DelayedEffect {
  id: string;
  controllerId: PlayerId;
  on: TriggerType;
  effects: EffectNode[];
  ctx: EffectContext;
}

export interface TimerSpec {
  id: string;
  kind: "PLANNING" | "CHOICE";
  durationMs: number;
  playerId?: PlayerId;
}

export interface TurnState {
  initiativeOrder: PlayerId[];
  /** Index du sort en cours dans `initiativeOrder` (-1 avant le premier). */
  spellIndex: number;
}

// ---------------------------------------------------------------------------
// Machine à états
// ---------------------------------------------------------------------------

export type Phase =
  | "LOBBY"
  | "ROUND_SETUP"
  | "TURN_START"
  | "PLANNING"
  | "REVEAL"
  | "RESOLUTION"
  | "AWAITING_CHOICE"
  | "TURN_END"
  | "ROUND_CHECK"
  | "ROUND_END"
  | "GAME_OVER";

export interface GameConfig {
  minPlayers: number;
  maxPlayers: number;
  startingHp: number;
  handSize: number;
  crownsToWin: number;
  planningMs: number;
  choiceMs: number;
  maxRounds: number;
  /** À partir de ce tour, chaque sorcier perd des PV en début de tour. */
  suddenDeathTurn: number;
  /** Au-delà, la manche est déclarée nulle. */
  maxTurnsPerRound: number;
  /**
   * Concentration : dés de Puissance supplémentaires selon la taille du sort
   * ([1 rune, 2 runes, 3 runes]). Compense la faiblesse des sorts courts. [RULE D25]
   */
  focusDice: [number, number, number];
}

export interface GameState {
  id: string;
  version: number;
  config: GameConfig;
  phase: Phase;
  /** Vrai quand les actions d'entrée de la phase courante ont été exécutées. */
  phaseEntered: boolean;
  /** Phase interrompue par un choix en attente. */
  suspendedPhase: Phase | null;
  hostId: PlayerId | null;
  players: Record<PlayerId, Player>;
  seatOrder: PlayerId[];
  cards: Record<CardInstanceId, CardInstance>;
  piles: Record<PileId, Pile>;
  summons: Record<SummonId, Summon>;
  delayed: DelayedEffect[];
  round: number;
  turn: number;
  turnState: TurnState | null;
  queue: ResolutionTask[];
  pendingChoice: PendingChoice | null;
  timers: Record<string, TimerSpec>;
  rng: RngState;
  seed: string;
  counters: { card: number; event: number; task: number; summon: number; status: number; request: number; clock: number };
  guards: {
    tasksThisDispatch: number;
    /** Activations par passif pendant le sort courant. */
    perSpell: Record<string, number>;
    /** Activations par passif pendant le tour courant. */
    perTurn: Record<string, number>;
  };
  log: GameEvent[];
  winnerId: PlayerId | null;
  endReason: "CROWNS" | "MAX_ROUNDS" | "FORFEIT" | "DRAW" | "ENGINE_ERROR" | null;
}

export type RngState = [number, number, number, number];

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

export type GameEventType =
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "PLAYER_READY"
  | "CONNECTION_CHANGED"
  | "HOST_CHANGED"
  | "GAME_STARTED"
  | "PHASE_CHANGED"
  | "ROUND_STARTED"
  | "TURN_STARTED"
  | "TURN_ENDING"
  | "DECK_SHUFFLED"
  | "CARDS_DRAWN"
  | "CARDS_DISCARDED"
  | "CARD_STOLEN"
  | "SPELL_UPDATED"
  | "SPELL_LOCKED"
  | "SPELL_UNLOCKED"
  | "SPELLS_REVEALED"
  | "RUNE_REPLACED"
  | "INITIATIVE_SET"
  | "SPELL_CAST"
  | "SPELL_FIZZLED"
  | "RUNE_RESOLVING"
  | "DICE_ROLLED"
  | "DAMAGE"
  | "DAMAGE_PREVENTED"
  | "HP_LOST"
  | "HEAL"
  | "STATUS_APPLIED"
  | "STATUS_REMOVED"
  | "STATUS_EXPIRED"
  | "RELIC_GAINED"
  | "RELIC_LOST"
  | "RELIC_STOLEN"
  | "SUMMON_ENTERED"
  | "SUMMON_DIED"
  | "GRUDGE_DRAWN"
  | "TRIGGER_FIRED"
  | "TRIGGER_SUPPRESSED"
  | "ECHO_REPEAT"
  | "CHOICE_REQUESTED"
  | "CHOICE_MADE"
  | "EFFECT_FIZZLED"
  | "SUDDEN_DEATH"
  | "PLAYER_DIED"
  | "ROUND_ENDED"
  | "CROWN_AWARDED"
  | "GAME_OVER"
  | "ENGINE_GUARD";

export interface GameEvent {
  seq: number;
  round: number;
  turn: number;
  type: GameEventType;
  depth: number;
  causeSeq?: number;
  sourceId?: EntityId;
  targetId?: EntityId;
  amount?: number;
  tags?: string[];
  /** Données publiques. */
  data: Record<string, unknown>;
  /** Données supplémentaires visibles uniquement par certains joueurs. */
  private?: { playerIds: PlayerId[]; data: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type PlayerAction =
  | { type: "SET_READY"; ready: boolean }
  | { type: "START_GAME" }
  | { type: "PLACE_RUNE"; cardId: CardInstanceId; slot: RuneSlot }
  | { type: "REMOVE_RUNE"; slot: RuneSlot }
  | { type: "LOCK_SPELL" }
  | { type: "UNLOCK_SPELL" }
  | { type: "CHOOSE"; requestId: string; optionIds: string[] }
  | { type: "LEAVE" };

export type SystemAction =
  | { type: "JOIN"; playerId: PlayerId; name: string }
  | { type: "TIMEOUT"; timerId: string }
  | { type: "CONNECTION"; playerId: PlayerId; status: "CONNECTED" | "DISCONNECTED" }
  | { type: "ABANDON"; playerId: PlayerId };

export type DispatchInput = { playerId: PlayerId; action: PlayerAction } | { system: SystemAction };

export type RejectReason =
  | "NOT_IN_GAME"
  | "GAME_FULL"
  | "ALREADY_JOINED"
  | "GAME_ALREADY_STARTED"
  | "GAME_OVER"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "PLAYERS_NOT_READY"
  | "WRONG_PHASE"
  | "PLAYER_DEAD"
  | "CARD_NOT_IN_HAND"
  | "INVALID_SLOT"
  | "SPELL_EMPTY"
  | "SPELL_LOCKED"
  | "SPELL_NOT_LOCKED"
  | "NO_PENDING_CHOICE"
  | "NOT_YOUR_CHOICE"
  | "STALE_REQUEST"
  | "INVALID_CHOICE"
  | "STALE_TIMER"
  | "INVALID_NAME"
  | "UNKNOWN_ACTION"
  | "ENGINE_ERROR";

export type DispatchResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: RejectReason; message?: string };
