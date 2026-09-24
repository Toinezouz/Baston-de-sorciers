/**
 * Déclencheurs : transforme les événements produits par un effet en nouvelles tâches.
 *
 * Ordre [RULE D8] : événements dans l'ordre d'émission ; pour chaque événement, passifs dans
 * l'ordre des sièges à partir du contrôleur de l'effet (statuts, reliques, invocations),
 * puis effets retardés.
 */
import { GUARDS } from "../constants";
import { emit } from "../state/events";
import { allPassives, isAliveEntity, isFoe } from "../state/helpers";
import type { EntityId, GameEvent, GameEventType, GameState, PlayerId, ResolutionTask, TriggerDefinition, TriggerType } from "../types";

interface TriggerMapping {
  event: GameEventType;
  /** Champ de l'événement qui doit désigner le porteur du passif. */
  field?: "sourceId" | "targetId";
  /** Le porteur ne doit PAS être la cible (ex. « quand un AUTRE sorcier meurt »). */
  excludeHolderAsTarget?: boolean;
  /** Le passif doit appartenir au contrôleur désigné par `data.controllerId`. */
  matchController?: boolean;
}

export const TRIGGER_MAP: Record<TriggerType, TriggerMapping> = {
  ON_ROUND_START: { event: "ROUND_STARTED" },
  ON_TURN_START: { event: "TURN_STARTED" },
  ON_TURN_END: { event: "TURN_ENDING" },
  ON_SPELL_CAST: { event: "SPELL_CAST", field: "sourceId" },
  ON_DICE_ROLLED: { event: "DICE_ROLLED", field: "sourceId" },
  ON_DAMAGE_DEALT: { event: "DAMAGE", field: "sourceId" },
  ON_DAMAGE_RECEIVED: { event: "DAMAGE", field: "targetId" },
  ON_HEALED: { event: "HEAL", field: "targetId" },
  ON_STATUS_RECEIVED: { event: "STATUS_APPLIED", field: "targetId" },
  ON_DEATH: { event: "PLAYER_DIED", field: "targetId" },
  ON_KILL: { event: "PLAYER_DIED", field: "sourceId" },
  ON_ANY_DEATH: { event: "PLAYER_DIED", excludeHolderAsTarget: true },
  ON_SUMMON_DIED: { event: "SUMMON_DIED", matchController: true },
};

function matches(
  state: GameState,
  trigger: TriggerDefinition,
  ev: GameEvent,
  holderId: EntityId,
  controllerId: PlayerId,
): boolean {
  const m = TRIGGER_MAP[trigger.on];
  if (m.event !== ev.type) return false;
  if (m.field && ev[m.field] !== holderId) return false;
  if (m.excludeHolderAsTarget && ev.targetId === holderId) return false;
  if (m.matchController && ev.data.controllerId !== controllerId) return false;
  // Un porteur mort ne déclenche plus rien, sauf sa propre mort. [RULE D19]
  if (trigger.on !== "ON_DEATH" && !isAliveEntity(state, holderId)) return false;
  const f = trigger.filter;
  if (!f) return true;
  if (f.school && ev.data.school !== f.school) return false;
  if (f.notTags && ev.tags?.some((t) => f.notTags!.includes(t))) return false;
  if (f.minAmount !== undefined && (ev.amount ?? 0) < f.minAmount) return false;
  if (f.otherIsFoe) {
    const other = m.field === "targetId" ? ev.sourceId : ev.targetId;
    if (!other || !isFoe(state, holderId, other)) return false;
  }
  return true;
}

/** Vérifie les compteurs anti-boucle ; retourne false (et journalise) si le passif est bloqué. */
function allowActivation(state: GameState, key: string, label: string, trigger: TriggerDefinition, ev: GameEvent, depth: number): boolean {
  const spellCount = state.guards.perSpell[key] ?? 0;
  const turnCount = state.guards.perTurn[key] ?? 0;
  const overSpell = spellCount >= GUARDS.MAX_TRIGGER_PER_SPELL;
  const overTurn = trigger.maxPerTurn !== undefined && turnCount >= trigger.maxPerTurn;
  if (overSpell || overTurn) {
    // Un plafond « par tour » est une règle de carte : pas de bruit dans le journal.
    if (overSpell) emit(state, { type: "TRIGGER_SUPPRESSED", data: { label, reason: "MAX_PER_SPELL" } }, { depth, causeSeq: ev.seq });
    return false;
  }
  state.guards.perSpell[key] = spellCount + 1;
  state.guards.perTurn[key] = turnCount + 1;
  return true;
}

export function collectTriggers(state: GameState, events: GameEvent[], startId: PlayerId | null, depth: number): ResolutionTask[] {
  const tasks: ResolutionTask[] = [];
  const relevant = new Set(Object.values(TRIGGER_MAP).map((m) => m.event));
  for (const ev of events) {
    if (!relevant.has(ev.type)) continue;
    const eventRef = {
      type: ev.type,
      ...(ev.sourceId !== undefined ? { sourceId: ev.sourceId } : {}),
      ...(ev.targetId !== undefined ? { targetId: ev.targetId } : {}),
      ...(ev.amount !== undefined ? { amount: ev.amount } : {}),
    };

    for (const ref of allPassives(state, startId)) {
      const trigger = ref.passive.trigger;
      if (!trigger || !matches(state, trigger, ev, ref.holderId, ref.controllerId)) continue;
      if (!allowActivation(state, ref.key, ref.label, trigger, ev, depth)) continue;
      const fired = emit(
        state,
        { type: "TRIGGER_FIRED", targetId: ref.holderId, data: { label: ref.label, trigger: trigger.on } },
        { depth, causeSeq: ev.seq },
      );
      // [RULE D18] Un statut agit au nom de celui qui l'a appliqué (crédit des dégâts sur la durée) ;
      // une relique ou une invocation agit en son propre nom.
      const sourceId = ref.status ? (ref.statusSourceId ?? null) : ref.holderId;
      for (const node of trigger.effects) {
        tasks.push({
          id: ++state.counters.task,
          depth,
          node,
          ctx: {
            sourceId,
            controllerId: ref.controllerId,
            holderId: ref.holderId,
            stacks: ref.stacks,
            event: eventRef,
            label: ref.label,
            ...(ref.cardDefId ? { cardDefId: ref.cardDefId } : {}),
          },
          answers: {},
          causeSeq: fired.seq,
        });
      }
    }

    // Effets retardés (à usage unique).
    for (const d of [...state.delayed]) {
      const m = TRIGGER_MAP[d.on];
      if (m.event !== ev.type) continue;
      if (m.field && ev[m.field] !== d.controllerId) continue;
      if (!isAliveEntity(state, d.controllerId)) continue;
      state.delayed = state.delayed.filter((x) => x.id !== d.id);
      for (const node of d.effects) {
        tasks.push({ id: ++state.counters.task, depth, node, ctx: { ...d.ctx, event: eventRef }, answers: {}, causeSeq: ev.seq });
      }
    }
  }
  return tasks;
}
