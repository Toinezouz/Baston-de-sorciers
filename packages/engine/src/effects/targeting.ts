import { getCardDef, getSummonDef } from "../cards/registry";
import { pick } from "../rng";
import {
  alivePlayers,
  entityName,
  getPlayer,
  isAliveEntity,
  isPlayer,
  leftOf,
  rightOf,
  seatOrderFrom,
} from "../state/helpers";
import type { EntityId, GameState, PlayerId, TargetSpec } from "../types";
import { NeedChoice, type OpContext } from "./context";

/** Adversaires vivants du contrôleur, en commençant par sa gauche. */
export function foesOf(state: GameState, controllerId: PlayerId): PlayerId[] {
  return seatOrderFrom(state, controllerId)
    .slice(1)
    .filter((id) => getPlayer(state, id).alive);
}

function foeSummons(state: GameState, controllerId: PlayerId): EntityId[] {
  return Object.values(state.summons)
    .filter((s) => s.controllerId !== controllerId)
    .sort((a, b) => a.enteredAt - b.enteredAt)
    .map((s) => s.id);
}

export function mySummons(state: GameState, controllerId: PlayerId): EntityId[] {
  return Object.values(state.summons)
    .filter((s) => s.controllerId === controllerId)
    .sort((a, b) => a.enteredAt - b.enteredAt)
    .map((s) => s.id);
}

function extremeFoe(state: GameState, controllerId: PlayerId, dir: 1 | -1): PlayerId[] {
  const foes = foesOf(state, controllerId);
  if (foes.length === 0) return [];
  // Égalité : premier dans l'ordre des sièges depuis la gauche du contrôleur. [RULE D15]
  let best = foes[0] as PlayerId;
  for (const id of foes) {
    const hp = getPlayer(state, id).hp;
    const bestHp = getPlayer(state, best).hp;
    if (dir === 1 ? hp > bestHp : hp < bestHp) best = id;
  }
  return [best];
}

/** Options légales pour une cible CHOSEN. */
export function chosenCandidates(state: GameState, spec: TargetSpec, controllerId: PlayerId): EntityId[] {
  switch (spec.among ?? "FOES") {
    case "FOES":
      return foesOf(state, controllerId);
    case "FOES_AND_SUMMONS":
      return [...foesOf(state, controllerId), ...foeSummons(state, controllerId)];
    case "ANY_PLAYER":
      return alivePlayers(state).map((p) => p.id);
  }
}

/** Libellé de l'effet pour les invites de choix. */
function promptLabel(op: OpContext): string {
  if (op.ctx.label) return op.ctx.label;
  if (op.ctx.cardDefId) return getCardDef(op.ctx.cardDefId).name;
  return "Effet";
}

/**
 * Résout une spécification de cible en liste d'entités vivantes, dans un ordre déterministe.
 * Une cible CHOSEN à plusieurs candidats lève `NeedChoice` si la réponse n'est pas encore connue.
 */
export function resolveTargets(op: OpContext, spec: TargetSpec, key = "target"): EntityId[] {
  const { state, ctx } = op;
  const controllerId = ctx.controllerId;
  const alive = (ids: (EntityId | null | undefined)[]): EntityId[] =>
    ids.filter((id): id is EntityId => !!id && isAliveEntity(state, id));
  switch (spec.sel) {
    case "SELF":
      return alive([ctx.sourceId ?? controllerId]);
    case "CONTROLLER":
      return alive([controllerId]);
    case "HOLDER":
      return alive([ctx.holderId]);
    // En duel, gauche et droite désignent le même adversaire. [RULE D17]
    case "LEFT":
      return alive([leftOf(state, controllerId)]);
    case "RIGHT":
      return alive([rightOf(state, controllerId)]);
    case "ALL_FOES":
      return foesOf(state, controllerId);
    case "ALL_PLAYERS":
      return seatOrderFrom(state, controllerId).filter((id) => getPlayer(state, id).alive);
    case "STRONGEST_FOE":
      return extremeFoe(state, controllerId, 1);
    case "WEAKEST_FOE":
      return extremeFoe(state, controllerId, -1);
    case "RANDOM_FOE": {
      const foes = foesOf(state, controllerId);
      return foes.length ? [pick(state.rng, foes)] : [];
    }
    case "ALL_FOE_SUMMONS":
      return foeSummons(state, controllerId);
    case "MY_SUMMONS":
      return mySummons(state, controllerId);
    case "ALL_SUMMONS":
      return Object.values(state.summons)
        .sort((a, b) => a.enteredAt - b.enteredAt)
        .map((s) => s.id);
    case "MY_KILLER": {
      const killer = isPlayer(state, controllerId) ? getPlayer(state, controllerId).killedBy : null;
      return killer && killer !== controllerId ? alive([killer]) : [];
    }
    case "EVENT_SOURCE":
      return alive([ctx.event?.sourceId]);
    case "EVENT_TARGET":
      return alive([ctx.event?.targetId]);
    case "IT":
      return alive([ctx.it]);
    case "CHOSEN": {
      const candidates = chosenCandidates(state, spec, controllerId);
      if (candidates.length <= 1) return candidates;
      const answer = op.task.answers[key];
      if (answer) {
        const valid = answer.filter((id) => candidates.includes(id));
        // Cible devenue invalide entre la demande et la réponse : repli sur un candidat. [RULE D16]
        return valid.length ? valid.slice(0, 1) : [pick(state.rng, candidates)];
      }
      throw new NeedChoice({
        playerId: controllerId,
        kind: "TARGET",
        key,
        prompt: `${promptLabel(op)} : choisis une cible`,
        options: candidates.map((id) => ({
          id,
          label: isPlayer(state, id) ? entityName(state, id) : `${getSummonDef(state.summons[id]!.defId).name}`,
        })),
        min: 1,
        max: 1,
      });
    }
  }
}

/** Variante sans filtre « vivant » ni choix (utilisée par la condition IS_DEAD). */
export function resolveRawTarget(op: OpContext, spec: TargetSpec): EntityId | null {
  const { state, ctx } = op;
  switch (spec.sel) {
    case "SELF":
      return ctx.sourceId ?? ctx.controllerId;
    case "CONTROLLER":
      return ctx.controllerId;
    case "HOLDER":
      return ctx.holderId ?? null;
    case "EVENT_SOURCE":
      return ctx.event?.sourceId ?? null;
    case "EVENT_TARGET":
      return ctx.event?.targetId ?? null;
    case "IT":
      return ctx.it ?? null;
    default:
      return resolveTargets(op, spec)[0] ?? null;
  }
}
