import type { CardDefinition, EffectNode } from "../types";
import { T, dmg, drain, draw, forEach, heal, iff, loseHp, power, status } from "./dsl";

/**
 * Extension « Échos du Grimoire » : 32 runes pensées pour interagir avec le reste du catalogue.
 *
 * Axes de synergie :
 * - Braise    : poser des Brûlures (zone, invocations) puis les « encaisser » (Embrasement).
 * - Ombre     : répandre le Venin (Peste noire) puis l'exécuter (Sentence) ; refiler ses malus.
 * - Sève      : invocations (Symbiose, Charge du bosquet), survie (Colère de la forêt : plus fort blessé).
 * - Éther     : vitesse (Hâte, Comète « premier à frapper »), taille de main (Méditation → Savoir interdit), Gel.
 * - Chimère   : voler les bonus adverses (Tour de passe-passe), paris risqués, vols de cartes.
 * - Bi-écoles : couvrent les 10 paires d'écoles et relient les axes entre eux.
 */

const discardIt = (count: number): EffectNode => ({ op: "DISCARD", target: T.IT, count, mode: "RANDOM" });
const stealIt = (count: number): EffectNode => ({ op: "STEAL_CARD", from: T.IT, count });

export const RUNES_ECHOS: CardDefinition[] = [
  // =========================================================================
  // BRAISE
  // =========================================================================
  {
    id: "rune.braise.braises-dormantes",
    kind: "RUNE", slot: "AMORCE", schools: ["BRAISE"], copies: 2,
    name: "Braises dormantes",
    text: "Chaque adversaire reçoit 1 Brûlure (2 tours).",
    effects: [status(T.ALL_FOES, "brulure", { stacks: 1 })],
  },
  {
    id: "rune.braise.aura-ardente",
    kind: "RUNE", slot: "AMORCE", schools: ["BRAISE"], copies: 1,
    name: "Aura ardente",
    text: "Tu gagnes Aura ardente (2 tours) : à chaque fin de tour, chaque adversaire subit 1 dégât.",
    effects: [status(T.SELF, "aura-ardente")],
  },
  {
    id: "rune.braise.embrasement",
    kind: "RUNE", slot: "TORSION", schools: ["BRAISE"], copies: 2,
    name: "Embrasement",
    text: "Chaque adversaire subit 2 dégâts par cumul de Brûlure qu'il porte, puis sa Brûlure s'éteint.",
    effects: [
      forEach(T.ALL_FOES, [
        dmg(T.IT, { from: "IT_STATUS_STACKS", status: "brulure", mul: 2 }, "BRAISE"),
        { op: "REMOVE_STATUS", target: T.IT, status: "brulure" },
      ]),
    ],
  },
  {
    id: "rune.braise.forge-vive",
    kind: "RUNE", slot: "TORSION", schools: ["BRAISE"], copies: 2,
    name: "Forge vive",
    text: "Tu gagnes 1 Rage (2 tours) par rune de Braise de ton sort.",
    effects: [status(T.SELF, "rage", { stacks: { from: "RUNES_OF_SCHOOL", school: "BRAISE" } })],
  },
  {
    id: "rune.braise.meteore",
    kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE"], copies: 1, initiative: 6,
    name: "Météore",
    text: "Puissance de Braise. Un adversaire de ton choix : 1–4 : 3 dégâts. 5–9 : 5 dégâts. 10+ : 7 dégâts. Tu perds 1 PV (recul).",
    effects: [
      power("SELF", [dmg(T.CHOSEN_FOE, 3, "BRAISE")], [dmg(T.CHOSEN_FOE, 5, "BRAISE")], [dmg(T.CHOSEN_FOE, 7, "BRAISE")]),
      loseHp(T.SELF, 1),
    ],
  },
  {
    id: "rune.braise.souffle-du-dragon",
    kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE"], copies: 2, initiative: 13,
    name: "Souffle du dragon",
    text: "Puissance de Braise. Tes deux voisins : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts et 1 Brûlure.",
    effects: [
      power(
        "SELF",
        [dmg(T.LEFT, 2, "BRAISE"), dmg(T.RIGHT, 2, "BRAISE")],
        [dmg(T.LEFT, 3, "BRAISE"), dmg(T.RIGHT, 3, "BRAISE")],
        [dmg(T.LEFT, 4, "BRAISE"), dmg(T.RIGHT, 4, "BRAISE"), status(T.LEFT, "brulure", { stacks: 1 }), status(T.RIGHT, "brulure", { stacks: 1 })],
      ),
    ],
  },

  // =========================================================================
  // OMBRE
  // =========================================================================
  {
    id: "rune.ombre.marque-du-fossoyeur",
    kind: "RUNE", slot: "AMORCE", schools: ["OMBRE"], copies: 2,
    name: "Marque du fossoyeur",
    text: "Ton adversaire le plus affaibli reçoit 2 Marques (2 tours) : il subit 1 dégât de plus par Marque à chaque coup.",
    effects: [status(T.WEAKEST_FOE, "marque", { stacks: 2 })],
  },
  {
    id: "rune.ombre.sangsue",
    kind: "RUNE", slot: "AMORCE", schools: ["OMBRE"], copies: 2,
    name: "Sangsue",
    text: "Draine 1 PV à chaque adversaire.",
    effects: [drain(T.ALL_FOES, 1, "OMBRE")],
  },
  {
    id: "rune.ombre.peste-noire",
    kind: "RUNE", slot: "TORSION", schools: ["OMBRE"], copies: 2,
    name: "Peste noire",
    text: "Chaque adversaire reçoit 1 Venin (3 tours), ou 2 Venin s'il est déjà empoisonné.",
    effects: [
      forEach(T.ALL_FOES, [
        iff({ c: "HAS_STATUS", who: T.IT, status: "venin" }, [status(T.IT, "venin", { stacks: 2 })], [status(T.IT, "venin", { stacks: 1 })]),
      ]),
    ],
  },
  {
    id: "rune.ombre.transfert-des-maux",
    kind: "RUNE", slot: "TORSION", schools: ["OMBRE"], copies: 2,
    name: "Transfert des maux",
    text: "Tous tes effets néfastes passent sur un adversaire de ton choix.",
    effects: [{ op: "TRANSFER_STATUS", from: T.SELF, to: T.CHOSEN_FOE, polarity: "DEBUFF" }],
  },
  {
    id: "rune.ombre.moisson-des-ames",
    kind: "RUNE", slot: "FRAPPE", schools: ["OMBRE"], copies: 1, initiative: 16,
    name: "Moisson des âmes",
    text: "Puissance d'Ombre. Ton adversaire le plus affaibli : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 5 dégâts. Puis 2 dégâts de plus par sorcier déjà mort cette manche.",
    effects: [
      power("SELF", [dmg(T.WEAKEST_FOE, 2, "OMBRE")], [dmg(T.WEAKEST_FOE, 3, "OMBRE")], [dmg(T.WEAKEST_FOE, 5, "OMBRE")]),
      dmg(T.WEAKEST_FOE, { from: "DEAD_PLAYERS", mul: 2 }, "OMBRE"),
    ],
  },
  {
    id: "rune.ombre.sentence-du-venin",
    kind: "RUNE", slot: "FRAPPE", schools: ["OMBRE"], copies: 2, initiative: 3,
    name: "Sentence du venin",
    text: "Puissance d'Ombre. Chaque adversaire subit autant de dégâts que ses cumuls de Venin (1–4), +1 (5–9), ou le double (10+).",
    effects: [
      power(
        "SELF",
        [forEach(T.ALL_FOES, [dmg(T.IT, { from: "IT_STATUS_STACKS", status: "venin" }, "OMBRE")])],
        [forEach(T.ALL_FOES, [dmg(T.IT, { from: "IT_STATUS_STACKS", status: "venin", add: 1 }, "OMBRE")])],
        [forEach(T.ALL_FOES, [dmg(T.IT, { from: "IT_STATUS_STACKS", status: "venin", mul: 2 }, "OMBRE")])],
      ),
    ],
  },

  // =========================================================================
  // SÈVE
  // =========================================================================
  {
    id: "rune.seve.racines-profondes",
    kind: "RUNE", slot: "AMORCE", schools: ["SEVE"], copies: 2,
    name: "Racines profondes",
    text: "Tu gagnes 2 Carapace (2 tours) : −1 dégât subi par cumul, à chaque coup.",
    effects: [status(T.SELF, "carapace", { stacks: 2 })],
  },
  {
    id: "rune.seve.rosee-du-matin",
    kind: "RUNE", slot: "AMORCE", schools: ["SEVE"], copies: 2,
    name: "Rosée du matin",
    text: "Retire tes effets néfastes, puis tu récupères 2 PV.",
    effects: [{ op: "REMOVE_STATUS", target: T.SELF, polarity: "DEBUFF" }, heal(T.SELF, 2)],
  },
  {
    id: "rune.seve.symbiose",
    kind: "RUNE", slot: "TORSION", schools: ["SEVE"], copies: 2,
    name: "Symbiose",
    text: "Tu récupères 1 PV, plus 2 PV par invocation que tu contrôles. Tes invocations récupèrent 3 PV.",
    effects: [heal(T.SELF, { from: "MY_SUMMON_COUNT", mul: 2, add: 1 }), heal(T.MY_SUMMONS, 3)],
  },
  {
    id: "rune.seve.coeur-de-chene",
    kind: "RUNE", slot: "TORSION", schools: ["SEVE"], copies: 2,
    name: "Cœur de chêne",
    text: "Tu gagnes Lien vital (2 tours) : chaque fois que tu blesses un adversaire, tu récupères 1 PV (3 fois par tour).",
    effects: [status(T.SELF, "lien-vital")],
  },
  {
    id: "rune.seve.charge-du-bosquet",
    kind: "RUNE", slot: "FRAPPE", schools: ["SEVE"], copies: 2, initiative: 7,
    name: "Charge du bosquet",
    text: "Puissance de Sève. Un adversaire de ton choix : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts. Puis chacune de tes invocations inflige 2 dégâts à un adversaire aléatoire.",
    effects: [
      power("SELF", [dmg(T.CHOSEN_FOE, 1, "SEVE")], [dmg(T.CHOSEN_FOE, 2, "SEVE")], [dmg(T.CHOSEN_FOE, 3, "SEVE")]),
      forEach(T.MY_SUMMONS, [dmg(T.RANDOM_FOE, 2, "SEVE")]),
    ],
  },
  {
    id: "rune.seve.colere-de-la-foret",
    kind: "RUNE", slot: "FRAPPE", schools: ["SEVE"], copies: 1, initiative: 12,
    name: "Colère de la forêt",
    text: "Puissance de Sève. Chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts. Si tu as 8 PV ou moins, chaque adversaire subit 2 dégâts de plus.",
    effects: [
      power("SELF", [dmg(T.ALL_FOES, 1, "SEVE")], [dmg(T.ALL_FOES, 2, "SEVE")], [dmg(T.ALL_FOES, 3, "SEVE")]),
      iff({ c: "HP_AT_MOST", who: T.SELF, value: 8 }, [dmg(T.ALL_FOES, 2, "SEVE")]),
    ],
  },

  // =========================================================================
  // ÉTHER
  // =========================================================================
  {
    id: "rune.ether.hate-astrale",
    kind: "RUNE", slot: "AMORCE", schools: ["ETHER"], copies: 2,
    name: "Hâte astrale",
    text: "Tu gagnes Hâte (+8 à l'initiative, 2 tours) et pioches 1 rune.",
    effects: [status(T.SELF, "hate"), draw(T.SELF, 1)],
  },
  {
    id: "rune.ether.meditation",
    kind: "RUNE", slot: "AMORCE", schools: ["ETHER"], copies: 2,
    name: "Méditation",
    text: "Tu gagnes 1 Inspiration (+1 rune en main, 2 tours) et 1 Égide, puis pioches 1 rune.",
    effects: [status(T.SELF, "inspiration", { stacks: 1 }), status(T.SELF, "egide", { stacks: 1 }), draw(T.SELF, 1)],
  },
  {
    id: "rune.ether.stase",
    kind: "RUNE", slot: "TORSION", schools: ["ETHER"], copies: 2,
    name: "Stase",
    text: "Un adversaire de ton choix est Gelé (2 tours) : −1 dé de Puissance et −8 à l'initiative.",
    effects: [status(T.CHOSEN_FOE, "gel")],
  },
  {
    id: "rune.ether.invocation-cristalline",
    kind: "RUNE", slot: "TORSION", schools: ["ETHER"], copies: 1,
    name: "Invocation cristalline",
    text: "Invoque une Sentinelle de cristal (5 PV) : au début de chaque tour, elle te donne Clairvoyance (+1 dé).",
    effects: [{ op: "SUMMON", summon: "sentinelle-de-cristal" }],
  },
  {
    id: "rune.ether.comete",
    kind: "RUNE", slot: "FRAPPE", schools: ["ETHER"], copies: 2, initiative: 18,
    name: "Comète",
    text: "Puissance d'Éther. Ton adversaire le plus robuste : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts. Si ton sort est le premier résolu ce tour, 2 dégâts de plus.",
    effects: [
      power("SELF", [dmg(T.STRONGEST_FOE, 2, "ETHER")], [dmg(T.STRONGEST_FOE, 3, "ETHER")], [dmg(T.STRONGEST_FOE, 4, "ETHER")]),
      iff({ c: "CAST_FIRST" }, [dmg(T.STRONGEST_FOE, 2, "ETHER")]),
    ],
  },
  {
    id: "rune.ether.savoir-interdit",
    kind: "RUNE", slot: "FRAPPE", schools: ["ETHER"], copies: 2, initiative: 9,
    name: "Savoir interdit",
    text: "Puissance d'Éther. Un adversaire de ton choix : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts. Puis 1 dégât de plus par tranche de 2 runes dans ta main.",
    effects: [
      forEach(T.CHOSEN_FOE, [
        power("SELF", [dmg(T.IT, 1, "ETHER")], [dmg(T.IT, 2, "ETHER")], [dmg(T.IT, 3, "ETHER")]),
        dmg(T.IT, { from: "HAND_SIZE", mul: 0.5 }, "ETHER"),
      ]),
    ],
  },

  // =========================================================================
  // CHIMÈRE
  // =========================================================================
  {
    id: "rune.chimere.tour-de-passe-passe",
    kind: "RUNE", slot: "AMORCE", schools: ["CHIMERE"], copies: 2,
    name: "Tour de passe-passe",
    text: "Tu voles tous les effets bénéfiques d'un adversaire de ton choix.",
    effects: [{ op: "TRANSFER_STATUS", from: T.CHOSEN_FOE, to: T.SELF, polarity: "BUFF" }],
  },
  {
    id: "rune.chimere.jeu-de-dupes",
    kind: "RUNE", slot: "AMORCE", schools: ["CHIMERE"], copies: 2,
    name: "Jeu de dupes",
    text: "Au hasard : tu gagnes 2 Rage ; OU tu gagnes 3 Égide ; OU tu pioches 2 runes.",
    effects: [
      {
        op: "RANDOM",
        branches: [
          { weight: 1, effects: [status(T.SELF, "rage", { stacks: 2 })] },
          { weight: 1, effects: [status(T.SELF, "egide", { stacks: 3 })] },
          { weight: 1, effects: [draw(T.SELF, 2)] },
        ],
      },
    ],
  },
  {
    id: "rune.chimere.reflet-trompeur",
    kind: "RUNE", slot: "TORSION", schools: ["CHIMERE"], copies: 2,
    name: "Reflet trompeur",
    text: "Invoque un Double illusoire (3 PV) : en fin de tour, une chance sur deux d'infliger 2 dégâts à un adversaire aléatoire.",
    effects: [{ op: "SUMMON", summon: "double-illusoire" }],
  },
  {
    id: "rune.chimere.pari-du-fou",
    kind: "RUNE", slot: "TORSION", schools: ["CHIMERE"], copies: 2,
    name: "Pari du fou",
    text: "Pile : tu gagnes 2 Surcharge (tes deux prochains effets de dégâts sont doublés). Face : tu perds 3 PV.",
    effects: [iff({ c: "CHANCE", percent: 50 }, [status(T.SELF, "surcharge", { stacks: 2 })], [loseHp(T.SELF, 3)])],
  },
  {
    id: "rune.chimere.loterie-infernale",
    kind: "RUNE", slot: "FRAPPE", schools: ["CHIMERE"], copies: 1, initiative: 10,
    name: "Loterie infernale",
    text: "Puissance de Chimère. 1–4 : 2 dégâts à un adversaire aléatoire. 5–9 : 2 dégâts à chaque adversaire. 10+ : 3 dégâts à chaque adversaire et tu gagnes une relique.",
    effects: [
      power(
        "SELF",
        [dmg(T.RANDOM_FOE, 2, "CHIMERE")],
        [dmg(T.ALL_FOES, 2, "CHIMERE")],
        [dmg(T.ALL_FOES, 3, "CHIMERE"), { op: "GAIN_RELIC", target: T.SELF, count: 1 }],
      ),
    ],
  },
  {
    id: "rune.chimere.grand-chapardage",
    kind: "RUNE", slot: "FRAPPE", schools: ["CHIMERE"], copies: 2, initiative: 4,
    name: "Grand chapardage",
    text: "Puissance de Chimère. Un adversaire de ton choix : 1–4 : 2 dégâts et tu lui voles 1 rune. 5–9 : 3 dégâts et 1 rune. 10+ : 4 dégâts et 2 runes.",
    effects: [
      forEach(T.CHOSEN_FOE, [
        power("SELF", [dmg(T.IT, 2, "CHIMERE"), stealIt(1)], [dmg(T.IT, 3, "CHIMERE"), stealIt(1)], [dmg(T.IT, 4, "CHIMERE"), stealIt(2)]),
      ]),
    ],
  },

  // =========================================================================
  // Bi-écoles (complètent les 10 paires)
  // =========================================================================
  {
    id: "rune.duo.cendres-fertiles",
    kind: "RUNE", slot: "AMORCE", schools: ["BRAISE", "SEVE"], copies: 1,
    name: "Cendres fertiles",
    text: "Tu récupères 2 PV. Le sorcier à ta gauche reçoit 1 Brûlure (2 tours).",
    effects: [heal(T.SELF, 2), status(T.LEFT, "brulure", { stacks: 1 })],
  },
  {
    id: "rune.duo.prisme-incandescent",
    kind: "RUNE", slot: "TORSION", schools: ["BRAISE", "ETHER"], copies: 1,
    name: "Prisme incandescent",
    text: "Tu gagnes Clairvoyance (+1 dé, 2 tours) et 1 Rage (2 tours).",
    effects: [status(T.SELF, "clairvoyance"), status(T.SELF, "rage", { stacks: 1 })],
  },
  {
    id: "rune.duo.racines-putrides",
    kind: "RUNE", slot: "TORSION", schools: ["OMBRE", "SEVE"], copies: 1,
    name: "Racines putrides",
    text: "Un adversaire de ton choix reçoit 1 Venin et Faiblesse ; tu gagnes 1 Régénération.",
    effects: [
      forEach(T.CHOSEN_FOE, [status(T.IT, "venin", { stacks: 1 }), status(T.IT, "faiblesse")]),
      status(T.SELF, "regeneration", { stacks: 1 }),
    ],
  },
  {
    id: "rune.duo.spores-hallucinogenes",
    kind: "RUNE", slot: "AMORCE", schools: ["SEVE", "CHIMERE"], copies: 1,
    name: "Spores hallucinogènes",
    text: "Un adversaire aléatoire devient Vulnérable (1 tour). Tu récupères 2 PV.",
    effects: [status(T.RANDOM_FOE, "vulnerable"), heal(T.SELF, 2)],
  },
  {
    id: "rune.duo.cauchemar",
    kind: "RUNE", slot: "FRAPPE", schools: ["OMBRE", "CHIMERE"], copies: 1, initiative: 11,
    name: "Cauchemar",
    text: "Puissance (Ombre ou Chimère). Un adversaire de ton choix : 1–4 : 2 dégâts et 1 rune défaussée au hasard. 5–9 : 3 dégâts et 1 rune. 10+ : 4 dégâts et 2 runes.",
    effects: [
      forEach(T.CHOSEN_FOE, [
        power("SELF", [dmg(T.IT, 2, "OMBRE"), discardIt(1)], [dmg(T.IT, 3, "OMBRE"), discardIt(1)], [dmg(T.IT, 4, "OMBRE"), discardIt(2)]),
      ]),
    ],
  },
  {
    id: "rune.duo.paradoxe-temporel",
    kind: "RUNE", slot: "FRAPPE", schools: ["ETHER", "CHIMERE"], copies: 1, initiative: 15,
    name: "Paradoxe temporel",
    text: "Puissance (Éther ou Chimère). Tu pioches 1 / 2 / 3 runes et ton adversaire le plus robuste subit 1 / 2 / 3 dégâts selon le palier.",
    effects: [
      power(
        "SELF",
        [draw(T.SELF, 1), dmg(T.STRONGEST_FOE, 1, "ETHER")],
        [draw(T.SELF, 2), dmg(T.STRONGEST_FOE, 2, "ETHER")],
        [draw(T.SELF, 3), dmg(T.STRONGEST_FOE, 3, "ETHER")],
      ),
    ],
  },
  {
    id: "rune.duo.brasier-funebre",
    kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE", "OMBRE"], copies: 1, initiative: 14,
    name: "Brasier funèbre",
    text: "Puissance (Braise ou Ombre). Chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts, 1 Brûlure et 1 Venin.",
    effects: [
      power(
        "SELF",
        [dmg(T.ALL_FOES, 1, "BRAISE")],
        [dmg(T.ALL_FOES, 2, "BRAISE")],
        [dmg(T.ALL_FOES, 3, "BRAISE"), status(T.ALL_FOES, "brulure", { stacks: 1 }), status(T.ALL_FOES, "venin", { stacks: 1 })],
      ),
    ],
  },
  {
    id: "rune.duo.aurore",
    kind: "RUNE", slot: "FRAPPE", schools: ["SEVE", "ETHER"], copies: 1, initiative: 2,
    name: "Aurore",
    text: "Puissance (Sève ou Éther). Tu récupères 2 / 3 / 4 PV, gagnes 1 / 2 / 3 Égide, et le sorcier à ta gauche subit 1 / 2 / 3 dégâts selon le palier.",
    effects: [
      power(
        "SELF",
        [heal(T.SELF, 2), status(T.SELF, "egide", { stacks: 1 }), dmg(T.LEFT, 1, "SEVE")],
        [heal(T.SELF, 3), status(T.SELF, "egide", { stacks: 2 }), dmg(T.LEFT, 2, "SEVE")],
        [heal(T.SELF, 4), status(T.SELF, "egide", { stacks: 3 }), dmg(T.LEFT, 3, "SEVE")],
      ),
    ],
  },
];
