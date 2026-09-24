/**
 * Effets atomiques qui modifient les PV et les statuts, avec leur pipeline de modificateurs.
 *
 * Ordre des couches pour les dégâts [RULE D9] :
 *   1. émetteur : multiplicateurs (MUL)       ex. Surcharge ×2
 *   2. émetteur : bonus additifs (ADD)        ex. Rage +1, Faiblesse −1
 *   3. cible    : immunité (IMMUNE)           → 0, événement DAMAGE_PREVENTED
 *   4. cible    : multiplicateurs (MUL)       ex. Vulnérable ×1,5
 *   5. cible    : réductions additives (ADD)  ex. Carapace −1 (plancher 0)
 *   6. cible    : absorption (ABSORB_STACKS)  ex. Égide
 * Arrondi à l'entier inférieur après les couches 2 et 5, plancher 0.
 */
import { getStatusDef } from "../cards/registry";
import { GUARDS } from "../constants";
import { emit, type EmitMeta } from "../state/events";
import {
  controllerOf,
  getHp,
  getPlayer,
  isAliveEntity,
  isFoe,
  isPlayer,
  maxHpOf,
  nextId,
  passivesOf,
  setHp,
  statusesOf,
  tick,
  type PassiveRef,
} from "../state/helpers";
import type { EntityId, GameState, School, StatusInstance } from "../types";

function matchesSchool(ref: PassiveRef, school: School | undefined): boolean {
  const f = ref.passive.modifier?.filter?.school;
  return !f || f === school;
}

function removeStatus(state: GameState, holderId: EntityId, st: StatusInstance, reason: string, meta: EmitMeta): void {
  const list = statusesOf(state, holderId);
  const idx = list.indexOf(st);
  if (idx < 0) return;
  list.splice(idx, 1);
  emit(state, { type: "STATUS_REMOVED", targetId: holderId, data: { status: st.defId, reason } }, meta);
}

/** Retire un cumul aux statuts « consommables » utilisés par un effet (une fois par effet). */
export function consumeStatuses(state: GameState, consumed: Map<StatusInstance, EntityId>, meta: EmitMeta): void {
  for (const [st, holderId] of consumed) {
    st.stacks -= 1;
    if (st.stacks <= 0) removeStatus(state, holderId, st, "CONSUMED", meta);
  }
}

export interface DamageOptions {
  sourceId: EntityId | null;
  targetId: EntityId;
  amount: number;
  school?: School;
  tags?: string[];
  meta: EmitMeta;
  /** Statuts consommables utilisés (appliqués une seule fois par effet, même en zone). */
  consumed: Map<StatusInstance, EntityId>;
}

/** Inflige des dégâts ; retourne les PV réellement perdus. */
export function applyDamage(state: GameState, o: DamageOptions): number {
  if (o.amount <= 0 || !isAliveEntity(state, o.targetId)) return 0;
  let amount = o.amount;

  // Couches 1–2 : émetteur.
  if (o.sourceId && isAliveEntity(state, o.sourceId)) {
    const outs = passivesOf(state, o.sourceId).filter(
      (r) => r.passive.modifier?.hook === "DAMAGE_OUT" && matchesSchool(r, o.school),
    );
    for (const r of outs) {
      const m = r.passive.modifier!;
      if (m.kind === "MUL") {
        amount *= m.value ?? 1;
        if (m.consume && r.status) o.consumed.set(r.status, r.holderId);
      }
    }
    for (const r of outs) {
      const m = r.passive.modifier!;
      if (m.kind === "ADD") {
        amount += (m.value ?? 0) * r.stacks;
        if (m.consume && r.status) o.consumed.set(r.status, r.holderId);
      }
    }
    amount = Math.max(0, Math.floor(amount));
  }

  // Couches 3–6 : cible.
  const ins = passivesOf(state, o.targetId).filter(
    (r) => r.passive.modifier?.hook === "DAMAGE_IN" && matchesSchool(r, o.school),
  );
  if (amount > 0 && ins.some((r) => r.passive.modifier!.kind === "IMMUNE")) {
    emit(state, { type: "DAMAGE_PREVENTED", sourceId: o.sourceId ?? undefined, targetId: o.targetId, amount: 0, data: { reason: "IMMUNE", attempted: amount } }, o.meta);
    return 0;
  }
  for (const r of ins) if (r.passive.modifier!.kind === "MUL") amount *= r.passive.modifier!.value ?? 1;
  for (const r of ins) if (r.passive.modifier!.kind === "ADD") amount += (r.passive.modifier!.value ?? 0) * r.stacks;
  amount = Math.max(0, Math.floor(amount));

  let absorbed = 0;
  for (const r of ins) {
    if (r.passive.modifier!.kind !== "ABSORB_STACKS" || !r.status || amount <= 0) continue;
    const take = Math.min(r.status.stacks, amount);
    r.status.stacks -= take;
    amount -= take;
    absorbed += take;
    if (r.status.stacks <= 0) removeStatus(state, o.targetId, r.status, "DEPLETED", o.meta);
  }

  if (amount <= 0) {
    emit(state, { type: "DAMAGE_PREVENTED", sourceId: o.sourceId ?? undefined, targetId: o.targetId, amount: 0, data: { reason: absorbed ? "ABSORBED" : "REDUCED", absorbed } }, o.meta);
    return 0;
  }

  setHp(state, o.targetId, getHp(state, o.targetId) - amount);
  const sourcePlayer = o.sourceId ? controllerOf(state, o.sourceId) : null;
  if (sourcePlayer && isFoe(state, sourcePlayer, o.targetId)) {
    getPlayer(state, sourcePlayer).stats.damageDealt += amount;
    if (isPlayer(state, o.targetId)) getPlayer(state, o.targetId).lastHitBy = sourcePlayer;
  }
  emit(
    state,
    {
      type: "DAMAGE",
      sourceId: o.sourceId ?? undefined,
      targetId: o.targetId,
      amount,
      ...(o.tags?.length ? { tags: o.tags } : {}),
      data: { school: o.school ?? null, absorbed, hp: getHp(state, o.targetId), sourcePlayerId: sourcePlayer },
    },
    o.meta,
  );
  return amount;
}

