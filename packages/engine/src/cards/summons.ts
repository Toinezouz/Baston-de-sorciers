import type { SummonDefinition } from "../types";
import { T, dmg, draw, heal, status } from "./dsl";

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
];
