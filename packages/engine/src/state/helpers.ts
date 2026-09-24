import { getCardDef, getStatusDef, getSummonDef, pileForKind } from "../cards/registry";
import { EngineError } from "../errors";
import { shuffleInPlace } from "../rng";
import type {
  CardDefinition,
  CardInstanceId,
  EntityId,
  GameState,
  ModifierHook,
  PassiveDefinition,
  PileId,
  Player,
  PlayerId,
  StatusInstance,
  Summon,
} from "../types";
import { emit, type EmitMeta } from "./events";

// ---------------------------------------------------------------------------
// Joueurs et entités
// ---------------------------------------------------------------------------

export function getPlayer(state: GameState, id: PlayerId): Player {
  const p = state.players[id];
  if (!p) throw new EngineError(`Unknown player ${id}`);
  return p;
}

export function isPlayer(state: GameState, id: EntityId): boolean {
  return id in state.players;
}

export function getSummon(state: GameState, id: EntityId): Summon | undefined {
  return state.summons[id];
}

/** Sorciers vivants, dans l'ordre des sièges. */
export function alivePlayers(state: GameState): Player[] {
  return state.seatOrder.map((id) => getPlayer(state, id)).filter((p) => p.alive);
}

/** Sièges réordonnés en commençant par `startId` (inclus). */
export function seatOrderFrom(state: GameState, startId: PlayerId | null | undefined): PlayerId[] {
  const idx = startId ? state.seatOrder.indexOf(startId) : -1;
  if (idx < 0) return [...state.seatOrder];
  return [...state.seatOrder.slice(idx), ...state.seatOrder.slice(0, idx)];
}

/** Prochain sorcier vivant « à gauche » (siège suivant), ou null. */
export function leftOf(state: GameState, id: PlayerId): PlayerId | null {
  const order = seatOrderFrom(state, id).slice(1);
  return order.find((pid) => getPlayer(state, pid).alive) ?? null;
}

/** Sorcier vivant « à droite » (siège précédent), ou null. */
export function rightOf(state: GameState, id: PlayerId): PlayerId | null {
  const order = seatOrderFrom(state, id).slice(1).reverse();
  return order.find((pid) => getPlayer(state, pid).alive) ?? null;
}

export function controllerOf(state: GameState, id: EntityId): PlayerId | null {
  if (isPlayer(state, id)) return id;
  return state.summons[id]?.controllerId ?? null;
}

export function isFoe(state: GameState, a: EntityId, b: EntityId): boolean {
  const ca = controllerOf(state, a);
  const cb = controllerOf(state, b);
  return ca !== null && cb !== null && ca !== cb;
}

/** Une entité est « en jeu » : sorcier vivant ou invocation présente. */
export function isAliveEntity(state: GameState, id: EntityId): boolean {
  if (isPlayer(state, id)) return getPlayer(state, id).alive;
  return id in state.summons;
}

export function getHp(state: GameState, id: EntityId): number {
  if (isPlayer(state, id)) return getPlayer(state, id).hp;
  return state.summons[id]?.hp ?? 0;
}

export function setHp(state: GameState, id: EntityId, hp: number): void {
  if (isPlayer(state, id)) getPlayer(state, id).hp = hp;
  else {
    const s = state.summons[id];
    if (s) s.hp = hp;
  }
}

export function statusesOf(state: GameState, id: EntityId): StatusInstance[] {
  if (isPlayer(state, id)) return getPlayer(state, id).statuses;
  return state.summons[id]?.statuses ?? [];
}

export function entityName(state: GameState, id: EntityId | null | undefined): string {
  if (!id) return "?";
  if (isPlayer(state, id)) return getPlayer(state, id).name;
  const s = state.summons[id];
  if (!s) return "?";
  return `${getSummonDef(s.defId).name} (${getPlayer(state, s.controllerId).name})`;
}

// ---------------------------------------------------------------------------
// Passifs
// ---------------------------------------------------------------------------

export interface PassiveRef {
  /** Clé stable (compteurs anti-boucle). */
  key: string;
  holderId: EntityId;
  controllerId: PlayerId;
  passive: PassiveDefinition;
  stacks: number;
  label: string;
  /** Statut porteur (pour `consume` et l'absorption). */
  status?: StatusInstance;
  /** Source du statut (crédit des dégâts sur la durée). */
  statusSourceId?: EntityId | null;
  cardDefId?: string;
}

