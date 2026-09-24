import type { SummonDefinition } from "../types";
import { T, dmg, draw, heal, iff, status } from "./dsl";

/** Invocations : entités persistantes (jusqu'à la fin de la manche ou la mort de leur maître). */
export const SUMMONS: SummonDefinition[] = [
  {
    id: "feu-follet",
    name: "Feu follet",
    text: "En fin de tour, inflige 1 dégât à un adversaire aléatoire.",
    maxHp: 3,
    passives: [{ trigger: { on: "ON_TURN_END", effects: [dmg(T.RANDOM_FOE, 1, "BRAISE")] } }],
  },
  {
    id: "golem-de-mousse",
    name: "Golem de mousse",
    text: "En fin de tour, donne 1 Égide à son maître.",
    maxHp: 6,
    passives: [{ trigger: { on: "ON_TURN_END", effects: [status(T.CONTROLLER, "egide", { stacks: 1 })] } }],
  },
  {
    id: "corbeau-charognard",
    name: "Corbeau charognard",
    text: "Quand un sorcier meurt, son maître récupère 2 PV et pioche 1 rune.",
    maxHp: 2,
    passives: [{ trigger: { on: "ON_ANY_DEATH", effects: [heal(T.CONTROLLER, 2), draw(T.CONTROLLER, 1)] } }],
  },
  // --- Extension « Échos du Grimoire » ------------------------------------
  {
    id: "salamandre",
    name: "Salamandre",
    text: "En fin de tour, inflige 1 Brûlure à un adversaire aléatoire.",
    maxHp: 3,
    passives: [{ trigger: { on: "ON_TURN_END", effects: [status(T.RANDOM_FOE, "brulure", { stacks: 1 })] } }],
  },
  {
    id: "spectre-affame",
    name: "Spectre affamé",
    text: "En fin de tour, inflige 1 dégât à l'adversaire le plus affaibli et rend 1 PV à son maître.",
    maxHp: 4,
    passives: [{ trigger: { on: "ON_TURN_END", effects: [dmg(T.WEAKEST_FOE, 1, "OMBRE"), heal(T.CONTROLLER, 1)] } }],
  },
  {
    id: "sentinelle-de-cristal",
    name: "Sentinelle de cristal",
    text: "Au début de chaque tour, donne Clairvoyance (+1 dé) à son maître pour ce tour.",
    maxHp: 5,
    passives: [{ trigger: { on: "ON_TURN_START", effects: [status(T.CONTROLLER, "clairvoyance", { duration: 1 })] } }],
  },
  {
    id: "double-illusoire",
    name: "Double illusoire",
    text: "En fin de tour, une chance sur deux d'infliger 2 dégâts à un adversaire aléatoire.",
    maxHp: 3,
    passives: [{ trigger: { on: "ON_TURN_END", effects: [iff({ c: "CHANCE", percent: 50 }, [dmg(T.RANDOM_FOE, 2, "CHIMERE")])] } }],
  },
];
