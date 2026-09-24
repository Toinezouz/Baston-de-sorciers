/**
 * Registre des opérateurs d'effet.
 *
 * Chaque `op` du langage d'effets (voir `EffectNode`) est associé à UNE fonction.
 * Ajouter une mécanique = ajouter un type dans `EffectNode` + un opérateur ici.
 * Aucune carte n'a de logique spécifique : les cartes ne sont que des données.
 *
 * Contrat des opérateurs :
 *   - résoudre les cibles et demander les choix AVANT toute mutation (un choix suspend
 *     la tâche, qui sera rejouée à l'identique avec la réponse) ;
 *   - n'utiliser que `state.rng` pour le hasard ;
 *   - émettre un événement pour chaque changement observable.
 */
import { getStatusDef, getSummonDef } from "../cards/registry";
import { GUARDS, POWER_TIERS } from "../constants";
import { EngineError } from "../errors";
import { pickN, rollD6, weightedIndex } from "../rng";
import { emit } from "../state/events";
import {
  cardDef,
  discardCard,
  drawFromPile,
  getPlayer,
  isAliveEntity,
  isPlayer,
  nextId,
  sumModifier,
  tick,
} from "../state/helpers";
import type { EffectNode, EffectOp, EntityId, PlayerId, StatusInstance } from "../types";
import { NeedChoice, type OpContext } from "./context";
import { applyDamage, applyHeal, applyLoseHp, applyStatus, consumeStatuses, removeStatuses } from "./pipeline";
import { resolveTargets } from "./targeting";
import { evalAmount, evalCondition, runesMatchingCard, runesOfSchool } from "./values";

type Operator<K extends EffectOp> = (op: OpContext, node: Extract<EffectNode, { op: K }>) => void;
type OperatorTable = { [K in EffectOp]: Operator<K> };

/** Nombre maximal d'invocations contrôlées par un sorcier (la plus ancienne disparaît). [RULE D14] */
const MAX_SUMMONS_PER_PLAYER = 3;

function playersOnly(op: OpContext, ids: EntityId[]): PlayerId[] {
  return ids.filter((id) => isPlayer(op.state, id));
}

/** Entité qui agit (peut être morte : une Brûlure continue d'agir après la mort de son lanceur). */
function actingSource(op: OpContext): EntityId | null {
  return op.ctx.sourceId ?? null;
}

