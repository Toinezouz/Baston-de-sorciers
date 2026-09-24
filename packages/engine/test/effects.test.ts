/**
 * Tests unitaires des opérateurs d'effet et du pipeline de modificateurs.
 * Les effets sont exécutés directement (`runEffects`) sur une partie en cours.
 */
import { describe, expect, it } from "vitest";
import { T, dmg, drain, heal, loseHp, status } from "../src/cards/dsl";
import { collectTriggers } from "../src/resolution/triggers";
import type { EffectNode, GameState, StatusInstance } from "../src/types";
import { createTestGame, giveRelic, hp, runEffects, stackGrimoire } from "./helpers";

function addStatus(s: GameState, pid: string, defId: string, stacks = 1): void {
  const st: StatusInstance = { id: `t-${defId}-${pid}-${s.counters.status++}`, defId, sourceId: pid, stacks, remaining: "PERMANENT", appliedAt: 0 };
  s.players[pid]!.statuses.push(st);
}
const statusOf = (s: GameState, pid: string, defId: string) => s.players[pid]!.statuses.find((x) => x.defId === defId);
const since = (s: GameState, from: number, type: string) => s.log.slice(from).filter((e) => e.type === type);

function game(n = 2): GameState {
  return createTestGame(n, `effects-${n}`);
}

describe("DAMAGE : pipeline de modificateurs", () => {
  it("dégâts simples", () => {
    const s = game();
    runEffects(s, "p1", [dmg(T.LEFT, 3)]);
    expect(hp(s, "p2")).toBe(17);
  });

  it("Rage ajoute +1 par cumul", () => {
    const s = game();
    addStatus(s, "p1", "rage", 2);
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect(hp(s, "p2")).toBe(17);
  });

  it("Faiblesse peut réduire à 0 : aucun événement DAMAGE", () => {
    const s = game();
    addStatus(s, "p1", "faiblesse");
    const from = s.log.length;
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect(hp(s, "p2")).toBe(20);
    expect(since(s, from, "DAMAGE")).toHaveLength(0);
    expect(since(s, from, "DAMAGE_PREVENTED")[0]!.data.reason).toBe("REDUCED");
  });

  it("Vulnérable : ×1,5 arrondi inférieur", () => {
    const s = game();
    addStatus(s, "p2", "vulnerable");
    runEffects(s, "p1", [dmg(T.LEFT, 3)]);
    expect(hp(s, "p2")).toBe(16); // floor(4,5) = 4
  });

  it("les multiplicateurs de l'émetteur s'appliquent avant ses bonus", () => {
    const s = game();
    addStatus(s, "p1", "surcharge");
    addStatus(s, "p1", "rage", 1);
    runEffects(s, "p1", [dmg(T.LEFT, 2)]);
    expect(hp(s, "p2")).toBe(15); // 2×2 + 1
  });

  it("Surcharge double toutes les cibles d'un effet de zone et n'est consommée qu'une fois", () => {
    const s = game(3);
    addStatus(s, "p1", "surcharge", 2);
    runEffects(s, "p1", [dmg(T.ALL_FOES, 2)]);
    expect(hp(s, "p2")).toBe(16);
    expect(hp(s, "p3")).toBe(16);
    expect(statusOf(s, "p1", "surcharge")?.stacks).toBe(1);
    runEffects(s, "p1", [dmg(T.ALL_FOES, 1)]);
    expect(hp(s, "p2")).toBe(14);
    expect(statusOf(s, "p1", "surcharge")).toBeUndefined();
  });

  it("Carapace réduit sans descendre sous 0", () => {
    const s = game();
    addStatus(s, "p2", "carapace", 3);
    runEffects(s, "p1", [dmg(T.LEFT, 2)]);
    expect(hp(s, "p2")).toBe(20);
  });

  it("Intangible annule les dégâts mais pas la perte de PV directe", () => {
    const s = game();
    addStatus(s, "p2", "intangible");
    addStatus(s, "p1", "rage", 3);
    const from = s.log.length;
    runEffects(s, "p1", [dmg(T.LEFT, 5)]);
    expect(hp(s, "p2")).toBe(20);
    expect(since(s, from, "DAMAGE_PREVENTED")[0]!.data.reason).toBe("IMMUNE");
    runEffects(s, "p1", [loseHp(T.LEFT, 2)]);
    expect(hp(s, "p2")).toBe(18);
  });

  it("l'Égide absorbe après les multiplicateurs de la cible, puis disparaît", () => {
    const s = game();
    addStatus(s, "p2", "vulnerable");
    addStatus(s, "p2", "egide", 2);
    const from = s.log.length;
    runEffects(s, "p1", [dmg(T.LEFT, 2)]);
    expect(hp(s, "p2")).toBe(19); // 2 → 3 (×1,5) → 1 après 2 absorbés
    expect(statusOf(s, "p2", "egide")).toBeUndefined();
    expect(since(s, from, "STATUS_REMOVED")[0]!.data.reason).toBe("DEPLETED");
    expect(since(s, from, "DAMAGE")[0]!.data.absorbed).toBe(2);
  });

  it("les modificateurs filtrés par école ne s'appliquent qu'à cette école", () => {
    const s = game();
    giveRelic(s, "p1", "relic.anneau-de-braises");
    runEffects(s, "p1", [dmg(T.LEFT, 1, "BRAISE")]);
    expect(hp(s, "p2")).toBe(18);
    runEffects(s, "p1", [dmg(T.LEFT, 1, "OMBRE")]);
    expect(hp(s, "p2")).toBe(17);
  });

  it("aucun effet sur un sorcier mort", () => {
    const s = game(3);
    s.players.p2!.alive = false;
    s.players.p2!.hp = 0;
    const from = s.log.length;
    runEffects(s, "p1", [dmg(T.ALL_FOES, 2)]);
    expect(hp(s, "p2")).toBe(0);
    expect(hp(s, "p3")).toBe(18);
    expect(since(s, from, "DAMAGE")).toHaveLength(1);
  });

  it("les dégâts sont crédités au lanceur (statistiques et dernier attaquant)", () => {
    const s = game();
    runEffects(s, "p1", [dmg(T.LEFT, 4)]);
    expect(s.players.p1!.stats.damageDealt).toBe(4);
    expect(s.players.p2!.lastHitBy).toBe("p1");
    runEffects(s, "p1", [dmg(T.SELF, 1)]);
    expect(s.players.p1!.stats.damageDealt).toBe(4); // les dégâts sur soi ne comptent pas
  });
});

