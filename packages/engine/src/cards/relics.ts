import type { CardDefinition } from "../types";
import { T, dmg, draw, heal, iff, status } from "./dsl";

/**
 * Reliques : objets à effet passif.
 * - Gagnées en remportant une manche (1 relique) ou via certaines runes / rancunes.
 * - Perdues (défaussées) quand leur porteur meurt, SAUF les reliques éternelles. [RULE D12]
 */
export const RELICS: CardDefinition[] = [
  {
    id: "relic.anneau-de-braises", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Anneau de braises",
    text: "Tes dégâts de Braise sont augmentés de 1.",
    passives: [{ modifier: { hook: "DAMAGE_OUT", kind: "ADD", value: 1, filter: { school: "BRAISE" } } }],
  },
  {
    id: "relic.crane-bavard", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Crâne bavard",
    text: "Quand tu élimines un sorcier, tu récupères 3 PV.",
    passives: [{ trigger: { on: "ON_KILL", effects: [heal(T.HOLDER, 3)] } }],
  },
  {
    id: "relic.de-pipe", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Dé pipé",
    text: "+1 dé à tes jets de Puissance.",
    passives: [{ modifier: { hook: "DICE", kind: "ADD", value: 1 } }],
  },
  {
    id: "relic.miroir-fele", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Miroir fêlé",
    text: "Une fois par tour, quand un adversaire te blesse, il subit 2 dégâts.",
    passives: [
      {
        trigger: {
          on: "ON_DAMAGE_RECEIVED",
          filter: { otherIsFoe: true, notTags: ["reflected", "dot"] },
          maxPerTurn: 1,
          effects: [dmg(T.EVENT_SOURCE, 2, undefined, ["reflected"])],
        },
      },
    ],
  },
  {
    id: "relic.gourde-de-seve", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Gourde de sève",
    text: "À la fin de chaque tour, tu récupères 1 PV.",
    passives: [{ trigger: { on: "ON_TURN_END", effects: [heal(T.HOLDER, 1)] } }],
  },
  {
    id: "relic.plastron-runique", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Plastron runique",
    text: "Les dégâts que tu subis sont réduits de 1.",
    passives: [{ modifier: { hook: "DAMAGE_IN", kind: "ADD", value: -1 } }],
  },
  {
    id: "relic.sablier-voleur", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Sablier voleur",
    text: "+3 à l'initiative de ton sort.",
    passives: [{ modifier: { hook: "INITIATIVE", kind: "ADD", value: 3 } }],
  },
  {
    id: "relic.sacoche-sans-fond", kind: "RELIC", schools: [], copies: 1, effects: [], eternal: true,
    name: "Sacoche sans fond",
    text: "Éternelle. Ta main contient 1 rune de plus.",
    passives: [{ modifier: { hook: "HAND_SIZE", kind: "ADD", value: 1 } }],
  },
  {
    id: "relic.coeur-de-golem", kind: "RELIC", schools: [], copies: 1, effects: [], eternal: true,
    name: "Cœur de golem",
    text: "Éternelle. +4 PV maximum.",
    passives: [{ modifier: { hook: "MAX_HP", kind: "ADD", value: 4 } }],
  },
  {
    id: "relic.couronne-de-ronces", kind: "RELIC", schools: [], copies: 1, effects: [], eternal: true,
    name: "Couronne de ronces",
    text: "Éternelle. Au début de chaque manche, tu gagnes Épines (2 tours).",
    passives: [{ trigger: { on: "ON_ROUND_START", effects: [status(T.HOLDER, "epines")] } }],
  },
  {
    id: "relic.sac-a-malices", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Sac à malices",
    text: "Quand tu lances un sort, une chance sur quatre de piocher 1 rune.",
    passives: [{ trigger: { on: "ON_SPELL_CAST", effects: [iff({ c: "CHANCE", percent: 25 }, [draw(T.HOLDER, 1)])] } }],
  },
  {
    id: "relic.lanterne-des-morts", kind: "RELIC", schools: [], copies: 1, effects: [],
    name: "Lanterne des morts",
    text: "Quand un autre sorcier meurt, tu gagnes 2 Égide.",
    passives: [{ trigger: { on: "ON_ANY_DEATH", effects: [status(T.HOLDER, "egide", { stacks: 2 })] } }],
  },
];
