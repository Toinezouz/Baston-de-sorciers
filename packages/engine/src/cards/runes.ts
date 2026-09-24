import type { CardDefinition } from "../types";
import { T, dmg, drain, draw, forEach, heal, iff, loseHp, power, status } from "./dsl";

/**
 * Runes : les composants de sort.
 * - AMORCE (résolue en 1er) : préparation, effets sur soi, petits dégâts.
 * - TORSION (2e)           : statuts, manipulation, invocations.
 * - FRAPPE (3e)            : gros effet, porte l'initiative, souvent un jet de Puissance.
 *
 * Puissance : N d6 où N = nombre de runes du sort partageant l'école de la rune.
 * Paliers : 1–4 / 5–9 / 10+.
 */
export const RUNES: CardDefinition[] = [
  // =========================================================================
  // BRAISE — dégâts directs, brûlures
  // =========================================================================
  {
    id: "rune.braise.etincelle-tetue",
    kind: "RUNE", slot: "AMORCE", schools: ["BRAISE"], copies: 3,
    name: "Étincelle têtue",
    text: "Inflige 1 dégât au sorcier à ta gauche. Si ton sort contient 2 runes de Braise ou plus, inflige aussi 1 dégât au sorcier à ta droite.",
    effects: [
      dmg(T.LEFT, 1, "BRAISE"),
      iff({ c: "RUNES_OF_SCHOOL_AT_LEAST", school: "BRAISE", value: 2 }, [dmg(T.RIGHT, 1, "BRAISE")]),
    ],
  },
  {
    id: "rune.braise.soufflet-de-forge",
    kind: "RUNE", slot: "AMORCE", schools: ["BRAISE"], copies: 2,
    name: "Soufflet de forge",
    text: "Tu gagnes 1 Rage (2 tours).",
    effects: [status(T.SELF, "rage", { stacks: 1 })],
  },
  {
    id: "rune.braise.cendres-chaudes",
    kind: "RUNE", slot: "AMORCE", schools: ["BRAISE"], copies: 2,
    name: "Cendres chaudes",
    text: "Chaque adversaire atteint de Brûlure subit 2 dégâts.",
    effects: [forEach(T.ALL_FOES, [iff({ c: "HAS_STATUS", who: T.IT, status: "brulure" }, [dmg(T.IT, 2, "BRAISE")])])],
  },
  {
    id: "rune.braise.attise",
    kind: "RUNE", slot: "TORSION", schools: ["BRAISE"], copies: 3,
    name: "Attise",
    text: "Les sorciers à ta gauche et à ta droite reçoivent 1 Brûlure (2 tours).",
    effects: [status(T.LEFT, "brulure", { stacks: 1 }), status(T.RIGHT, "brulure", { stacks: 1 })],
  },
  {
    id: "rune.braise.combustion",
    kind: "RUNE", slot: "TORSION", schools: ["BRAISE"], copies: 2,
    name: "Combustion",
    text: "Tu gagnes Surcharge : tes prochains dégâts infligés sont doublés.",
    effects: [status(T.SELF, "surcharge", { stacks: 1 })],
  },
  {
    id: "rune.braise.braise-vorace",
    kind: "RUNE", slot: "TORSION", schools: ["BRAISE"], copies: 2,
    name: "Braise vorace",
    text: "Inflige au plus robuste de tes adversaires 1 dégât par rune de Braise de ton sort.",
    effects: [dmg(T.STRONGEST_FOE, { from: "RUNES_OF_SCHOOL", school: "BRAISE" }, "BRAISE")],
  },
  {
    id: "rune.braise.pluie-de-cendres",
    kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE"], copies: 2, initiative: 7,
    name: "Pluie de cendres",
    text: "Puissance de Braise. 1–4 : 1 dégât à chaque adversaire. 5–9 : 2 dégâts à chaque adversaire. 10+ : 3 dégâts à chaque adversaire et 1 Brûlure.",
    effects: [
      power(
        "SELF",
        [dmg(T.ALL_FOES, 1, "BRAISE")],
        [dmg(T.ALL_FOES, 2, "BRAISE")],
        [dmg(T.ALL_FOES, 3, "BRAISE"), status(T.ALL_FOES, "brulure", { stacks: 1 })],
      ),
    ],
  },
  {
    id: "rune.braise.lance-incandescente",
    kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE"], copies: 2, initiative: 12,
    name: "Lance incandescente",
    text: "Puissance de Braise. Choisis un adversaire ou une invocation adverse : 1–4 : 2 dégâts. 5–9 : 4 dégâts. 10+ : 6 dégâts.",
    effects: [
      power(
        "SELF",
        [dmg(T.CHOSEN_FOE_OR_SUMMON, 2, "BRAISE")],
        [dmg(T.CHOSEN_FOE_OR_SUMMON, 4, "BRAISE")],
        [dmg(T.CHOSEN_FOE_OR_SUMMON, 6, "BRAISE")],
      ),
    ],
  },
  {
    id: "rune.braise.cratere",
    kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE"], copies: 1, initiative: 3,
    name: "Cratère",
    text: "Puissance de Braise. TOUS les sorciers, toi compris : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 5 dégâts.",
    effects: [
      power("SELF", [dmg(T.ALL_PLAYERS, 2, "BRAISE")], [dmg(T.ALL_PLAYERS, 3, "BRAISE")], [dmg(T.ALL_PLAYERS, 5, "BRAISE")]),
    ],
  },

  // =========================================================================
  // OMBRE — vol de vie, venin, malédictions
  // =========================================================================
  {
    id: "rune.ombre.murmure-du-caveau",
    kind: "RUNE", slot: "AMORCE", schools: ["OMBRE"], copies: 3,
    name: "Murmure du caveau",
    text: "Draine 2 PV à ton adversaire le plus affaibli.",
    effects: [drain(T.WEAKEST_FOE, 2, "OMBRE")],
  },
  {
    id: "rune.ombre.pacte-sanglant",
    kind: "RUNE", slot: "AMORCE", schools: ["OMBRE"], copies: 2,
    name: "Pacte sanglant",
    text: "Tu perds 2 PV. Tu gagnes 2 Rage (2 tours).",
    effects: [loseHp(T.SELF, 2), status(T.SELF, "rage", { stacks: 2 })],
  },
  {
    id: "rune.ombre.ombre-portee",
    kind: "RUNE", slot: "AMORCE", schools: ["OMBRE"], copies: 2,
    name: "Ombre portée",
    text: "Le sorcier à ta droite reçoit Faiblesse (2 tours).",
    effects: [status(T.RIGHT, "faiblesse")],
  },
  {
    id: "rune.ombre.nuee-de-mites",
    kind: "RUNE", slot: "TORSION", schools: ["OMBRE"], copies: 3,
    name: "Nuée de mites",
    text: "Un adversaire de ton choix reçoit 2 Venin (3 tours).",
    effects: [status(T.CHOSEN_FOE, "venin", { stacks: 2 })],
  },
  {
    id: "rune.ombre.deuil",
    kind: "RUNE", slot: "TORSION", schools: ["OMBRE"], copies: 2,
    name: "Deuil",
    text: "Tu récupères 1 PV, plus 2 PV par sorcier mort cette manche.",
    effects: [heal(T.SELF, { from: "DEAD_PLAYERS", mul: 2, add: 1 })],
  },
  {
    id: "rune.ombre.malediction",
    kind: "RUNE", slot: "TORSION", schools: ["OMBRE"], copies: 2,
    name: "Malédiction",
    text: "Ton adversaire le plus robuste est Maudit (ne peut pas récupérer de PV, 2 tours).",
    effects: [status(T.STRONGEST_FOE, "maudit")],
  },
  {
    id: "rune.ombre.faux-spectrale",
    kind: "RUNE", slot: "FRAPPE", schools: ["OMBRE"], copies: 2, initiative: 10,
    name: "Faux spectrale",
    text: "Puissance d'Ombre. Draine à ton adversaire le plus affaibli : 1–4 : 1 PV. 5–9 : 3 PV. 10+ : 5 PV.",
    effects: [
      power("SELF", [drain(T.WEAKEST_FOE, 1, "OMBRE")], [drain(T.WEAKEST_FOE, 3, "OMBRE")], [drain(T.WEAKEST_FOE, 5, "OMBRE")]),
    ],
  },
  {
    id: "rune.ombre.etreinte-glacee",
    kind: "RUNE", slot: "FRAPPE", schools: ["OMBRE"], copies: 2, initiative: 5,
    name: "Étreinte glacée",
    text: "Puissance d'Ombre. Sorcier à ta gauche : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts. Ensuite, s'il lui reste 5 PV ou moins, il subit 3 dégâts supplémentaires.",
    effects: [
      power("SELF", [dmg(T.LEFT, 2, "OMBRE")], [dmg(T.LEFT, 3, "OMBRE")], [dmg(T.LEFT, 4, "OMBRE")]),
      iff({ c: "HP_AT_MOST", who: T.LEFT, value: 5 }, [dmg(T.LEFT, 3, "OMBRE")]),
    ],
  },
  {
    id: "rune.ombre.hurlement-du-neant",
    kind: "RUNE", slot: "FRAPPE", schools: ["OMBRE"], copies: 1, initiative: 14,
    name: "Hurlement du néant",
    text: "Puissance d'Ombre. Chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts et 1 Venin.",
    effects: [
      power(
        "SELF",
        [dmg(T.ALL_FOES, 1, "OMBRE")],
        [dmg(T.ALL_FOES, 2, "OMBRE")],
        [dmg(T.ALL_FOES, 3, "OMBRE"), status(T.ALL_FOES, "venin", { stacks: 1 })],
      ),
    ],
  },

  // =========================================================================
  // SÈVE — soins, protection, épines, invocations
  // =========================================================================
  {
    id: "rune.seve.pousse-vivace",
    kind: "RUNE", slot: "AMORCE", schools: ["SEVE"], copies: 3,
    name: "Pousse vivace",
    text: "Tu récupères 3 PV.",
    effects: [heal(T.SELF, 3)],
  },
  {
    id: "rune.seve.ecorce",
    kind: "RUNE", slot: "AMORCE", schools: ["SEVE"], copies: 2,
    name: "Écorce",
    text: "Tu gagnes 3 Égide (2 tours).",
    effects: [status(T.SELF, "egide", { stacks: 3 })],
  },
  {
    id: "rune.seve.graine-de-ronce",
    kind: "RUNE", slot: "AMORCE", schools: ["SEVE"], copies: 2,
    name: "Graine de ronce",
    text: "Tu gagnes Épines (2 tours) : chaque adversaire qui te blesse subit 1 dégât.",
    effects: [status(T.SELF, "epines")],
  },
  {
    id: "rune.seve.seve-montante",
    kind: "RUNE", slot: "TORSION", schools: ["SEVE"], copies: 2,
    name: "Sève montante",
    text: "Tu gagnes 2 Régénération (3 tours).",
    effects: [status(T.SELF, "regeneration", { stacks: 2 })],
  },
  {
    id: "rune.seve.appel-du-bosquet",
    kind: "RUNE", slot: "TORSION", schools: ["SEVE"], copies: 2,
    name: "Appel du bosquet",
    text: "Invoque un Golem de mousse (6 PV) qui te donne 1 Égide à chaque fin de tour.",
    effects: [{ op: "SUMMON", summon: "golem-de-mousse" }],
  },
  {
    id: "rune.seve.pollen-engourdissant",
    kind: "RUNE", slot: "TORSION", schools: ["SEVE"], copies: 2,
    name: "Pollen engourdissant",
    text: "Les sorciers à ta gauche et à ta droite reçoivent Faiblesse (2 tours).",
    effects: [status(T.LEFT, "faiblesse"), status(T.RIGHT, "faiblesse")],
  },
  {
    id: "rune.seve.fouet-de-liane",
    kind: "RUNE", slot: "FRAPPE", schools: ["SEVE"], copies: 2, initiative: 9,
    name: "Fouet de liane",
    text: "Puissance de Sève. Sorcier à ta droite : 1–4 : 1 dégât. 5–9 : 3 dégâts. 10+ : 5 dégâts. Tu récupères ensuite 1 PV (2 PV au palier 10+).",
    effects: [
      power(
        "SELF",
        [dmg(T.RIGHT, 1, "SEVE"), heal(T.SELF, 1)],
        [dmg(T.RIGHT, 3, "SEVE"), heal(T.SELF, 1)],
        [dmg(T.RIGHT, 5, "SEVE"), heal(T.SELF, 2)],
      ),
    ],
  },
  {
    id: "rune.seve.ruee-des-racines",
    kind: "RUNE", slot: "FRAPPE", schools: ["SEVE"], copies: 2, initiative: 6,
    name: "Ruée des racines",
    text: "Puissance de Sève. Un adversaire de ton choix : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts. Tu gagnes autant d'Égide que le palier obtenu (1, 2 ou 3).",
    effects: [
      power(
        "SELF",
        [dmg(T.CHOSEN_FOE, 2, "SEVE"), status(T.SELF, "egide", { stacks: 1 })],
        [dmg(T.CHOSEN_FOE, 3, "SEVE"), status(T.SELF, "egide", { stacks: 2 })],
        [dmg(T.CHOSEN_FOE, 4, "SEVE"), status(T.SELF, "egide", { stacks: 3 })],
      ),
    ],
  },
  {
    id: "rune.seve.floraison",
    kind: "RUNE", slot: "FRAPPE", schools: ["SEVE"], copies: 1, initiative: 2,
    name: "Floraison brutale",
    text: "Tous les sorciers récupèrent 2 PV. Puis Puissance de Sève, chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 4 dégâts.",
    effects: [
      heal(T.ALL_PLAYERS, 2),
      power("SELF", [dmg(T.ALL_FOES, 1, "SEVE")], [dmg(T.ALL_FOES, 2, "SEVE")], [dmg(T.ALL_FOES, 4, "SEVE")]),
    ],
  },

  // =========================================================================
  // ÉTHER — pioche, boucliers, dés, manipulation
  // =========================================================================
  {
    id: "rune.ether.lecture-des-astres",
    kind: "RUNE", slot: "AMORCE", schools: ["ETHER"], copies: 3,
    name: "Lecture des astres",
    text: "Pioche 2 runes.",
    effects: [draw(T.SELF, 2)],
  },
  {
    id: "rune.ether.prisme",
    kind: "RUNE", slot: "AMORCE", schools: ["ETHER"], copies: 2,
    name: "Prisme",
    text: "Tu gagnes Clairvoyance (+1 dé aux jets de Puissance, 2 tours).",
    effects: [status(T.SELF, "clairvoyance")],
  },
  {
    id: "rune.ether.voile-chatoyant",
    kind: "RUNE", slot: "AMORCE", schools: ["ETHER"], copies: 2,
    name: "Voile chatoyant",
    text: "Tu gagnes 2 Égide (2 tours) et pioches 1 rune.",
    effects: [status(T.SELF, "egide", { stacks: 2 }), draw(T.SELF, 1)],
  },
  {
    id: "rune.ether.echo-arcanique",
    kind: "RUNE", slot: "TORSION", schools: ["ETHER"], copies: 2,
    name: "Écho arcanique",
    text: "Inflige 1 dégât à un adversaire aléatoire. Écho : une chance sur deux de recommencer (4 fois au total maximum).",
    effects: [{ op: "ECHO", while: { c: "CHANCE", percent: 50 }, max: 4, effects: [dmg(T.RANDOM_FOE, 1, "ETHER")] }],
  },
  {
    id: "rune.ether.dissipation",
    kind: "RUNE", slot: "TORSION", schools: ["ETHER"], copies: 2,
    name: "Dissipation",
    text: "Retire tous les effets bénéfiques d'un adversaire de ton choix.",
    effects: [{ op: "REMOVE_STATUS", target: T.CHOSEN_FOE, polarity: "BUFF" }],
  },
  {
    id: "rune.ether.sceau-inverse",
    kind: "RUNE", slot: "TORSION", schools: ["ETHER"], copies: 1,
    name: "Sceau inversé",
    text: "Vole une relique aléatoire à ton adversaire le plus robuste. S'il n'en a pas, pioche 1 rune.",
    effects: [
      iff({ c: "HAS_RELIC", who: T.STRONGEST_FOE }, [{ op: "STEAL_RELIC", from: T.STRONGEST_FOE }], [draw(T.SELF, 1)]),
    ],
  },
  {
    id: "rune.ether.rayon-astral",
    kind: "RUNE", slot: "FRAPPE", schools: ["ETHER"], copies: 2, initiative: 11,
    name: "Rayon astral",
    text: "Puissance d'Éther. Ton adversaire le plus robuste : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 5 dégâts.",
    effects: [
      power("SELF", [dmg(T.STRONGEST_FOE, 2, "ETHER")], [dmg(T.STRONGEST_FOE, 3, "ETHER")], [dmg(T.STRONGEST_FOE, 5, "ETHER")]),
    ],
  },
  {
    id: "rune.ether.belier-de-lumiere",
    kind: "RUNE", slot: "FRAPPE", schools: ["ETHER"], copies: 2, initiative: 4,
    name: "Bélier de lumière",
    text: "Puissance d'Éther : tu gagnes 1, 2 ou 3 Égide selon le palier. Puis le sorcier à ta gauche subit autant de dégâts que ton Égide totale.",
    effects: [
      power(
        "SELF",
        [status(T.SELF, "egide", { stacks: 1 })],
        [status(T.SELF, "egide", { stacks: 2 })],
        [status(T.SELF, "egide", { stacks: 3 })],
      ),
      dmg(T.LEFT, { from: "SELF_STATUS_STACKS", status: "egide" }, "ETHER"),
    ],
  },
  {
    id: "rune.ether.paradoxe",
    kind: "RUNE", slot: "FRAPPE", schools: ["ETHER"], copies: 1, initiative: 13,
    name: "Paradoxe",
    text: "Au choix : inflige 4 dégâts à un adversaire de ton choix ; OU récupère 4 PV et pioche 1 rune.",
    effects: [
      {
        op: "CHOOSE_OPTION",
        prompt: "Paradoxe : que choisis-tu ?",
        options: [
          { label: "4 dégâts à un adversaire", effects: [dmg(T.CHOSEN_FOE, 4, "ETHER")] },
          { label: "Récupérer 4 PV et piocher 1 rune", effects: [heal(T.SELF, 4), draw(T.SELF, 1)] },
        ],
      },
    ],
  },

  // =========================================================================
  // CHIMÈRE — hasard, vol, illusions
  // =========================================================================
  {
    id: "rune.chimere.pickpocket-fantome",
    kind: "RUNE", slot: "AMORCE", schools: ["CHIMERE"], copies: 3,
    name: "Pickpocket fantôme",
    text: "Vole 1 rune aléatoire dans la main d'un adversaire aléatoire.",
    effects: [{ op: "STEAL_CARD", from: T.RANDOM_FOE, count: 1 }],
  },
  {
    id: "rune.chimere.mirage",
    kind: "RUNE", slot: "AMORCE", schools: ["CHIMERE"], copies: 2,
    name: "Mirage",
    text: "Pile ou face : tu deviens Intangible jusqu'à la fin du tour ; OU tu perds 2 PV.",
    effects: [
      {
        op: "RANDOM",
        branches: [
          { weight: 1, effects: [status(T.SELF, "intangible")] },
          { weight: 1, effects: [loseHp(T.SELF, 2)] },
        ],
      },
    ],
  },
  {
    id: "rune.chimere.des-fous",
    kind: "RUNE", slot: "AMORCE", schools: ["CHIMERE"], copies: 2,
    name: "Dés fous",
    text: "Lance 2 dés. 10+ : tu gagnes une relique. Sinon : chaque adversaire subit 1 dégât.",
    effects: [
      {
        op: "POWER_ROLL",
        dice: 2,
        tiers: [[dmg(T.ALL_FOES, 1, "CHIMERE")], [dmg(T.ALL_FOES, 1, "CHIMERE")], [{ op: "GAIN_RELIC", target: T.SELF, count: 1 }]],
      },
    ],
  },
  {
    id: "rune.chimere.confusion",
    kind: "RUNE", slot: "TORSION", schools: ["CHIMERE"], copies: 2,
    name: "Confusion",
    text: "Un adversaire de ton choix défausse 2 runes au hasard.",
    effects: [{ op: "DISCARD", target: T.CHOSEN_FOE, count: 2, mode: "RANDOM" }],
  },
  {
    id: "rune.chimere.kaleidoscope",
    kind: "RUNE", slot: "TORSION", schools: ["CHIMERE"], copies: 2,
    name: "Kaléidoscope",
    text: "Un adversaire aléatoire reçoit un effet néfaste aléatoire : Brûlure, Venin, Faiblesse ou Vulnérable.",
    effects: [
      {
        op: "FOR_EACH",
        target: T.RANDOM_FOE,
        effects: [
          {
            op: "RANDOM",
            branches: [
              { weight: 1, effects: [status(T.IT, "brulure", { stacks: 1 })] },
              { weight: 1, effects: [status(T.IT, "venin", { stacks: 1 })] },
              { weight: 1, effects: [status(T.IT, "faiblesse")] },
              { weight: 1, effects: [status(T.IT, "vulnerable")] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "rune.chimere.sosie-a-plumes",
    kind: "RUNE", slot: "TORSION", schools: ["CHIMERE"], copies: 1,
    name: "Sosie à plumes",
    text: "Invoque un Corbeau charognard (2 PV) : chaque fois qu'un sorcier meurt, tu récupères 2 PV et pioches 1 rune.",
    effects: [{ op: "SUMMON", summon: "corbeau-charognard" }],
  },
  {
    id: "rune.chimere.tourbillon",
    kind: "RUNE", slot: "FRAPPE", schools: ["CHIMERE"], copies: 2, initiative: 8,
    name: "Tourbillon farceur",
    text: "Puissance de Chimère, puis 3 fois : un adversaire aléatoire subit 1 dégât (1–4), 2 dégâts (5–9) ou 3 dégâts (10+).",
    effects: [
      power(
        "SELF",
        [{ op: "REPEAT", times: 3, effects: [dmg(T.RANDOM_FOE, 1, "CHIMERE")] }],
        [{ op: "REPEAT", times: 3, effects: [dmg(T.RANDOM_FOE, 2, "CHIMERE")] }],
        [{ op: "REPEAT", times: 3, effects: [dmg(T.RANDOM_FOE, 3, "CHIMERE")] }],
      ),
    ],
  },
  {
    id: "rune.chimere.farce-cruelle",
    kind: "RUNE", slot: "FRAPPE", schools: ["CHIMERE"], copies: 2, initiative: 1,
    name: "Farce cruelle",
    text: "Puissance de Chimère. Un adversaire de ton choix : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts et il défausse 1 rune au hasard.",
    effects: [
      power(
        "SELF",
        [dmg(T.CHOSEN_FOE, 2, "CHIMERE")],
        [dmg(T.CHOSEN_FOE, 3, "CHIMERE")],
        [
          forEach(T.CHOSEN_FOE, [dmg(T.IT, 4, "CHIMERE"), { op: "DISCARD", target: T.IT, count: 1, mode: "RANDOM" }]),
        ],
      ),
    ],
  },
  {
    id: "rune.chimere.grand-illusionniste",
    kind: "RUNE", slot: "FRAPPE", schools: ["CHIMERE"], copies: 1, initiative: 15,
    name: "Grand illusionniste",
    text: "Puissance de Chimère. Chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts et il défausse 1 rune au hasard.",
    effects: [
      power(
        "SELF",
        [dmg(T.ALL_FOES, 1, "CHIMERE")],
        [dmg(T.ALL_FOES, 2, "CHIMERE")],
        [dmg(T.ALL_FOES, 3, "CHIMERE"), { op: "DISCARD", target: T.ALL_FOES, count: 1, mode: "RANDOM" }],
      ),
    ],
  },

  // =========================================================================
  // Runes bi-écoles (comptent pour les deux écoles)
  // =========================================================================
  {
    id: "rune.duo.tison-d-ombre",
    kind: "RUNE", slot: "AMORCE", schools: ["BRAISE", "OMBRE"], copies: 2,
    name: "Tison d'ombre",
    text: "Draine 1 PV au sorcier à ta gauche et lui inflige 1 Brûlure (2 tours).",
    effects: [drain(T.LEFT, 1, "OMBRE"), status(T.LEFT, "brulure", { stacks: 1 })],
  },
  {
    id: "rune.duo.epine-astrale",
    kind: "RUNE", slot: "TORSION", schools: ["SEVE", "ETHER"], copies: 2,
    name: "Épine astrale",
    text: "Tu gagnes Épines (2 tours) et pioches 1 rune.",
    effects: [status(T.SELF, "epines"), draw(T.SELF, 1)],
  },
  {
    id: "rune.duo.chaos-flamboyant",
    kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE", "CHIMERE"], copies: 1, initiative: 16,
    name: "Chaos flamboyant",
    text: "Puissance (Braise ou Chimère, la meilleure). Un adversaire aléatoire : 1–4 : 3 dégâts. 5–9 : 4 dégâts. 10+ : 6 dégâts et 2 Brûlure.",
    effects: [
      power(
        "SELF",
        [dmg(T.RANDOM_FOE, 3, "BRAISE")],
        [dmg(T.RANDOM_FOE, 4, "BRAISE")],
        [forEach(T.RANDOM_FOE, [dmg(T.IT, 6, "BRAISE"), status(T.IT, "brulure", { stacks: 2 })])],
      ),
    ],
  },
  {
    id: "rune.duo.frappe-crepusculaire",
    kind: "RUNE", slot: "FRAPPE", schools: ["OMBRE", "ETHER"], copies: 1, initiative: 17,
    name: "Frappe crépusculaire",
    text: "Puissance (Ombre ou Éther, la meilleure). Ton adversaire le plus robuste : 1–4 : 2 dégâts. 5–9 : 3 dégâts et Vulnérable. 10+ : 5 dégâts et Vulnérable.",
    effects: [
      power(
        "SELF",
        [dmg(T.STRONGEST_FOE, 2, "OMBRE")],
        [forEach(T.STRONGEST_FOE, [dmg(T.IT, 3, "OMBRE"), status(T.IT, "vulnerable")])],
        [forEach(T.STRONGEST_FOE, [dmg(T.IT, 5, "OMBRE"), status(T.IT, "vulnerable")])],
      ),
    ],
  },

  // =========================================================================
  // Rune instable (joker)
  // =========================================================================
  {
    id: "rune.instable",
    kind: "RUNE", schools: [], unstable: true, copies: 6,
    name: "Rune instable",
    text: "Se place dans n'importe quel emplacement. Au dévoilement, elle est remplacée par la première rune de la pioche correspondant à cet emplacement.",
    effects: [],
  },
];