/** Passifs portés directement par une entité (statuts, reliques, capacités d'invocation). */
export function passivesOf(state: GameState, id: EntityId): PassiveRef[] {
  const out: PassiveRef[] = [];
  const controllerId = controllerOf(state, id);
  if (!controllerId) return out;
  for (const st of statusesOf(state, id)) {
    const def = getStatusDef(st.defId);
    def.passives.forEach((passive, i) =>
      out.push({
        key: `st:${st.id}:${i}`,
        holderId: id,
        controllerId,
        passive,
        stacks: st.stacks,
        label: def.name,
        status: st,
        statusSourceId: st.sourceId,
      }),
    );
  }
  if (isPlayer(state, id)) {
    for (const cardId of getPlayer(state, id).relics) {
      const def = cardDef(state, cardId);
      (def.passives ?? []).forEach((passive, i) =>
        out.push({ key: `rel:${cardId}:${i}`, holderId: id, controllerId, passive, stacks: 1, label: def.name, cardDefId: def.id }),
      );
    }
  } else {
    const s = state.summons[id];
    if (s) {
      const def = getSummonDef(s.defId);
      def.passives.forEach((passive, i) =>
        out.push({ key: `sum:${s.id}:${i}`, holderId: id, controllerId, passive, stacks: 1, label: def.name }),
      );
    }
  }
  return out;
}

/**
 * Tous les passifs de la table dans l'ordre déterministe [RULE D8] :
 * sorciers dans l'ordre des sièges depuis `startId` ; pour chacun : statuts, reliques,
 * puis ses invocations (ordre d'arrivée) avec leurs statuts et capacités.
 */
export function allPassives(state: GameState, startId: PlayerId | null | undefined): PassiveRef[] {
  const out: PassiveRef[] = [];
  const summonsByController = Object.values(state.summons).sort((a, b) => a.enteredAt - b.enteredAt);
  for (const pid of seatOrderFrom(state, startId)) {
    out.push(...passivesOf(state, pid));
    for (const s of summonsByController) if (s.controllerId === pid) out.push(...passivesOf(state, s.id));
  }
  return out;
}

/** Somme des modificateurs ADD d'un crochet (hors DAMAGE/HEAL, gérés par le pipeline). */
export function sumModifier(state: GameState, id: EntityId, hook: ModifierHook): number {
  let total = 0;
  for (const ref of passivesOf(state, id)) {
    const m = ref.passive.modifier;
    if (m && m.hook === hook && m.kind === "ADD") total += (m.value ?? 0) * ref.stacks;
  }
  return total;
}

export function maxHpOf(state: GameState, id: EntityId): number {
  if (isPlayer(state, id)) return Math.max(1, getPlayer(state, id).baseMaxHp + sumModifier(state, id, "MAX_HP"));
  return state.summons[id]?.maxHp ?? 0;
}

export function handSizeOf(state: GameState, id: PlayerId): number {
  return Math.max(1, state.config.handSize + sumModifier(state, id, "HAND_SIZE"));
}

// ---------------------------------------------------------------------------
// Cartes et piles
// ---------------------------------------------------------------------------

export function cardDef(state: GameState, cardId: CardInstanceId): CardDefinition {
  const inst = state.cards[cardId];
  if (!inst) throw new EngineError(`Unknown card instance ${cardId}`);
  return getCardDef(inst.defId);
}

/**
 * Pioche `n` cartes d'une pile. Si la pioche est vide, la défausse est remélangée (RNG serveur).
 * Retourne moins de `n` cartes si la pile est entièrement épuisée.
 */
export function drawFromPile(state: GameState, pileId: PileId, n: number, meta: EmitMeta = {}): CardInstanceId[] {
  const pile = state.piles[pileId];
  const out: CardInstanceId[] = [];
  for (let i = 0; i < n; i++) {
    if (pile.draw.length === 0) {
      if (pile.discard.length === 0) break;
      pile.draw = shuffleInPlace(state.rng, pile.discard);
      pile.discard = [];
      emit(state, { type: "DECK_SHUFFLED", data: { pile: pileId, count: pile.draw.length } }, meta);
    }
    const id = pile.draw.shift();
    if (id) out.push(id);
  }
  return out;
}

/** Remet une carte dans la défausse de sa pile d'origine. */
export function discardCard(state: GameState, cardId: CardInstanceId): void {
  const pileId = pileForKind(cardDef(state, cardId).kind);
  state.piles[pileId].discard.push(cardId);
}

/** Complète la main d'un sorcier jusqu'à sa taille de main. */
export function refillHand(state: GameState, playerId: PlayerId, meta: EmitMeta = {}): void {
  const p = getPlayer(state, playerId);
  const missing = handSizeOf(state, playerId) - p.hand.length;
  if (missing <= 0) return;
  const drawn = drawFromPile(state, "GRIMOIRE", missing, meta);
  if (drawn.length === 0) return;
  p.hand.push(...drawn);
  emit(
    state,
    {
      type: "CARDS_DRAWN",
      targetId: playerId,
      amount: drawn.length,
      data: { count: drawn.length },
      private: { playerIds: [playerId], data: { cards: drawn.map((id) => ({ id, defId: state.cards[id]?.defId })) } },
    },
    meta,
  );
}

const ID_PREFIX = { summon: "inv", status: "st", request: "req" } as const;

/** Identifiants internes déterministes (les préfixes évitent toute collision). */
export function nextId(state: GameState, kind: keyof typeof ID_PREFIX): string {
  const n = ++state.counters[kind];
  return `${ID_PREFIX[kind]}${n}`;
}

export function tick(state: GameState): number {
  return ++state.counters.clock;
}