describe("HEAL, DRAIN, LOSE_HP", () => {
  it("soin plafonné aux PV max, surplus perdu", () => {
    const s = game();
    s.players.p1!.hp = 18;
    runEffects(s, "p1", [heal(T.SELF, 5)]);
    expect(hp(s, "p1")).toBe(20);
  });

  it("Maudit empêche tout soin", () => {
    const s = game();
    s.players.p1!.hp = 10;
    addStatus(s, "p1", "maudit");
    const from = s.log.length;
    runEffects(s, "p1", [heal(T.SELF, 5)]);
    expect(hp(s, "p1")).toBe(10);
    expect(since(s, from, "HEAL")).toHaveLength(0);
  });

  it("les PV max tiennent compte des reliques", () => {
    const s = game();
    giveRelic(s, "p1", "relic.coeur-de-golem");
    runEffects(s, "p1", [heal(T.SELF, 10)]);
    expect(hp(s, "p1")).toBe(24);
  });

  it("le vol de vie ne rend que les PV réellement retirés", () => {
    const s = game();
    s.players.p1!.hp = 10;
    addStatus(s, "p2", "egide", 2);
    runEffects(s, "p1", [drain(T.LEFT, 3)]);
    expect(hp(s, "p2")).toBe(19);
    expect(hp(s, "p1")).toBe(11);
  });

  it("PV max en baisse (relique volée) : les PV actuels sont ramenés au maximum", () => {
    const s = game();
    giveRelic(s, "p2", "relic.coeur-de-golem");
    s.players.p2!.hp = 24;
    runEffects(s, "p1", [{ op: "STEAL_RELIC", from: T.LEFT }]);
    expect(hp(s, "p2")).toBe(20);
    expect(s.players.p1!.hp).toBe(20);
  });

  it("vol de vie sur une cible intangible : rien", () => {
    const s = game();
    s.players.p1!.hp = 10;
    addStatus(s, "p2", "intangible");
    runEffects(s, "p1", [drain(T.LEFT, 3)]);
    expect(hp(s, "p1")).toBe(10);
  });

  it("la perte de PV ignore l'Égide et ne déclenche pas les réactions aux dégâts", () => {
    const s = game();
    addStatus(s, "p2", "egide", 5);
    addStatus(s, "p2", "epines");
    runEffects(s, "p1", [loseHp(T.LEFT, 2)]);
    expect(hp(s, "p2")).toBe(18);
    expect(hp(s, "p1")).toBe(20);
    expect(s.players.p2!.lastHitBy).toBe("p1");
  });
});

