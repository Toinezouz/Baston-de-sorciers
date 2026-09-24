/**
 * Utilitaires de test : création de parties, manipulation contrôlée de l'état, simulation.
 * Les tests passent TOUJOURS par `dispatch` pour les actions ; les manipulations directes
 * ne servent qu'à préparer une situation (main, PV…).
 */
import { botActions } from "../src/bot";
import { createGame } from "../src/state/create";
import { dispatch } from "../src/dispatch";
import { seedFromString } from "../src/rng";
import {
  RUNE_SLOTS,
  type CardDefinition,
  type DispatchInput,
  type EffectContext,
  type EffectNode,
  type GameConfig,
  type GameState,
  type PlayerAction,
  type PileId,
  type PlayerId,
  type RuneSlot,
  type School,
} from "../src/types";
import { getCardDef, hasCardDef, registerCard } from "../src/cards/registry";
import { drainQueue, enqueue, makeTasks, type DrainResult } from "../src/resolution/queue";

export function must(state: GameState, input: DispatchInput): GameState {
  const r = dispatch(state, input);
  if (!r.ok) throw new Error(`dispatch rejected: ${r.reason} ${r.message ?? ""} (${JSON.stringify(input)})`);
  return r.state;
}

export function act(state: GameState, playerId: PlayerId, action: PlayerAction): GameState {
  return must(state, { playerId, action });
}

/** Partie en lobby avec `n` joueurs (p1..pn). */
export function createLobby(n = 2, seed = "test", config: Partial<GameConfig> = {}): GameState {
  let s = createGame({ id: "TEST", seed, config });
  for (let i = 1; i <= n; i++) s = must(s, { system: { type: "JOIN", playerId: `p${i}`, name: `Joueur${i}` } });
  return s;
}

/** Partie démarrée, en phase PLANNING du tour 1. */
export function createTestGame(n = 2, seed = "test", config: Partial<GameConfig> = {}): GameState {
  let s = createLobby(n, seed, config);
  for (let i = 2; i <= n; i++) s = act(s, `p${i}`, { type: "SET_READY", ready: true });
  s = act(s, "p1", { type: "START_GAME" });
  return s;
}

/** Retire une carte de n'importe où et retourne son identifiant. */
function detachCard(s: GameState, cardId: string): void {
  for (const pile of Object.values(s.piles)) {
    pile.draw = pile.draw.filter((id) => id !== cardId);
    pile.discard = pile.discard.filter((id) => id !== cardId);
  }
  for (const p of Object.values(s.players)) {
    p.hand = p.hand.filter((id) => id !== cardId);
    p.relics = p.relics.filter((id) => id !== cardId);
    if (p.spell) for (const slot of RUNE_SLOTS) if (p.spell.runes[slot] === cardId) delete p.spell.runes[slot];
  }
}

/**
 * Crée une nouvelle instance d'une définition (hors de toute zone : l'appelant doit la placer).
 * Sert pour les cartes de test à 0 exemplaire.
 */
export function mintCard(s: GameState, defId: string): string {
  getCardDef(defId);
  const id = `t${++s.counters.card}`;
  s.cards[id] = { id, defId };
  return id;
}

/** Trouve une instance libre d'une définition (piles d'abord), ou en crée une. */
export function findInstance(s: GameState, defId: string, exclude: string[] = []): string {
  const all = Object.values(s.cards).filter((c) => c.defId === defId && !exclude.includes(c.id));
  const inPile = all.find((c) => Object.values(s.piles).some((p) => p.draw.includes(c.id) || p.discard.includes(c.id)));
  const inPlay = (id: string) =>
    Object.values(s.players).some(
      (p) => p.hand.includes(id) || p.relics.includes(id) || (p.spell && Object.values(p.spell.runes).includes(id)),
    );
  const found = inPile ?? all.find((c) => !inPlay(c.id));
  return found ? found.id : mintCard(s, defId);
}

/**
 * Déclare une rune de test (0 exemplaire : jamais présente dans une partie normale).
 * Idempotent : un même identifiant n'est enregistré qu'une fois.
 */
export function defineTestRune(
  id: string,
  slot: RuneSlot,
  effects: EffectNode[],
  opts: { schools?: School[]; initiative?: number } = {},
): string {
  const defId = `test.${id}`;
  if (!hasCardDef(defId)) {
    const def: CardDefinition = {
      id: defId,
      kind: "RUNE",
      slot,
      schools: opts.schools ?? ["ETHER"],
      copies: 0,
      name: `Test ${id}`,
      text: `Rune de test ${id}.`,
      effects,
      ...(slot === "FRAPPE" ? { initiative: opts.initiative ?? 0 } : {}),
    };
    registerCard(def);
  }
  return defId;
}

/** Déclare une relique de test. */
export function defineTestRelic(id: string, passives: NonNullable<CardDefinition["passives"]>, eternal = false): string {
  const defId = `test.relic.${id}`;
  if (!hasCardDef(defId)) {
    registerCard({ id: defId, kind: "RELIC", schools: [], copies: 0, name: `Relique ${id}`, text: `Relique de test ${id}.`, effects: [], passives, eternal });
  }
  return defId;
}

/**
 * Exécute directement une liste d'effets pour `controllerId` (hors sort), sur l'état fourni (muté).
 * Pour tester un opérateur isolément ; les choix éventuels laissent la file suspendue.
 */
export function runEffects(s: GameState, controllerId: PlayerId, nodes: EffectNode[], ctx: Partial<EffectContext> = {}): DrainResult {
  s.guards.tasksThisDispatch = 0;
  enqueue(s, makeTasks(s, nodes, { sourceId: controllerId, controllerId, label: "test", ...ctx }));
  return drainQueue(s);
}

