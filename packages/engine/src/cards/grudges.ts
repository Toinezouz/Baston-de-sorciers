import type { CardDefinition } from "../types";
import { T, dmg, draw, heal, status } from "./dsl";

/**
 * Rancunes d'outre-tombe : chaque sorcier mort lors de la manche précédente en tire une
 * au début de la manche suivante. Elle se résout immédiatement puis est défaussée.
 */
export const GRUDGES: CardDefinition[] = [
  {
    id: "grudge.revanche", kind: "GRUDGE", schools: [], copies: 3,
    name: "Revanche",
    text: "Le sorcier qui t'a éliminé subit 3 dégâts.",
    effects: [dmg(T.MY_KILLER, 3)],
  },
  {
    id: "grudge.linceul", kind: "GRUDGE", schools: [], copies: 3,
    name: "Linceul",
    text: "Tu gagnes 5 Égide (2 tours).",
    effects: [status(T.SELF, "egide", { stacks: 5 })],
  },
  {
    id: "grudge.os-a-ronger", kind: "GRUDGE", schools: [], copies: 2,
    name: "Os à ronger",
    text: "Tu gagnes une relique.",
    effects: [{ op: "GAIN_RELIC", target: T.SELF, count: 1 }],
  },
  {
    id: "grudge.chuchotements", kind: "GRUDGE", schools: [], copies: 3,
    name: "Chuchotements d'outre-tombe",
    text: "Pioche 2 runes.",
    effects: [draw(T.SELF, 2)],
  },
  {
    id: "grudge.vigueur-spectrale", kind: "GRUDGE", schools: [], copies: 3,
    name: "Vigueur spectrale",
    text: "+4 PV maximum pour cette manche, et tu récupères 4 PV.",
    effects: [status(T.SELF, "vigueur-spectrale"), heal(T.SELF, 4)],
  },
  {
    id: "grudge.malediction-posthume", kind: "GRUDGE", schools: [], copies: 2,
    name: "Malédiction posthume",
    text: "Ton adversaire le plus robuste reçoit Faiblesse et Maudit (2 tours).",
    effects: [status(T.STRONGEST_FOE, "faiblesse"), status(T.STRONGEST_FOE, "maudit")],
  },
  {
    id: "grudge.feu-follet", kind: "GRUDGE", schools: [], copies: 2,
    name: "Feu follet vengeur",
    text: "Invoque un Feu follet (3 PV) qui inflige 1 dégât à un adversaire aléatoire à chaque fin de tour.",
    effects: [{ op: "SUMMON", summon: "feu-follet" }],
  },
  {
    id: "grudge.rancoeur", kind: "GRUDGE", schools: [], copies: 2,
    name: "Rancœur",
    text: "Tu gagnes 2 Rage (2 tours).",
    effects: [status(T.SELF, "rage", { stacks: 2 })],
  },
  // --- Extension « Échos du Grimoire » ------------------------------------
  {
    id: "grudge.spectre-vengeur", kind: "GRUDGE", schools: [], copies: 2,
    name: "Spectre vengeur",
    text: "Invoque un Spectre affamé (4 PV) : à chaque fin de tour, il blesse l'adversaire le plus affaibli et te rend 1 PV.",
    effects: [{ op: "SUMMON", summon: "spectre-affame" }],
  },
  {
    id: "grudge.hantise", kind: "GRUDGE", schools: [], copies: 2,
    name: "Hantise",
    text: "Le sorcier qui t'a éliminé reçoit 2 Marques et 1 Venin.",
    effects: [status(T.MY_KILLER, "marque", { stacks: 2 }), status(T.MY_KILLER, "venin", { stacks: 1 })],
  },
  {
    id: "grudge.elan-d-outre-tombe", kind: "GRUDGE", schools: [], copies: 2,
    name: "Élan d'outre-tombe",
    text: "Tu gagnes Hâte (+8 à l'initiative, 2 tours) et pioches 1 rune.",
    effects: [status(T.SELF, "hate"), draw(T.SELF, 1)],
  },
  {
    id: "grudge.brume-d-outre-tombe", kind: "GRUDGE", schools: [], copies: 1,
    name: "Brume d'outre-tombe",
    text: "Tu es Intangible pendant le premier tour de la manche.",
    effects: [status(T.SELF, "intangible", { duration: 1 })],
  },
];
