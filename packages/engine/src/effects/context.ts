import type { ChoiceOption, EffectContext, EffectNode, GameState, PlayerId, ResolutionTask } from "../types";
import type { EmitMeta } from "../state/events";

/** Demande de choix levée par un opérateur ; la tâche est suspendue puis rejouée avec la réponse. */
export interface ChoiceRequest {
  playerId: PlayerId;
  kind: "TARGET" | "OPTION" | "CARDS";
  key: string;
  prompt: string;
  options: ChoiceOption[];
  min: number;
  max: number;
}

export class NeedChoice {
  constructor(public readonly request: ChoiceRequest) {}
}

/** Contexte d'exécution d'un opérateur. */
export interface OpContext {
  state: GameState;
  task: ResolutionTask;
  ctx: EffectContext;
  meta: EmitMeta;
  /** Sous-effets à résoudre immédiatement après cet effet (profondeur-d'abord). */
  spawn(nodes: EffectNode[], patch?: Partial<EffectContext>): void;
}

export function makeOpContext(state: GameState, task: ResolutionTask, children: ResolutionTask[], causeSeq?: number): OpContext {
  return {
    state,
    task,
    ctx: task.ctx,
    meta: { depth: task.depth, ...(causeSeq !== undefined ? { causeSeq } : {}) },
    spawn(nodes, patch) {
      for (const node of nodes) {
        children.push({
          id: ++state.counters.task,
          depth: task.depth + 1,
          node,
          ctx: { ...task.ctx, ...patch },
          answers: {},
          ...(task.causeSeq !== undefined ? { causeSeq: task.causeSeq } : {}),
        });
      }
    },
  };
}