describe("statuts", () => {
  it("cumul plafonné (Venin max 5), durée = maximum", () => {
    const s = game();
    runEffects(s, "p1", [status(T.LEFT, "venin", { stacks: 3, duration: 1 })]);
    runEffects(s, "p1", [status(T.LEFT, "venin", { stacks: 4, duration: 3 })]);
    const v = statusOf(s, "p2", "venin")!;
    expect(v.stacks).toBe(5);
    expect(v.remaining).toBe(3);
  });

  it("REFRESH ne cumule pas, IGNORE n'applique pas deux fois", () => {
    const s = game();
    runEffects(s, "p1", [status(T.LEFT, "faiblesse", { duration: 1 }), status(T.LEFT, "faiblesse", { duration: 2 })]);
    expect(statusOf(s, "p2", "faiblesse")).toMatchObject({ stacks: 1, remaining: 2 });
    runEffects(s, "p1", [status(T.SELF, "vigueur-spectrale"), status(T.SELF, "vigueur-spectrale")]);
    expect(s.players.p1!.statuses.filter((x) => x.defId === "vigueur-spectrale")).toHaveLength(1);
  });

  it("la durée est plafonnée par le garde-fou", () => {
    const s = game();
    runEffects(s, "p1", [{ op: "APPLY_STATUS", target: T.LEFT, status: "rage", duration: 99 }]);
    expect(statusOf(s, "p2", "rage")!.remaining).toBe(5);
  });

  it("Dissipation retire seulement les effets bénéfiques", () => {
    const s = game();
    addStatus(s, "p2", "rage");
    addStatus(s, "p2", "egide", 3);
    addStatus(s, "p2", "venin", 2);
    runEffects(s, "p1", [{ op: "REMOVE_STATUS", target: T.LEFT, polarity: "BUFF" }]);
    expect(s.players.p2!.statuses.map((x) => x.defId)).toEqual(["venin"]);
  });

  it("Clairvoyance et Dé pipé ajoutent des dés, plafonnés à 10", () => {
    const s = game();
    addStatus(s, "p1", "clairvoyance");
    giveRelic(s, "p1", "relic.de-pipe");
    const from = s.log.length;
    runEffects(s, "p1", [{ op: "POWER_ROLL", dice: 2, tiers: [[], [], []] }]);
    expect((since(s, from, "DICE_ROLLED")[0]!.data.rolls as number[]).length).toBe(4);
    runEffects(s, "p1", [{ op: "POWER_ROLL", dice: 30, tiers: [[], [], []] }]);
    expect((since(s, from, "DICE_ROLLED")[1]!.data.rolls as number[]).length).toBe(10);
  });
});

