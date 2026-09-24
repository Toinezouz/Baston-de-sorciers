/**
 * Découpage des événements d'un tour en « étapes » à rejouer visuellement.
 * Purement décoratif : l'état réel est déjà affiché quand le rejeu commence.
 */
import type { GameEvent } from "@baston/engine";

export type StepKind = "reveal" | "cast" | "rune" | "turnEnd" | "roundEnd" | "turnStart";

export interface ReplayStep {
  kind: StepKind;
  header: GameEvent;
  /** Événements consécutifs rattachés à cette étape (effets, déclencheurs, morts…). */
  events: GameEvent[];
}

const HEADERS: Partial<Record<GameEvent["type"], StepKind>> = {
  SPELLS_REVEALED: "reveal",
  SPELL_CAST: "cast",
  RUNE_RESOLVING: "rune",
  TURN_ENDING: "turnEnd",
  ROUND_ENDED: "roundEnd",
  ROUND_STARTED: "turnStart",
};

/** Événements sans intérêt visuel pendant le rejeu. */
const HIDDEN = new Set<GameEvent["type"]>(["PHASE_CHANGED", "INITIATIVE_SET", "TURN_STARTED", "DECK_SHUFFLED", "SPELL_LOCKED", "SPELL_UPDATED"]);

/** Vrai si le message contient une résolution à rejouer. */
export function hasResolution(events: GameEvent[]): boolean {
  return events.some((e) => e.type === "SPELLS_REVEALED" || e.type === "RUNE_RESOLVING" || e.type === "TURN_ENDING");
}

export function buildReplay(events: GameEvent[]): ReplayStep[] {
  const steps: ReplayStep[] = [];
  for (const e of events) {
    const kind = HEADERS[e.type];
    if (kind) {
      steps.push({ kind, header: e, events: [] });
      continue;
    }
    if (HIDDEN.has(e.type)) continue;
    const current = steps.at(-1);
    if (current) current.events.push(e);
  }
  // Une fin de tour sans aucun effet n'apporte rien au rejeu.
  return steps.filter((s) => !(s.kind === "turnEnd" && !s.events.some((e) => e.type !== "CARDS_DRAWN")) && s.kind !== "turnStart");
}

/** Durée d'affichage d'une étape (ms). */
export function stepDuration(step: ReplayStep): number {
  const lines = step.events.filter((e) => e.type !== "CARDS_DRAWN").length;
  const base = step.kind === "cast" ? 700 : step.kind === "reveal" ? 1100 : 900;
  return Math.min(3200, base + lines * 280);
}
