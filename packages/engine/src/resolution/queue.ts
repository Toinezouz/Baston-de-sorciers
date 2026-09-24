/**
 * File de résolution déterministe.
 *
 *   tâche = queue.shift()
 *     → garde-fous (profondeur, budget)
 *     → opérateur (peut suspendre pour un choix)
 *     → contrôle des morts
 *     → collecte des déclencheurs (sur tous les événements produits)
 *     → queue = [...déclencheurs, ...sous-effets, ...reste]   (profondeur-d'abord)
 */
import { GUARDS } from "../constants";
import { makeOpContext, NeedChoice, type ChoiceRequest } from "../effects/context";
import { runOperator } from "../effects/operators";
import { emit } from "../state/events";
import { getPlayer, nextId } from "../state/helpers";
import { pickN } from "../rng";
import type { EffectContext, EffectNode, GameState, PlayerId, ResolutionTask } from "../types";
import { finalizeDeaths, markDeaths } from "./deaths";
import { collectTriggers } from "./triggers";

export type DrainResult = "DONE" | "SUSPENDED";

export function makeTasks(state: GameState, nodes: EffectNode[], ctx: EffectContext, depth = 0, causeSeq?: number): ResolutionTask[] {
  return nodes.map((node) => ({
    id: ++state.counters.task,
    depth,
    node,
    ctx,
    answers: {},
    ...(causeSeq !== undefined ? { causeSeq } : {}),
  }));
}

/** Ajoute des tâches en fin de file. */
export function enqueue(state: GameState, tasks: ResolutionTask[]): void {
  state.queue.push(...tasks);
}

/**
 * Traite les déclencheurs issus d'événements émis HORS de la file (début/fin de tour, sort lancé…).
 * `fromIndex` = longueur du journal avant ces événements.
 */
export function enqueueTriggersSince(state: GameState, fromIndex: number, startId: PlayerId | null): void {
  const dead = markDeaths(state, startId, {});
  state.queue.unshift(...collectTriggers(state, state.log.slice(fromIndex), startId, 1));
  if (dead.length) finalizeDeaths(state, dead, {});
}

function openChoice(state: GameState, req: ChoiceRequest): void {
  const p = state.players[req.playerId];
  // Un sorcier ayant abandonné ne bloque jamais la partie : choix automatique. [RULE D7]
  if (!p || p.connection === "ABANDONED") {
    const task = state.queue[0];
    if (task) task.answers[req.key] = pickN(state.rng, req.options.map((o) => o.id), req.min);
    return;
  }
  const requestId = nextId(state, "request");
  const timerId = `choice-${requestId}`;
  state.pendingChoice = { requestId, timerId, ...req };
  state.timers[timerId] = { id: timerId, kind: "CHOICE", durationMs: state.config.choiceMs, playerId: req.playerId };
  emit(state, {
    type: "CHOICE_REQUESTED",
    targetId: req.playerId,
    data: { requestId, kind: req.kind, prompt: req.prompt },
    private: { playerIds: [req.playerId], data: { options: req.options, min: req.min, max: req.max } },
  });
}

/**
 * Enregistre la réponse à un choix (déjà validée) sur la tâche suspendue et lève la suspension.
 */
export function answerChoice(state: GameState, optionIds: string[], auto: boolean): void {
  const pending = state.pendingChoice;
  const task = state.queue[0];
  if (!pending || !task) return;
  task.answers[pending.key] = optionIds;
  delete state.timers[pending.timerId];
  state.pendingChoice = null;
  const labels = optionIds.map((id) => pending.options.find((o) => o.id === id)?.label ?? id);
  emit(state, { type: "CHOICE_MADE", targetId: pending.playerId, data: { requestId: pending.requestId, optionIds, labels, auto } });
}

export function drainQueue(state: GameState): DrainResult {
  while (state.queue.length > 0) {
    if (state.pendingChoice) return "SUSPENDED";
    if (++state.guards.tasksThisDispatch > GUARDS.MAX_TASKS_PER_DISPATCH) {
      emit(state, { type: "ENGINE_GUARD", data: { reason: "TASK_BUDGET", dropped: state.queue.length } });
      state.queue = [];
      return "DONE";
    }
    const task = state.queue.shift()!;
    if (task.depth > GUARDS.MAX_DEPTH) {
      emit(state, { type: "ENGINE_GUARD", data: { reason: "MAX_DEPTH", op: task.node.op, label: task.ctx.label ?? null } }, { depth: task.depth });
      continue;
    }

    const logBefore = state.log.length;
    const eventCounterBefore = state.counters.event;
    const rngBefore = [...state.rng] as GameState["rng"];
    const children: ResolutionTask[] = [];
    try {
      runOperator(makeOpContext(state, task, children, task.causeSeq));
    } catch (err) {
      if (!(err instanceof NeedChoice)) throw err;
      // Les opérateurs demandent leurs choix avant toute mutation : on annule les éventuels
      // événements/tirages et on rejouera la tâche à l'identique avec la réponse.
      state.log.length = logBefore;
      state.counters.event = eventCounterBefore;
      state.rng = rngBefore;
      state.queue.unshift(task);
      openChoice(state, err.request);
      if (state.pendingChoice) return "SUSPENDED";
      continue; // choix automatique : on rejoue immédiatement
    }

    const meta = { depth: task.depth };
    const dead = markDeaths(state, task.ctx.controllerId, meta);
    const newEvents = state.log.slice(logBefore);
    const triggered = collectTriggers(state, newEvents, task.ctx.controllerId, task.depth + 1);
    if (dead.length) finalizeDeaths(state, dead, meta);
    state.queue.unshift(...triggered, ...children);
  }
  return "DONE";
}

export function alivePlayerCount(state: GameState): number {
  return state.seatOrder.filter((id) => getPlayer(state, id).alive).length;
}