/**
 * Remplace la main d'un joueur par les runes données (les anciennes retournent dans la pioche).
 * Retourne les identifiants d'instance, dans l'ordre.
 */
export function setHand(s: GameState, playerId: PlayerId, defIds: string[]): string[] {
  const p = s.players[playerId]!;
  s.piles.GRIMOIRE.draw.push(...p.hand);
  p.hand = [];
  const ids: string[] = [];
  for (const defId of defIds) {
    const id = findInstance(s, defId, ids);
    detachCard(s, id);
    p.hand.push(id);
    ids.push(id);
  }
  return ids;
}

export function giveRelic(s: GameState, playerId: PlayerId, defId: string): string {
  const id = findInstance(s, defId);
  detachCard(s, id);
  s.players[playerId]!.relics.push(id);
  return id;
}

/** Place des cartes connues sur le dessus d'une pile (pour contrôler les pioches). */
export function stackPile(s: GameState, pileId: PileId, defIds: string[]): string[] {
  const ids: string[] = [];
  for (const defId of defIds) {
    const id = findInstance(s, defId, ids);
    detachCard(s, id);
    ids.push(id);
  }
  s.piles[pileId].draw.unshift(...ids);
  return ids;
}

export function stackGrimoire(s: GameState, defIds: string[]): string[] {
  return stackPile(s, "GRIMOIRE", defIds);
}

/** Pose un sort complet (runes = defIds par emplacement) et le verrouille. */
export function castSpell(s: GameState, playerId: PlayerId, runes: Partial<Record<RuneSlot, string>>): GameState {
  const p = s.players[playerId]!;
  // Ajoute les runes à la main si nécessaire.
  const ids: Partial<Record<RuneSlot, string>> = {};
  for (const slot of RUNE_SLOTS) {
    const defId = runes[slot];
    if (!defId) continue;
    let id = p.hand.find((h) => s.cards[h]!.defId === defId && !Object.values(ids).includes(h));
    if (!id) {
      id = findInstance(s, defId, [...Object.values(ids)] as string[]);
      detachCard(s, id);
      p.hand.push(id);
    }
    ids[slot] = id;
  }
  let st = s;
  for (const slot of RUNE_SLOTS) {
    const id = ids[slot];
    if (id) st = act(st, playerId, { type: "PLACE_RUNE", cardId: id, slot });
  }
  return act(st, playerId, { type: "LOCK_SPELL" });
}

export function hp(s: GameState, playerId: PlayerId): number {
  return s.players[playerId]!.hp;
}

/** Vérifie que chaque carte est à exactement un endroit. */
export function assertCardConservation(s: GameState): void {
  const seen = new Map<string, string>();
  const see = (id: string, where: string) => {
    if (seen.has(id)) throw new Error(`Card ${id} both in ${seen.get(id)} and ${where}`);
    seen.set(id, where);
  };
  for (const pile of Object.values(s.piles)) {
    pile.draw.forEach((id) => see(id, `${pile.id}.draw`));
    pile.discard.forEach((id) => see(id, `${pile.id}.discard`));
  }
  for (const p of Object.values(s.players)) {
    p.hand.forEach((id) => see(id, `${p.id}.hand`));
    p.relics.forEach((id) => see(id, `${p.id}.relics`));
    if (p.spell) for (const slot of RUNE_SLOTS) if (p.spell.runes[slot]) see(p.spell.runes[slot]!, `${p.id}.spell`);
  }
  const total = Object.keys(s.cards).length;
  if (seen.size !== total) {
    const missing = Object.keys(s.cards).filter((id) => !seen.has(id));
    throw new Error(`Lost cards: ${missing.map((id) => `${id}(${getCardDef(s.cards[id]!.defId).id})`).join(", ")}`);
  }
}

export interface BotGameOptions {
  players?: number;
  seed?: string;
  config?: Partial<GameConfig>;
  maxSteps?: number;
  /** Probabilité (0–100) qu'un bot laisse expirer son temps au lieu de jouer. */
  idlePercent?: number;
  /** Vérifie les invariants après chaque action (plus lent). */
  checkInvariants?: boolean;
  onStep?: (s: GameState) => void;
}

/** Joue une partie complète entre bots ; retourne l'état final et le nombre d'actions. */
export function runBotGame(opts: BotGameOptions = {}): { state: GameState; steps: number } {
  const n = opts.players ?? 3;
  const seed = opts.seed ?? "sim";
  let s = createTestGame(n, seed, opts.config);
  const rng = seedFromString(`${seed}:bots`);
  let steps = 0;
  const maxSteps = opts.maxSteps ?? 20_000;
  while (s.phase !== "GAME_OVER") {
    if (++steps > maxSteps) throw new Error(`Game did not finish in ${maxSteps} steps (phase ${s.phase})`);
    let acted = false;
    for (const pid of s.seatOrder) {
      const idle = opts.idlePercent ? rng[0] % 100 < opts.idlePercent : false;
      const actions = botActions(s, pid, rng);
      if (idle && actions.length) continue;
      for (const a of actions) {
        s = act(s, pid, a);
        acted = true;
        if (opts.checkInvariants) assertCardConservation(s);
      }
      if (acted) break;
    }
    if (!acted) {
      const timer = Object.values(s.timers)[0];
      if (!timer) throw new Error(`Game stuck in phase ${s.phase}`);
      s = must(s, { system: { type: "TIMEOUT", timerId: timer.id } });
      if (opts.checkInvariants) assertCardConservation(s);
    }
    opts.onStep?.(s);
  }
  return { state: s, steps };
}