/** Perte de PV directe : ignore tous les modificateurs et ne déclenche pas les effets « dégâts ». */
export function applyLoseHp(state: GameState, sourceId: EntityId | null, targetId: EntityId, amount: number, meta: EmitMeta): number {
  if (amount <= 0 || !isAliveEntity(state, targetId)) return 0;
  setHp(state, targetId, getHp(state, targetId) - amount);
  const sourcePlayer = sourceId ? controllerOf(state, sourceId) : null;
  if (sourcePlayer && isFoe(state, sourcePlayer, targetId) && isPlayer(state, targetId))
    getPlayer(state, targetId).lastHitBy = sourcePlayer;
  emit(state, { type: "HP_LOST", sourceId: sourceId ?? undefined, targetId, amount, data: { hp: getHp(state, targetId) } }, meta);
  return amount;
}

/** Soigne ; plafonné aux PV max, le surplus est perdu [RULE D10]. Retourne les PV rendus. */
export function applyHeal(state: GameState, sourceId: EntityId | null, targetId: EntityId, amount: number, meta: EmitMeta): number {
  if (amount <= 0 || !isAliveEntity(state, targetId)) return 0;
  let v = amount;
  const ins = passivesOf(state, targetId).filter((r) => r.passive.modifier?.hook === "HEAL_IN");
  for (const r of ins) if (r.passive.modifier!.kind === "MUL") v *= r.passive.modifier!.value ?? 1;
  for (const r of ins) if (r.passive.modifier!.kind === "ADD") v += (r.passive.modifier!.value ?? 0) * r.stacks;
  v = Math.max(0, Math.floor(v));
  const missing = Math.max(0, maxHpOf(state, targetId) - getHp(state, targetId));
  const healed = Math.min(v, missing);
  if (healed <= 0) return 0;
  setHp(state, targetId, getHp(state, targetId) + healed);
  emit(state, { type: "HEAL", sourceId: sourceId ?? undefined, targetId, amount: healed, data: { hp: getHp(state, targetId) } }, meta);
  return healed;
}

/** Applique (ou cumule / rafraîchit) un statut. */
export function applyStatus(
  state: GameState,
  sourceId: EntityId | null,
  targetId: EntityId,
  statusId: string,
  stacks: number,
  duration: number | "PERMANENT" | undefined,
  meta: EmitMeta,
): void {
  if (stacks <= 0 || !isAliveEntity(state, targetId)) return;
  const def = getStatusDef(statusId);
  const rawDur = duration ?? def.defaultDuration;
  const dur = rawDur === "PERMANENT" ? "PERMANENT" : Math.min(Math.max(1, rawDur), GUARDS.MAX_STATUS_DURATION);
  const list = statusesOf(state, targetId);
  const existing = list.find((s) => s.defId === statusId);
  if (existing) {
    if (def.stacking === "IGNORE") return;
    if (def.stacking === "STACK") existing.stacks = Math.min(def.maxStacks, existing.stacks + stacks);
    if (existing.remaining !== "PERMANENT")
      existing.remaining = dur === "PERMANENT" ? "PERMANENT" : Math.max(existing.remaining, dur);
    existing.sourceId = sourceId;
    emit(state, { type: "STATUS_APPLIED", sourceId: sourceId ?? undefined, targetId, data: { status: statusId, stacks: existing.stacks, remaining: existing.remaining, refreshed: true } }, meta);
    return;
  }
  const inst: StatusInstance = {
    id: nextId(state, "status"),
    defId: statusId,
    sourceId,
    stacks: Math.min(def.maxStacks, stacks),
    remaining: dur,
    appliedAt: tick(state),
  };
  list.push(inst);
  emit(state, { type: "STATUS_APPLIED", sourceId: sourceId ?? undefined, targetId, data: { status: statusId, stacks: inst.stacks, remaining: inst.remaining, refreshed: false } }, meta);
}

export function removeStatuses(
  state: GameState,
  targetId: EntityId,
  predicate: (s: StatusInstance) => boolean,
  reason: string,
  meta: EmitMeta,
): number {
  const toRemove = statusesOf(state, targetId).filter(predicate);
  for (const st of toRemove) removeStatus(state, targetId, st, reason, meta);
  return toRemove.length;
}