describe("cartes : pioche, défausse, vol, reliques", () => {
  it("DRAW ajoute des cartes en main (détail privé au joueur)", () => {
    const s = game();
    const from = s.log.length;
    runEffects(s, "p1", [{ op: "DRAW", target: T.SELF, count: 2 }]);
    expect(s.players.p1!.hand).toHaveLength(10);
    const ev = since(s, from, "CARDS_DRAWN")[0]!;
    expect(ev.data).toEqual({ count: 2 });
    expect(ev.private!.playerIds).toEqual(["p1"]);
  });

  it("pioche vide : la défausse est remélangée", () => {
    const s = game();
    s.piles.GRIMOIRE.discard.push(...s.piles.GRIMOIRE.draw);
    s.piles.GRIMOIRE.draw = [];
    const from = s.log.length;
    runEffects(s, "p1", [{ op: "DRAW", target: T.SELF, count: 1 }]);
    expect(since(s, from, "DECK_SHUFFLED")).toHaveLength(1);
    expect(s.players.p1!.hand).toHaveLength(9);
  });

  it("pioche et défausse épuisées : on pioche moins, sans erreur", () => {
    const s = game();
    s.piles.GRIMOIRE.draw = [];
    s.piles.GRIMOIRE.discard = [];
    expect(runEffects(s, "p1", [{ op: "DRAW", target: T.SELF, count: 3 }])).toBe("DONE");
    expect(s.players.p1!.hand).toHaveLength(8);
  });

  it("DISCARD aléatoire : jamais plus que la main", () => {
    const s = game();
    s.players.p2!.hand = s.players.p2!.hand.slice(0, 1);
    runEffects(s, "p1", [{ op: "DISCARD", target: T.LEFT, count: 3, mode: "RANDOM" }]);
    expect(s.players.p2!.hand).toHaveLength(0);
  });

  it("DISCARD au choix : suspend et demande au joueur ciblé", () => {
    const s = game();
    expect(runEffects(s, "p1", [{ op: "DISCARD", target: T.LEFT, count: 2, mode: "CHOICE" }])).toBe("SUSPENDED");
    expect(s.pendingChoice).toMatchObject({ playerId: "p2", kind: "CARDS", min: 2, max: 2 });
    expect(s.pendingChoice!.options).toHaveLength(8);
  });

  it("STEAL_CARD : la carte change de main, le détail n'est connu que des deux joueurs", () => {
    const s = game(3);
    const from = s.log.length;
    runEffects(s, "p1", [{ op: "STEAL_CARD", from: T.LEFT, count: 1 }]);
    expect(s.players.p1!.hand).toHaveLength(9);
    expect(s.players.p2!.hand).toHaveLength(7);
    const ev = since(s, from, "CARD_STOLEN")[0]!;
    expect(ev.private!.playerIds.sort()).toEqual(["p1", "p2"]);
    expect(ev.data).toEqual({ count: 1 });
  });

  it("GAIN_RELIC puis STEAL_RELIC", () => {
    const s = game();
    runEffects(s, "p2", [{ op: "GAIN_RELIC", target: T.SELF, count: 1 }]);
    expect(s.players.p2!.relics).toHaveLength(1);
    const relic = s.players.p2!.relics[0];
    runEffects(s, "p1", [{ op: "STEAL_RELIC", from: T.LEFT }]);
    expect(s.players.p1!.relics).toEqual([relic]);
    expect(s.players.p2!.relics).toEqual([]);
  });
});

describe("invocations", () => {
  it("une invocation entre en jeu et peut être blessée et détruite", () => {
    const s = game();
    runEffects(s, "p2", [{ op: "SUMMON", summon: "golem-de-mousse" }]);
    const [golem] = Object.values(s.summons);
    expect(golem).toMatchObject({ controllerId: "p2", hp: 6 });
    runEffects(s, "p1", [dmg(T.ALL_FOE_SUMMONS, 6)]);
    expect(Object.keys(s.summons)).toHaveLength(0);
    expect(s.log.some((e) => e.type === "SUMMON_DIED" && e.data.reason === "KILLED")).toBe(true);
  });

  it("au plus 3 invocations par sorcier : la plus ancienne disparaît", () => {
    const s = game();
    const summon: EffectNode = { op: "SUMMON", summon: "feu-follet" };
    runEffects(s, "p1", [summon, summon, summon]);
    const first = Object.values(s.summons).sort((a, b) => a.enteredAt - b.enteredAt)[0]!.id;
    runEffects(s, "p1", [summon]);
    expect(Object.keys(s.summons)).toHaveLength(3);
    expect(s.summons[first]).toBeUndefined();
  });

  it("un sorcier mort n'invoque rien", () => {
    const s = game(3);
    s.players.p1!.alive = false;
    runEffects(s, "p1", [{ op: "SUMMON", summon: "feu-follet" }]);
    expect(Object.keys(s.summons)).toHaveLength(0);
  });
});

