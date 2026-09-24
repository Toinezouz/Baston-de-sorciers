import { defaultDeckList, pileForKind } from "../cards/registry";
import { DEFAULT_CONFIG } from "../constants";
import { seedFromString } from "../rng";
import type { GameConfig, GameState, Pile, PileId } from "../types";

export interface CreateGameOptions {
  id: string;
  seed: string;
  config?: Partial<GameConfig>;
}

/**
 * Crée une partie vide en phase LOBBY. Les instances de cartes sont générées de façon
 * déterministe (ordre du catalogue) ; le mélange a lieu au lancement de la partie.
 */
export function createGame(opts: CreateGameOptions): GameState {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...opts.config };
  const piles: Record<PileId, Pile> = {
    GRIMOIRE: { id: "GRIMOIRE", draw: [], discard: [] },
    COFFRE: { id: "COFFRE", draw: [], discard: [] },
    OUTRE_TOMBE: { id: "OUTRE_TOMBE", draw: [], discard: [] },
  };
  const state: GameState = {
    id: opts.id,
    version: 0,
    config,
    phase: "LOBBY",
    phaseEntered: true,
    suspendedPhase: null,
    hostId: null,
    players: {},
    seatOrder: [],
    cards: {},
    piles,
    summons: {},
    delayed: [],
    round: 0,
    turn: 0,
    turnState: null,
    queue: [],
    pendingChoice: null,
    timers: {},
    rng: seedFromString(opts.seed),
    seed: opts.seed,
    counters: { card: 0, event: 0, task: 0, summon: 0, status: 0, request: 0, clock: 0 },
    guards: { tasksThisDispatch: 0, perSpell: {}, perTurn: {} },
    log: [],
    winnerId: null,
    endReason: null,
  };
  for (const def of defaultDeckList()) {
    for (let i = 0; i < def.copies; i++) {
      const id = `c${++state.counters.card}`;
      state.cards[id] = { id, defId: def.id };
      piles[pileForKind(def.kind)].draw.push(id);
    }
  }
  return state;
}
