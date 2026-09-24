/**
 * Mise en forme des événements en phrases françaises (journal de partie).
 * Fonction pure, partagée par le serveur (logs), le client (UI) et les tests.
 */
import { getCardDef, getStatusDef, getSummonDef, hasCardDef } from "./cards/registry";
import type { GameEvent } from "./types";

export type NameResolver = (id: string | undefined | null) => string;

const SLOT_LABEL: Record<string, string> = { AMORCE: "Amorce", TORSION: "Torsion", FRAPPE: "Frappe" };

function cardName(defId: unknown): string {
  return typeof defId === "string" && hasCardDef(defId) ? getCardDef(defId).name : "?";
}
function statusName(id: unknown): string {
  try {
    return getStatusDef(String(id)).name;
  } catch {
    return String(id);
  }
}
function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Retourne une phrase, ou null pour les événements techniques non affichés. */
export function describeEvent(ev: GameEvent, name: NameResolver): string | null {
  const d = ev.data;
  const src = name(ev.sourceId);
  const tgt = name(ev.targetId);
  switch (ev.type) {
    case "PLAYER_JOINED":
      return `${tgt} rejoint la partie.`;
    case "PLAYER_LEFT":
      return `${tgt} quitte la partie.`;
    case "HOST_CHANGED":
      return `${tgt} devient l'hôte.`;
    case "PLAYER_READY":
      return d.ready ? `${tgt} est prêt.` : `${tgt} n'est plus prêt.`;
    case "CONNECTION_CHANGED":
      return d.status === "DISCONNECTED"
        ? `${tgt} est déconnecté.`
        : d.status === "ABANDONED"
          ? `${tgt} a abandonné.`
          : `${tgt} est de retour.`;
    case "GAME_STARTED":
      return "La baston commence !";
    case "ROUND_STARTED":
      return `— Manche ${d.round} —`;
    case "TURN_STARTED":
      return `Tour ${d.turn}.`;
    case "DECK_SHUFFLED":
      return "La pioche est remélangée.";
    case "CARDS_DRAWN":
      return Array.isArray(d.cards)
        ? `${tgt} pioche ${(d.cards as { defId: string }[]).map((c) => cardName(c.defId)).join(", ")}.`
        : `${tgt} pioche ${plural(Number(d.count), "rune", "runes")}.`;
    case "CARDS_DISCARDED":
      return `${tgt} défausse ${(d.cards as string[]).map(cardName).join(", ")}.`;
    case "CARD_STOLEN":
      return Array.isArray(d.cards)
        ? `${src} vole ${(d.cards as { defId: string }[]).map((c) => cardName(c.defId)).join(", ")} à ${tgt}.`
        : `${src} vole ${plural(Number(d.count), "rune", "runes")} à ${tgt}.`;
    case "SPELL_LOCKED":
      return d.auto ? `${src} est pris par le temps : sort verrouillé.` : `${src} a préparé son sort.`;
    case "SPELLS_REVEALED":
      return "Les sorts sont révélés !";
    case "RUNE_REPLACED":
      return d.replacement
        ? `La rune instable de ${src} devient ${cardName(d.replacement)}.`
        : `La rune instable de ${src} se dissipe.`;
    case "INITIATIVE_SET":
      return `Ordre de résolution : ${(d.order as { playerId: string }[]).map((o) => name(o.playerId)).join(" → ")}.`;
    case "SPELL_CAST":
      return `${src} lance ${(d.runes as string[]).map(cardName).join(" + ")} !`;
    case "SPELL_FIZZLED":
      return `Le sort de ${src} s'éteint.`;
    case "RUNE_RESOLVING":
      return `${SLOT_LABEL[String(d.slot)] ?? d.slot} de ${src} : ${cardName(d.defId)}.`;
    case "DICE_ROLLED":
      return `${src} lance les dés : ${(d.rolls as number[]).join(" + ")} = ${d.total} (palier ${d.tier}).`;
    case "DAMAGE":
      return `${tgt} subit ${plural(Number(ev.amount), "dégât", "dégâts")}${ev.sourceId && ev.sourceId !== ev.targetId ? ` (${src})` : ""}${Number(d.absorbed) > 0 ? `, ${d.absorbed} absorbé(s)` : ""}.`;
    case "DAMAGE_PREVENTED":
      return d.reason === "IMMUNE"
        ? `${tgt} est intouchable !`
        : Number(d.absorbed) > 0
          ? `L'Égide de ${tgt} absorbe ${d.absorbed} dégât(s).`
          : `${tgt} ne subit aucun dégât.`;
    case "HP_LOST":
      return `${tgt} perd ${ev.amount} PV.`;
    case "HEAL":
      return `${tgt} récupère ${ev.amount} PV.`;
    case "STATUS_APPLIED":
      return `${tgt} reçoit ${statusName(d.status)}${Number(d.stacks) > 1 ? ` ×${d.stacks}` : ""}.`;
    case "STATUS_REMOVED":
      return d.reason === "DISPELLED" ? `${statusName(d.status)} est dissipé sur ${tgt}.` : null;
    case "STATUS_EXPIRED":
      return `${statusName(d.status)} se dissipe sur ${tgt}.`;
    case "RELIC_GAINED":
      return `${tgt} obtient la relique ${cardName(d.defId)}.`;
    case "RELIC_LOST":
      return `${tgt} perd la relique ${cardName(d.defId)}.`;
    case "RELIC_STOLEN":
      return `${src} dérobe ${cardName(d.defId)} à ${tgt}.`;
    case "SUMMON_ENTERED":
      return `${src} invoque ${getSummonDef(String(d.defId)).name}.`;
    case "SUMMON_DIED":
      return `${getSummonDef(String(d.defId)).name} disparaît.`;
    case "GRUDGE_DRAWN":
      return `${tgt} revient d'outre-tombe avec ${cardName(d.defId)}.`;
    case "TRIGGER_FIRED":
      return `${d.label} (${tgt}) se déclenche.`;
    case "TRIGGER_SUPPRESSED":
      return `${d.label} est épuisé pour ce sort.`;
    case "ECHO_REPEAT":
      return `L'écho résonne encore (${d.iteration}/${d.max}) !`;
    case "CHOICE_REQUESTED":
      return `${tgt} doit choisir : ${d.prompt}`;
    case "CHOICE_MADE":
      return `${tgt} choisit ${(d.labels as string[]).join(", ")}${d.auto ? " (automatique)" : ""}.`;
    case "SUDDEN_DEATH":
      return `Mort subite ! Chaque sorcier perd ${ev.amount} PV.`;
    case "PLAYER_DIED":
      return d.reason === "ABANDON" ? `${tgt} quitte le combat.` : ev.sourceId ? `${tgt} est éliminé par ${src} !` : `${tgt} est éliminé !`;
    case "ROUND_ENDED":
      return d.winnerId ? `${name(d.winnerId as string)} remporte la manche !` : "Manche nulle : aucun survivant.";
    case "CROWN_AWARDED":
      return `${tgt} gagne une Couronne (${d.crowns}).`;
    case "GAME_OVER":
      return d.winnerId ? `${name(d.winnerId as string)} remporte la baston !` : "La partie se termine sans vainqueur.";
    case "ENGINE_GUARD":
      return `⚠ Garde-fou du moteur (${d.reason}).`;
    default:
      return null;
  }
}
