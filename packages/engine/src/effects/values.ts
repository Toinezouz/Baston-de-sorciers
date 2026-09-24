import { getCardDef } from "../cards/registry";
import { randInt } from "../rng";
import { cardDef, getHp, getPlayer, isAliveEntity, isPlayer, maxHpOf, statusesOf } from "../state/helpers";
import type { Amount, Condition, GameState, PlayerId, School } from "../types";
import type { OpContext } from "./context";
import { mySummons, resolveRawTarget, resolveTargets } from "./targeting";

/** Runes révélées du sort d'un sorcier (définitions). */
export function spellRuneDefs(state: GameState, playerId: PlayerId | undefined) {
  if (!playerId || !isPlayer(state, playerId)) return [];
  const spell = getPlayer(state, playerId).spell;
  if (!spell) return [];
  return Object.values(spell.runes)
    .filter((id): id is string => !!id)
    .map((id) => cardDef(state, id));
}

export function runesOfSchool(state: GameState, playerId: PlayerId | undefined, school: School): number {
  return spellRuneDefs(state, playerId).filter((d) => d.schools.includes(school)).length;
}

/** Nombre de runes du sort pour l'école de la rune source (bi-école : la meilleure des deux). */
export function runesMatchingCard(state: GameState, playerId: PlayerId | undefined, cardDefId: string | undefined): number {
  if (!cardDefId) return 0;
  const schools = getCardDef(cardDefId).schools;
  return Math.max(0, ...schools.map((s) => runesOfSchool(state, playerId, s)));
}

export function evalAmount(op: OpContext, amount: Amount): number {
  if (typeof amount === "number") return Math.max(0, Math.floor(amount));
  const { state, ctx } = op;
  let base = 0;
  switch (amount.from) {
    case "ROLL_TOTAL":
      base = ctx.roll ?? 0;
      break;
    case "TIER":
      base = ctx.tier ?? 0;
      break;
    case "RUNES_OF_SCHOOL":
      base = amount.school ? runesOfSchool(state, ctx.spellOwnerId ?? ctx.controllerId, amount.school) : 0;
      break;
    case "STACKS":
      base = ctx.stacks ?? 0;
      break;
    case "SELF_STATUS_STACKS": {
      const self = ctx.sourceId ?? ctx.controllerId;
      base = statusesOf(state, self)
        .filter((s) => s.defId === amount.status)
        .reduce((a, s) => a + s.stacks, 0);
      break;
    }
    case "EVENT_AMOUNT":
      base = ctx.event?.amount ?? 0;
      break;
    case "DEAD_PLAYERS":
      base = Object.values(state.players).filter((p) => p.diedThisRound).length;
      break;
    case "MISSING_HP":
      base = isAliveEntity(state, ctx.controllerId) ? maxHpOf(state, ctx.controllerId) - getHp(state, ctx.controllerId) : 0;
      break;
    case "IT_STATUS_STACKS": {
      const who = ctx.it ?? ctx.event?.targetId;
      base = who
        ? statusesOf(state, who)
            .filter((s) => s.defId === amount.status)
            .reduce((a, s) => a + s.stacks, 0)
        : 0;
      break;
    }
    case "MY_SUMMON_COUNT":
      base = mySummons(state, ctx.controllerId).length;
      break;
    case "HAND_SIZE":
      base = isPlayer(state, ctx.controllerId) ? getPlayer(state, ctx.controllerId).hand.length : 0;
      break;
    case "MY_RELIC_COUNT":
      base = isPlayer(state, ctx.controllerId) ? getPlayer(state, ctx.controllerId).relics.length : 0;
      break;
    case "ALIVE_FOES":
      base = Object.values(state.players).filter((p) => p.alive && p.id !== ctx.controllerId).length;
      break;
  }
  let v = base * (amount.mul ?? 1) + (amount.add ?? 0);
  if (amount.min !== undefined) v = Math.max(amount.min, v);
  if (amount.max !== undefined) v = Math.min(amount.max, v);
  return Math.max(0, Math.floor(v));
}

export function evalCondition(op: OpContext, cond: Condition): boolean {
  const { state, ctx } = op;
  switch (cond.c) {
    case "AND":
      return cond.of.every((c) => evalCondition(op, c));
    case "OR":
      return cond.of.some((c) => evalCondition(op, c));
    case "NOT":
      return !evalCondition(op, cond.of);
    case "HP_AT_MOST": {
      const t = resolveTargets(op, cond.who)[0];
      return t !== undefined && getHp(state, t) <= cond.value;
    }
    case "HAS_STATUS": {
      const t = resolveTargets(op, cond.who)[0];
      return t !== undefined && statusesOf(state, t).some((s) => s.defId === cond.status);
    }
    case "HAS_RELIC": {
      const t = resolveTargets(op, cond.who)[0];
      return t !== undefined && isPlayer(state, t) && getPlayer(state, t).relics.length > 0;
    }
    case "IS_DEAD": {
      const t = resolveRawTarget(op, cond.who);
      return t !== null && !isAliveEntity(state, t);
    }
    case "ROLL_AT_LEAST":
      return (ctx.roll ?? 0) >= cond.value;
    case "RUNES_OF_SCHOOL_AT_LEAST":
      return runesOfSchool(state, ctx.spellOwnerId ?? ctx.controllerId, cond.school) >= cond.value;
    case "SPELL_SIZE_AT_LEAST":
      return spellRuneDefs(state, ctx.spellOwnerId ?? ctx.controllerId).length >= cond.value;
    case "CHANCE":
      return randInt(state.rng, 100) < cond.percent;
    case "HP_AT_LEAST": {
      const t = resolveTargets(op, cond.who)[0];
      return t !== undefined && getHp(state, t) >= cond.value;
    }
    case "CONTROLS_SUMMON":
      return mySummons(state, ctx.controllerId).length > 0;
    case "CAST_FIRST":
    case "CAST_LAST": {
      const order = state.turnState?.initiativeOrder ?? [];
      const owner = ctx.spellOwnerId;
      if (!owner || !order.length) return false;
      return cond.c === "CAST_FIRST" ? order[0] === owner : order[order.length - 1] === owner;
    }
  }
}
