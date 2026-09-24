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
  // --- Extension « Échos du Grimoire » ------------------------------------
  {
    id: "relic.oeuf-de-salamandre", kind: "RELIC", schools: [], copies: 1, effects: [],
    name: "Œuf de salamandre",
    text: "Au début de chaque manche, une Salamandre (3 PV) éclot à tes côtés : elle inflige 1 Brûlure à chaque fin de tour.",
    passives: [{ trigger: { on: "ON_ROUND_START", effects: [{ op: "SUMMON", summon: "salamandre" }] } }],
  },
  {
    id: "relic.fiole-de-venin", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Fiole de venin",
    text: "Tes dégâts d'Ombre sont augmentés de 1.",
    passives: [{ modifier: { hook: "DAMAGE_OUT", kind: "ADD", value: 1, filter: { school: "OMBRE" } } }],
  },
  {
    id: "relic.dague-du-filou", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Dague du filou",
    text: "Tes dégâts de Chimère sont augmentés de 1.",
    passives: [{ modifier: { hook: "DAMAGE_OUT", kind: "ADD", value: 1, filter: { school: "CHIMERE" } } }],
  },
  {
    id: "relic.graine-eternelle", kind: "RELIC", schools: [], copies: 1, effects: [], eternal: true,
    name: "Graine éternelle",
    text: "Éternelle. Au début de chaque manche, un Golem de mousse (6 PV) se lève à tes côtés.",
    passives: [{ trigger: { on: "ON_ROUND_START", effects: [{ op: "SUMMON", summon: "golem-de-mousse" }] } }],
  },
  {
    id: "relic.lentille-astrale", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Lentille astrale",
    text: "Quand ton jet de Puissance totalise 10 ou plus, tu pioches 1 rune.",
    passives: [{ trigger: { on: "ON_DICE_ROLLED", filter: { minAmount: 10 }, effects: [draw(T.HOLDER, 1)] } }],
  },
  {
    id: "relic.collier-de-crocs", kind: "RELIC", schools: [], copies: 1, effects: [],
    name: "Collier de crocs",
    text: "Quand tu élimines un sorcier, tu gagnes 2 Rage (2 tours).",
    passives: [{ trigger: { on: "ON_KILL", effects: [status(T.HOLDER, "rage", { stacks: 2 })] } }],
  },
  {
    id: "relic.masque-du-bouffon", kind: "RELIC", schools: [], copies: 1, effects: [],
    name: "Masque du bouffon",
    text: "Une fois par tour, quand un adversaire te blesse, une chance sur quatre de devenir Intangible jusqu'à la fin du tour.",
    passives: [
      {
        trigger: {
          on: "ON_DAMAGE_RECEIVED",
          filter: { otherIsFoe: true },
          maxPerTurn: 1,
          effects: [iff({ c: "CHANCE", percent: 25 }, [status(T.HOLDER, "intangible", { duration: 1 })])],
        },
      },
    ],
  },
  {
    id: "relic.talisman-de-seve", kind: "RELIC", schools: [], copies: 2, effects: [],
    name: "Talisman de sève",
    text: "Chaque soin que tu reçois te rend 1 PV de plus.",
    passives: [{ modifier: { hook: "HEAL_IN", kind: "ADD", value: 1 } }],
  },
  {
    id: "relic.cloche-funebre", kind: "RELIC", schools: [], copies: 1, effects: [],
    name: "Cloche funèbre",
    text: "Quand un autre sorcier meurt, chacun de tes adversaires subit 1 dégât.",
    passives: [{ trigger: { on: "ON_ANY_DEATH", effects: [dmg(T.ALL_FOES, 1, "OMBRE")] } }],
  },
  {
    id: "relic.plume-de-phenix", kind: "RELIC", schools: [], copies: 1, effects: [], eternal: true,
    name: "Plume de phénix",
    text: "Éternelle. +2 PV maximum. Au début de chaque manche, tu gagnes 2 Égide.",
    passives: [
      { modifier: { hook: "MAX_HP", kind: "ADD", value: 2 } },
      { trigger: { on: "ON_ROUND_START", effects: [status(T.HOLDER, "egide", { stacks: 2 })] } },
    ],
  },
];
