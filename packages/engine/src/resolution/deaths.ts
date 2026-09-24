/**
 * Contrôle des morts : exécuté après CHAQUE effet atomique [RULE D2].
 * Toutes les morts constatées au même moment sont simultanées [RULE D3] : elles sont
 * toutes marquées, puis leurs déclencheurs sont collectés ensemble, puis on nettoie.
 */
import { cardDef, discardCard, getPlayer, maxHpOf, seatOrderFrom } from "../state/helpers";
import { emit, type EmitMeta } from "../state/events";
import type { GameState, PlayerId } from "../types";

/**
 * Si les PV max ont baissé (relique volée, statut expiré…), les PV actuels sont ramenés au maximum. [RULE D23]
 */
export function clampHp(state: GameState): void {
  for (const p of Object.values(state.players)) {
    if (!p.alive) continue;
    const max = maxHpOf(state, p.id);
    if (p.hp > max) p.hp = max;
  }
}

/** Marque les morts (sorciers à 0 PV ou moins, invocations détruites). Retourne les sorciers morts. */
export function markDeaths(state: GameState, startId: PlayerId | null, meta: EmitMeta): PlayerId[] {
  clampHp(state);
  for (const s of Object.values(state.summons).sort((a, b) => a.enteredAt - b.enteredAt)) {
    if (s.hp > 0) continue;
    delete state.summons[s.id];
    emit(state, { type: "SUMMON_DIED", targetId: s.id, data: { defId: s.defId, controllerId: s.controllerId, reason: "KILLED" } }, meta);
  }
  const dead: PlayerId[] = [];
  for (const pid of seatOrderFrom(state, startId)) {
    const p = getPlayer(state, pid);
    if (!p.alive || p.hp > 0) continue;
    killPlayer(state, pid, "KILLED", meta);
    dead.push(pid);
  }
  return dead;
}

export function killPlayer(state: GameState, pid: PlayerId, reason: "KILLED" | "ABANDON", meta: EmitMeta): void {
  const p = getPlayer(state, pid);
  if (!p.alive) return;
  p.alive = false;
  p.hp = Math.min(p.hp, 0);
  p.diedThisRound = true;
  const killer = reason === "KILLED" && p.lastHitBy && p.lastHitBy !== pid ? p.lastHitBy : null;
  p.killedBy = killer;
  if (killer) getPlayer(state, killer).stats.kills += 1;
  emit(state, { type: "PLAYER_DIED", targetId: pid, ...(killer ? { sourceId: killer } : {}), data: { reason } }, meta);
}

/**
 * Nettoyage après la collecte des déclencheurs de mort : le sorcier mort perd ses reliques
 * non éternelles [RULE D12], ses invocations, ses statuts et ses effets retardés.
 */
export function finalizeDeaths(state: GameState, dead: PlayerId[], meta: EmitMeta): void {
  for (const pid of dead) {
    const p = getPlayer(state, pid);
    const kept: string[] = [];
    for (const relic of p.relics) {
      if (cardDef(state, relic).eternal) kept.push(relic);
      else {
        discardCard(state, relic);
        emit(state, { type: "RELIC_LOST", targetId: pid, data: { card: relic, defId: state.cards[relic]?.defId } }, meta);
      }
    }
    p.relics = kept;
    p.statuses = [];
    for (const s of Object.values(state.summons)) {
      if (s.controllerId !== pid) continue;
      delete state.summons[s.id];
      emit(state, { type: "SUMMON_DIED", targetId: s.id, data: { defId: s.defId, controllerId: pid, reason: "MASTER_DIED" } }, meta);
    }
    state.delayed = state.delayed.filter((d) => d.controllerId !== pid);
  }
}