const operators: OperatorTable = {
  DAMAGE(op, node) {
    const targets = resolveTargets(op, node.target);
    const amount = evalAmount(op, node.amount);
    // Surcharge & co. : appliqué à toutes les cibles, consommé une seule fois. [RULE D21]
    const consumed = new Map<StatusInstance, EntityId>();
    for (const targetId of targets) {
      applyDamage(op.state, {
        sourceId: actingSource(op),
        targetId,
        amount,
        ...(node.school ? { school: node.school } : {}),
        ...(node.tags ? { tags: node.tags } : {}),
        meta: op.meta,
        consumed,
      });
    }
    consumeStatuses(op.state, consumed, op.meta);
  },

  HEAL(op, node) {
    const targets = resolveTargets(op, node.target);
    const amount = evalAmount(op, node.amount);
    for (const t of targets) applyHeal(op.state, actingSource(op), t, amount, op.meta);
  },

  DRAIN(op, node) {
    const targets = resolveTargets(op, node.target);
    const amount = evalAmount(op, node.amount);
    const consumed = new Map<StatusInstance, EntityId>();
    const src = actingSource(op);
    for (const targetId of targets) {
      const dealt = applyDamage(op.state, {
        sourceId: src,
        targetId,
        amount,
        ...(node.school ? { school: node.school } : {}),
        meta: op.meta,
        consumed,
      });
      // Le vol de vie rend les PV réellement retirés (après modificateurs).
      if (dealt > 0 && src) applyHeal(op.state, src, src, dealt, op.meta);
    }
    consumeStatuses(op.state, consumed, op.meta);
  },

  LOSE_HP(op, node) {
    const targets = resolveTargets(op, node.target);
    const amount = evalAmount(op, node.amount);
    for (const t of targets) applyLoseHp(op.state, actingSource(op), t, amount, op.meta);
  },

  APPLY_STATUS(op, node) {
    const targets = resolveTargets(op, node.target);
    const stacks = node.stacks === undefined ? 1 : evalAmount(op, node.stacks);
    for (const t of targets) applyStatus(op.state, actingSource(op), t, node.status, stacks, node.duration, op.meta);
  },

  REMOVE_STATUS(op, node) {
    const targets = resolveTargets(op, node.target);
    for (const t of targets) {
      removeStatuses(
        op.state,
        t,
        (s) =>
          (node.status === undefined || s.defId === node.status) &&
          (node.polarity === undefined || getStatusDef(s.defId).polarity === node.polarity),
        "DISPELLED",
        op.meta,
      );
    }
  },

  DRAW(op, node) {
    const targets = playersOnly(op, resolveTargets(op, node.target));
    const count = evalAmount(op, node.count);
    for (const pid of targets) {
      const drawn = drawFromPile(op.state, "GRIMOIRE", count, op.meta);
      if (!drawn.length) continue;
      getPlayer(op.state, pid).hand.push(...drawn);
      emit(
        op.state,
        {
          type: "CARDS_DRAWN",
          targetId: pid,
          amount: drawn.length,
          data: { count: drawn.length },
          private: { playerIds: [pid], data: { cards: drawn.map((id) => ({ id, defId: op.state.cards[id]?.defId })) } },
        },
        op.meta,
      );
    }
  },

  DISCARD(op, node) {
    const targets = playersOnly(op, resolveTargets(op, node.target));
    const count = evalAmount(op, node.count);
    // 1) Toutes les décisions d'abord (choix éventuels), 2) puis les mutations.
    const plan: { pid: PlayerId; cards: string[] }[] = [];
    for (const pid of targets) {
      const hand = getPlayer(op.state, pid).hand;
      const n = Math.min(count, hand.length);
      if (n <= 0) continue;
      if (node.mode === "RANDOM") {
        plan.push({ pid, cards: pickN(op.state.rng, hand, n) });
        continue;
      }
      const key = `discard:${pid}`;
      const answer = op.task.answers[key];
      if (answer && answer.length === n && answer.every((id) => hand.includes(id)) && new Set(answer).size === n) {
        plan.push({ pid, cards: answer });
        continue;
      }
      throw new NeedChoice({
        playerId: pid,
        kind: "CARDS",
        key,
        prompt: `Défausse ${n} rune(s)`,
        options: hand.map((id) => ({ id, label: cardDef(op.state, id).name })),
        min: n,
        max: n,
      });
    }
    for (const { pid, cards } of plan) {
      const p = getPlayer(op.state, pid);
      p.hand = p.hand.filter((id) => !cards.includes(id));
      for (const id of cards) discardCard(op.state, id);
      emit(
        op.state,
        { type: "CARDS_DISCARDED", targetId: pid, amount: cards.length, data: { cards: cards.map((id) => op.state.cards[id]?.defId) } },
        op.meta,
      );
    }
  },

  STEAL_CARD(op, node) {
    const thief = op.ctx.controllerId;
    const victims = playersOnly(op, resolveTargets(op, node.from, "from")).filter((id) => id !== thief);
    const count = evalAmount(op, node.count);
    if (!isAliveEntity(op.state, thief)) return;
    for (const pid of victims) {
      const victim = getPlayer(op.state, pid);
      const stolen = pickN(op.state.rng, victim.hand, Math.min(count, victim.hand.length));
      if (!stolen.length) continue;
      victim.hand = victim.hand.filter((id) => !stolen.includes(id));
      getPlayer(op.state, thief).hand.push(...stolen);
      emit(
        op.state,
        {
          type: "CARD_STOLEN",
          sourceId: thief,
          targetId: pid,
          amount: stolen.length,
          data: { count: stolen.length },
          private: { playerIds: [thief, pid], data: { cards: stolen.map((id) => ({ id, defId: op.state.cards[id]?.defId })) } },
        },
        op.meta,
      );
    }
  },

  GAIN_RELIC(op, node) {
    const targets = playersOnly(op, resolveTargets(op, node.target));
    const count = evalAmount(op, node.count);
    for (const pid of targets) {
      for (const id of drawFromPile(op.state, "COFFRE", count, op.meta)) {
        getPlayer(op.state, pid).relics.push(id);
        emit(op.state, { type: "RELIC_GAINED", targetId: pid, data: { card: id, defId: op.state.cards[id]?.defId } }, op.meta);
      }
    }
  },

  STEAL_RELIC(op, node) {
    const thief = op.ctx.controllerId;
    if (!isAliveEntity(op.state, thief)) return;
    const victims = playersOnly(op, resolveTargets(op, node.from, "from")).filter((id) => id !== thief);
    for (const pid of victims) {
      const victim = getPlayer(op.state, pid);
      const [relic] = pickN(op.state.rng, victim.relics, 1);
      if (!relic) continue;
      victim.relics = victim.relics.filter((id) => id !== relic);
      getPlayer(op.state, thief).relics.push(relic);
      emit(op.state, { type: "RELIC_STOLEN", sourceId: thief, targetId: pid, data: { card: relic, defId: op.state.cards[relic]?.defId } }, op.meta);
    }
  },

  SUMMON(op, node) {
    const controllerId = op.ctx.controllerId;
    if (!isAliveEntity(op.state, controllerId)) return;
    const def = getSummonDef(node.summon);
    const mine = Object.values(op.state.summons)
      .filter((s) => s.controllerId === controllerId)
      .sort((a, b) => a.enteredAt - b.enteredAt);
    if (mine.length >= MAX_SUMMONS_PER_PLAYER) {
      const oldest = mine[0]!;
      delete op.state.summons[oldest.id];
      emit(op.state, { type: "SUMMON_DIED", targetId: oldest.id, data: { defId: oldest.defId, controllerId, reason: "REPLACED" } }, op.meta);
    }
    const id = nextId(op.state, "summon");
    op.state.summons[id] = { id, defId: def.id, controllerId, hp: def.maxHp, maxHp: def.maxHp, statuses: [], enteredAt: tick(op.state) };
    emit(op.state, { type: "SUMMON_ENTERED", sourceId: controllerId, targetId: id, data: { defId: def.id, hp: def.maxHp } }, op.meta);
  },

  POWER_ROLL(op, node) {
    const { state, ctx } = op;
    const owner = ctx.spellOwnerId ?? ctx.controllerId;
    let dice: number;
    if (node.dice !== undefined) dice = node.dice;
    else if (node.school === undefined || node.school === "SELF") dice = runesMatchingCard(state, owner, ctx.cardDefId);
    else dice = runesOfSchool(state, owner, node.school);
    dice = Math.max(1, dice);
    if (isAliveEntity(state, ctx.controllerId)) dice += sumModifier(state, ctx.controllerId, "DICE");
    dice = Math.min(GUARDS.MAX_DICE, Math.max(1, dice));
    const rolls = Array.from({ length: dice }, () => rollD6(state.rng));
    const total = rolls.reduce((a, b) => a + b, 0);
    const tier = total >= POWER_TIERS[1] ? 3 : total >= POWER_TIERS[0] ? 2 : 1;
    emit(state, { type: "DICE_ROLLED", sourceId: ctx.controllerId, amount: total, data: { rolls, total, tier, label: ctx.label ?? null } }, op.meta);
    op.spawn(node.tiers[tier - 1] ?? [], { roll: total, tier });
  },

  IF(op, node) {
    op.spawn(evalCondition(op, node.cond) ? node.then : node.else ?? []);
  },

  FOR_EACH(op, node) {
    for (const id of resolveTargets(op, node.target)) op.spawn(node.effects, { it: id });
  },

  CHOOSE_OPTION(op, node) {
    const key = "option";
    const answer = op.task.answers[key]?.[0];
    const idx = answer === undefined ? -1 : Number(answer);
    if (!Number.isInteger(idx) || idx < 0 || idx >= node.options.length) {
      throw new NeedChoice({
        playerId: op.ctx.controllerId,
        kind: "OPTION",
        key,
        prompt: node.prompt,
        options: node.options.map((o, i) => ({ id: String(i), label: o.label })),
        min: 1,
        max: 1,
      });
    }
    op.spawn(node.options[idx]!.effects);
  },

  RANDOM(op, node) {
    const idx = weightedIndex(op.state.rng, node.branches.map((b) => b.weight));
    op.spawn(node.branches[idx]?.effects ?? []);
  },

  REPEAT(op, node) {
    const times = Math.min(10, evalAmount(op, node.times));
    for (let i = 0; i < times; i++) op.spawn(node.effects);
  },

  ECHO(op, node) {
    const max = Math.min(node.max, GUARDS.MAX_ECHO);
    if (!node.check) {
      const iteration = (node.iteration ?? 0) + 1;
      op.spawn([...node.effects, { ...node, iteration, check: true }]);
      return;
    }
    const iteration = node.iteration ?? 1;
    if (iteration < max && evalCondition(op, node.while)) {
      emit(op.state, { type: "ECHO_REPEAT", sourceId: op.ctx.controllerId, data: { iteration: iteration + 1, max, label: op.ctx.label ?? null } }, op.meta);
      op.spawn([{ ...node, check: false }]);
    }
  },

  DELAY(op, node) {
    op.state.delayed.push({
      id: `d${++op.state.counters.task}`,
      controllerId: op.ctx.controllerId,
      on: node.on,
      effects: node.effects,
      ctx: { ...op.ctx, event: undefined },
    });
  },
};

export function runOperator(op: OpContext): void {
  const node = op.task.node;
  const fn = operators[node.op] as Operator<typeof node.op> | undefined;
  if (!fn) throw new EngineError(`No operator for ${node.op}`);
  fn(op, node as never);
}