describe("combinateurs", () => {
  it("POWER_ROLL : le palier correspond au total (1–4 / 5–9 / 10+)", () => {
    for (let i = 0; i < 40; i++) {
      const s = createTestGame(2, `roll-${i}`);
      const from = s.log.length;
      runEffects(s, "p1", [{ op: "POWER_ROLL", dice: 1 + (i % 3), tiers: [[dmg(T.LEFT, 1)], [dmg(T.LEFT, 2)], [dmg(T.LEFT, 3)]] }]);
      const roll = since(s, from, "DICE_ROLLED")[0]!;
      const total = roll.data.total as number;
      const tier = total >= 10 ? 3 : total >= 5 ? 2 : 1;
      expect(roll.data.tier).toBe(tier);
      expect(20 - hp(s, "p2")).toBe(tier);
      for (const r of roll.data.rolls as number[]) expect(r).toBeGreaterThanOrEqual(1), expect(r).toBeLessThanOrEqual(6);
    }
  });

  it("IF choisit la branche selon la condition", () => {
    const s = game();
    s.players.p2!.hp = 4;
    runEffects(s, "p1", [
      { op: "IF", cond: { c: "HP_AT_MOST", who: T.LEFT, value: 5 }, then: [dmg(T.LEFT, 1)], else: [heal(T.LEFT, 10)] },
    ]);
    expect(hp(s, "p2")).toBe(3);
    runEffects(s, "p1", [{ op: "IF", cond: { c: "NOT", of: { c: "HAS_STATUS", who: T.LEFT, status: "rage" } }, then: [dmg(T.LEFT, 1)] }]);
    expect(hp(s, "p2")).toBe(2);
  });

  it("FOR_EACH lie chaque cible à IT, dans l'ordre des sièges", () => {
    const s = game(4);
    const from = s.log.length;
    runEffects(s, "p1", [{ op: "FOR_EACH", target: T.ALL_FOES, effects: [dmg(T.IT, 1)] }]);
    expect(since(s, from, "DAMAGE").map((e) => e.targetId)).toEqual(["p2", "p3", "p4"]);
  });

  it("REPEAT répète, borné à 10", () => {
    const s = game();
    runEffects(s, "p1", [{ op: "REPEAT", times: 3, effects: [dmg(T.LEFT, 1)] }]);
    expect(hp(s, "p2")).toBe(17);
    runEffects(s, "p1", [{ op: "REPEAT", times: 50, effects: [dmg(T.LEFT, 1)] }]);
    expect(hp(s, "p2")).toBe(7);
  });

  it("ECHO : rejoue tant que la condition est vraie, au plus `max` fois", () => {
    const always = game();
    runEffects(always, "p1", [{ op: "ECHO", while: { c: "CHANCE", percent: 100 }, max: 4, effects: [dmg(T.LEFT, 1)] }]);
    expect(hp(always, "p2")).toBe(16);
    const never = game();
    runEffects(never, "p1", [{ op: "ECHO", while: { c: "CHANCE", percent: 0 }, max: 4, effects: [dmg(T.LEFT, 1)] }]);
    expect(hp(never, "p2")).toBe(19);
  });

  it("RANDOM respecte les poids (poids nul jamais tiré)", () => {
    for (let i = 0; i < 20; i++) {
      const s = createTestGame(2, `rand-${i}`);
      runEffects(s, "p1", [{ op: "RANDOM", branches: [{ weight: 0, effects: [dmg(T.LEFT, 5)] }, { weight: 1, effects: [dmg(T.LEFT, 1)] }] }]);
      expect(hp(s, "p2")).toBe(19);
    }
  });

  it("CHOOSE_OPTION suspend la résolution", () => {
    const s = game();
    const r = runEffects(s, "p1", [
      { op: "CHOOSE_OPTION", prompt: "?", options: [{ label: "A", effects: [] }, { label: "B", effects: [] }] },
    ]);
    expect(r).toBe("SUSPENDED");
    expect(s.pendingChoice!.options.map((o) => o.label)).toEqual(["A", "B"]);
    expect(s.queue[0]!.node.op).toBe("CHOOSE_OPTION");
  });

  it("DELAY s'exécute une seule fois au déclencheur suivant", () => {
    const s = game();
    runEffects(s, "p1", [{ op: "DELAY", on: "ON_SPELL_CAST", effects: [dmg(T.LEFT, 2)] }]);
    expect(s.delayed).toHaveLength(1);
    expect(hp(s, "p2")).toBe(20);
    // Simule un sort lancé par p1.
    const ev = { seq: 999, round: 1, turn: 1, type: "SPELL_CAST" as const, depth: 0, sourceId: "p1", data: {} };
    s.queue.push(...collectTriggers(s, [ev], "p1", 1));
    runEffects(s, "p1", []);
    expect(hp(s, "p2")).toBe(18);
    expect(s.delayed).toHaveLength(0);
  });
});

describe("pioche contrôlée", () => {
  it("stackGrimoire place des cartes connues sur le dessus", () => {
    const s = game();
    stackGrimoire(s, ["rune.seve.pousse-vivace"]);
    runEffects(s, "p1", [{ op: "DRAW", target: T.SELF, count: 1 }]);
    expect(s.cards[s.players.p1!.hand.at(-1)!]!.defId).toBe("rune.seve.pousse-vivace");
  });
});
