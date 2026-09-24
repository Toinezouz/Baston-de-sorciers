import type { GameEvent, GameState } from "../types";

export interface EmitMeta {
  depth?: number;
  causeSeq?: number;
}

/**
 * Ajoute un événement au journal de la partie.
 * Tous les changements d'état observables passent par ici : le journal est la source
 * unique pour l'UI, les logs, les tests et les replays.
 */
export function emit(
  state: GameState,
  ev: Omit<GameEvent, "seq" | "round" | "turn" | "depth" | "data"> & { data?: Record<string, unknown> },
  meta: EmitMeta = {},
): GameEvent {
  const full: GameEvent = {
    seq: ++state.counters.event,
    round: state.round,
    turn: state.turn,
    depth: meta.depth ?? 0,
    ...(meta.causeSeq !== undefined ? { causeSeq: meta.causeSeq } : {}),
    ...ev,
    data: ev.data ?? {},
  };
  state.log.push(full);
  return full;
}
