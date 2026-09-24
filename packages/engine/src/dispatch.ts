/**
 * Point d'entrée unique du moteur.
 *
 *   dispatch(state, input) → { ok: true, state', events } | { ok: false, reason }
 *
 * - Fonction pure vis-à-vis de l'appelant : `state` n'est jamais modifié ; on travaille sur une copie
 *   qui n'est retournée qu'en cas de succès (une erreur ne corrompt jamais la partie).
 * - Toutes les transitions automatiques (révélation, résolution, fin de tour…) sont enchaînées
 *   dans le même appel jusqu'à la prochaine décision attendue d'un joueur.
 */
import { Rejection } from "./errors";
import { applyPlayerAction, applySystemAction } from "./machine/actions";
import { advance } from "./machine/phases";
import type { DispatchInput, DispatchResult, GameState } from "./types";

export function dispatch(state: GameState, input: DispatchInput): DispatchResult {
  // Copie profonde de l'état, sauf le journal : ses événements sont immuables une fois émis,
  // une copie superficielle du tableau suffit (évite un coût quadratique sur les longues parties).
  const { log, ...rest } = state;
  const draft: GameState = { ...structuredClone(rest), log: log.slice() };
  const logStart = draft.log.length;
  draft.guards.tasksThisDispatch = 0;
  try {
    if ("system" in input) applySystemAction(draft, input.system);
    else applyPlayerAction(draft, input.playerId, input.action);
    advance(draft);
    draft.version += 1;
    return { ok: true, state: draft, events: draft.log.slice(logStart) };
  } catch (err) {
    if (err instanceof Rejection) return { ok: false, reason: err.reason, message: err.message };
    return { ok: false, reason: "ENGINE_ERROR", message: err instanceof Error ? err.message : String(err) };
  }
}
