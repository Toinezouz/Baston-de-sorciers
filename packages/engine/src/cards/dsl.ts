/**
 * Petit DSL pour écrire les cartes de manière lisible.
 * Les cartes restent des données JSON : ces helpers ne font que construire des objets.
 */
import type { Amount, Condition, EffectNode, School, StatusDefId, TargetSpec } from "../types";

export const T = {
  SELF: { sel: "SELF" },
  CONTROLLER: { sel: "CONTROLLER" },
  HOLDER: { sel: "HOLDER" },
  LEFT: { sel: "LEFT" },
  RIGHT: { sel: "RIGHT" },
  ALL_FOES: { sel: "ALL_FOES" },
  ALL_PLAYERS: { sel: "ALL_PLAYERS" },
  STRONGEST_FOE: { sel: "STRONGEST_FOE" },
  WEAKEST_FOE: { sel: "WEAKEST_FOE" },
  RANDOM_FOE: { sel: "RANDOM_FOE" },
  ALL_FOE_SUMMONS: { sel: "ALL_FOE_SUMMONS" },
  MY_KILLER: { sel: "MY_KILLER" },
  EVENT_SOURCE: { sel: "EVENT_SOURCE" },
  EVENT_TARGET: { sel: "EVENT_TARGET" },
  IT: { sel: "IT" },
  CHOSEN_FOE: { sel: "CHOSEN", among: "FOES" },
  CHOSEN_FOE_OR_SUMMON: { sel: "CHOSEN", among: "FOES_AND_SUMMONS" },
} as const satisfies Record<string, TargetSpec>;

export const dmg = (target: TargetSpec, amount: Amount, school?: School, tags?: string[]): EffectNode => ({
  op: "DAMAGE",
  target,
  amount,
  ...(school ? { school } : {}),
  ...(tags ? { tags } : {}),
});

export const heal = (target: TargetSpec, amount: Amount): EffectNode => ({ op: "HEAL", target, amount });

export const drain = (target: TargetSpec, amount: Amount, school?: School): EffectNode => ({
  op: "DRAIN",
  target,
  amount,
  ...(school ? { school } : {}),
});

export const loseHp = (target: TargetSpec, amount: Amount): EffectNode => ({ op: "LOSE_HP", target, amount });

export const status = (
  target: TargetSpec,
  id: StatusDefId,
  opts: { stacks?: Amount; duration?: number | "PERMANENT" } = {},
): EffectNode => ({ op: "APPLY_STATUS", target, status: id, ...opts });

export const draw = (target: TargetSpec, count: Amount): EffectNode => ({ op: "DRAW", target, count });

export const power = (
  school: School | "SELF",
  t1: EffectNode[],
  t2: EffectNode[],
  t3: EffectNode[],
): EffectNode => ({ op: "POWER_ROLL", school, tiers: [t1, t2, t3] });

export const iff = (cond: Condition, then: EffectNode[], otherwise?: EffectNode[]): EffectNode => ({
  op: "IF",
  cond,
  then,
  ...(otherwise ? { else: otherwise } : {}),
});

export const forEach = (target: TargetSpec, effects: EffectNode[]): EffectNode => ({ op: "FOR_EACH", target, effects });
