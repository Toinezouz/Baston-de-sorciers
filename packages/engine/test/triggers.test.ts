/**
 * Ciblage, déclencheurs, ordre des chaînes d'effets et garde-fous.
 */
import { describe, expect, it } from "vitest";
import { T, dmg, heal } from "../src/cards/dsl";
import { registerStatus } from "../src/cards/registry";
import { drainQueue, enqueue, makeTasks } from "../src/resolution/queue";
import type { GameState, StatusInstance } from "../src/types";
import { castSpell, createTestGame, giveRelic, hp, runEffects } from "./helpers";

function addStatus(s: GameState, pid: string, defId: string, stacks = 1): void {
  const st: StatusInstance = { id: `t-${defId}-${pid}-${s.counters.status++}`, defId, sourceId: pid, stacks, remaining: "PERMANENT", appliedAt: 0 };
  s.players[pid]!.statuses.push(st);
}
const since = (s: GameState, from: number, type: string) => s.log.slice(from).filter((e) => e.type === type);
const PRISME = { AMORCE: "rune.ether.prisme" };

registerStatus({
  id: "test-dernier-souffle",
  name: "Dernier souffle (test)",
  text: "À sa mort, inflige 3 dégâts à son meurtrier.",
  polarity: "BUFF",
  stacking: "IGNORE",
  maxStacks: 1,
  defaultDuration: "PERMANENT",
  passives: [{ trigger: { on: "ON_DEATH", effects: [dmg(T.EVENT_SOURCE, 3)] } }],
});

registerStatus({
  id: "test-auto-blessure",
  name: "Auto-blessure (test)",
  text: "Quand il est blessé, il se blesse à nouveau (boucle sur soi).",
  polarity: "DEBUFF",
  stacking: "IGNORE",
  maxStacks: 1,
  defaultDuration: "PERMANENT",
  passives: [{ trigger: { on: "ON_DAMAGE_RECEIVED", effects: [dmg(T.HOLDER, 1)] } }],
});

describe("ciblage", () => {
  it("gauche / droite sautent les sorciers morts", () => {
    const s = createTestGame(4);
    runEffects(s, "p1", [dmg(T.LEFT, 1), dmg(T.RIGHT, 2)]);
    expect([hp(s, "p2"), hp(s, "p4")]).toEqual([19, 18]);
    s.players.p2!.alive = false;
    s.players.p4!.alive = false;
    runEffects(s, "p1", [dmg(T.LEFT, 1), dmg(T.RIGHT, 1)]);
    expect(hp(s, "p3")).toBe(18);
  });

  it("le plus robuste / le plus affaibli ; égalité → premier siège à gauche", () => {
    const s = createTestGame(4);
    s.players.p2!.hp = 10;
    s.players.p3!.hp = 15;
    s.players.p4!.hp = 15;
    runEffects(s, "p1", [dmg(T.STRONGEST_FOE, 1), dmg(T.WEAKEST_FOE, 1)]);
    expect([hp(s, "p2"), hp(s, "p3"), hp(s, "p4")]).toEqual([9, 14, 15]);
    const tie = createTestGame(4);
    runEffects(tie, "p3", [dmg(T.STRONGEST_FOE, 1)]);
    expect(hp(tie, "p4")).toBe(19); // à gauche de p3
  });

  it("adversaire aléatoire : jamais soi-même ni un mort", () => {
    for (let i = 0; i < 30; i++) {
      const s = createTestGame(4, `rnd-${i}`);
      s.players.p3!.alive = false;
      const from = s.log.length;
      runEffects(s, "p1", [dmg(T.RANDOM_FOE, 1)]);
      const target = since(s, from, "DAMAGE")[0]!.targetId;
      expect(["p2", "p4"]).toContain(target);
    }
  });

  it("tous les sorciers inclut le lanceur, tous les adversaires non", () => {
    const s = createTestGame(3);
    runEffects(s, "p1", [dmg(T.ALL_PLAYERS, 1), dmg(T.ALL_FOES, 1)]);
    expect([hp(s, "p1"), hp(s, "p2"), hp(s, "p3")]).toEqual([19, 18, 18]);
  });

  it("cible au choix avec un seul candidat : aucun choix demandé", () => {
    const s = createTestGame(2);
    expect(runEffects(s, "p1", [dmg(T.CHOSEN_FOE, 2)])).toBe("DONE");
    expect(hp(s, "p2")).toBe(18);
  });

  it("cible au choix incluant les invocations adverses", () => {
    const s = createTestGame(2);
    runEffects(s, "p2", [{ op: "SUMMON", summon: "golem-de-mousse" }]);
    expect(runEffects(s, "p1", [dmg(T.CHOSEN_FOE_OR_SUMMON, 2)])).toBe("SUSPENDED");
    const ids = s.pendingChoice!.options.map((o) => o.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain("p2");
  });

  it("aucun adversaire vivant : l'effet ne fait rien, sans erreur", () => {
    const s = createTestGame(2);
    s.players.p2!.alive = false;
    expect(runEffects(s, "p1", [dmg(T.ALL_FOES, 3), dmg(T.STRONGEST_FOE, 1), dmg(T.RANDOM_FOE, 1), dmg(T.LEFT, 1)])).toBe("DONE");
  });

  it("meurtrier : vise le sorcier ayant éliminé le lanceur", () => {
    const s = createTestGame(3);
    s.players.p1!.killedBy = "p3";
    runEffects(s, "p1", [dmg(T.MY_KILLER, 3)]);
    expect(hp(s, "p3")).toBe(17);
  });
});

describe("déclencheurs", () => {
  it("chaîne : un déclencheur se résout juste après l'effet qui l'a provoqué", () => {
    const s = createTestGame(2);
    addStatus(s, "p2", "epines");
    const from = s.log.length;
    runEffects(s, "p1", [dmg(T.LEFT, 1), dmg(T.LEFT, 1)]);
    expect(since(s, from, "DAMAGE").map((e) => e.targetId)).toEqual(["p2", "p1", "p2", "p1"]);
    const reflected = since(s, from, "DAMAGE")[1]!;
    expect(reflected.tags).toContain("reflected");
    expect(reflected.depth).toBe(1);
  });

  it("ON_KILL : le Crâne bavard soigne son porteur quand il élimine", () => {
    const s = createTestGame(3);
    giveRelic(s, "p1", "relic.crane-bavard");
    s.players.p1!.hp = 10;
    s.players.p2!.hp = 1;
    runEffects(s, "p1", [dmg(T.LEFT, 2)]);
    expect(s.players.p2!.alive).toBe(false);
    expect(hp(s, "p1")).toBe(13);
    expect(s.players.p1!.stats.kills).toBe(1);
  });

  it("ON_ANY_DEATH : la Lanterne réagit à la mort d'un autre, pas à la sienne", () => {
    const s = createTestGame(4);
    giveRelic(s, "p3", "relic.lanterne-des-morts");
    s.players.p2!.hp = 1;
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect(s.players.p3!.statuses.find((x) => x.defId === "egide")?.stacks).toBe(2);
    s.players.p3!.hp = 1;
    runEffects(s, "p1", [dmg({ sel: "WEAKEST_FOE" }, 5)]);
    expect(s.players.p3!.alive).toBe(false);
  });

  it("invocation : le Corbeau soigne et fait piocher son maître à chaque mort", () => {
    const s = createTestGame(3);
    runEffects(s, "p3", [{ op: "SUMMON", summon: "corbeau-charognard" }]);
    s.players.p3!.hp = 10;
    s.players.p2!.hp = 1;
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect(hp(s, "p3")).toBe(12);
    expect(s.players.p3!.hand).toHaveLength(9);
  });

  it("ON_DEATH : un effet de mort se déclenche malgré la mort du porteur", () => {
    const s = createTestGame(3);
    addStatus(s, "p2", "test-dernier-souffle");
    s.players.p2!.hp = 1;
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect(s.players.p2!.alive).toBe(false);
    expect(hp(s, "p1")).toBe(17);
  });

  it("un porteur tué ne renvoie pas les dégâts (Épines)", () => {
    const s = createTestGame(3);
    addStatus(s, "p2", "epines");
    s.players.p2!.hp = 1;
    runEffects(s, "p1", [dmg(T.LEFT, 3)]);
    expect(hp(s, "p1")).toBe(20);
  });

  it("la mort fait perdre les reliques non éternelles et dissipe les invocations", () => {
    const s = createTestGame(3);
    giveRelic(s, "p2", "relic.de-pipe");
    const eternal = giveRelic(s, "p2", "relic.coeur-de-golem");
    runEffects(s, "p2", [{ op: "SUMMON", summon: "feu-follet" }]);
    s.players.p2!.hp = 1;
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect(s.players.p2!.relics).toEqual([eternal]);
    expect(Object.keys(s.summons)).toHaveLength(0);
    expect(s.players.p2!.statuses).toEqual([]);
  });

  it("maxPerTurn : le Miroir fêlé ne renvoie qu'une fois par tour", () => {
    const s = createTestGame(2);
    giveRelic(s, "p2", "relic.miroir-fele");
    runEffects(s, "p1", [dmg(T.LEFT, 1), dmg(T.LEFT, 1), dmg(T.LEFT, 1)]);
    expect(hp(s, "p1")).toBe(18);
  });

  it("ordre déterministe : les déclencheurs suivent les sièges depuis le lanceur", () => {
    const s = createTestGame(4);
    giveRelic(s, "p4", "relic.lanterne-des-morts");
    giveRelic(s, "p2", "relic.lanterne-des-morts");
    s.players.p3!.hp = 1;
    const from = s.log.length;
    runEffects(s, "p1", [dmg(T.WEAKEST_FOE, 1)]);
    expect(since(s, from, "TRIGGER_FIRED").map((e) => e.targetId)).toEqual(["p2", "p4"]);
  });

  it("un déclencheur de relique agit en fin de tour (Gourde de sève)", () => {
    let s = createTestGame(2);
    giveRelic(s, "p1", "relic.gourde-de-seve");
    s.players.p1!.hp = 15;
    s = castSpell(s, "p1", PRISME);
    s = castSpell(s, "p2", PRISME);
    expect(hp(s, "p1")).toBe(16);
  });

  it("une invocation agit en fin de tour pour son maître (Golem de mousse)", () => {
    let s = createTestGame(2);
    runEffects(s, "p1", [{ op: "SUMMON", summon: "golem-de-mousse" }]);
    s = castSpell(s, "p1", PRISME);
    s = castSpell(s, "p2", PRISME);
    expect(s.players.p1!.statuses.find((x) => x.defId === "egide")?.stacks).toBe(1);
  });

  it("deux instances d’un même statut se déclenchent indépendamment", () => {
    let s = createTestGame(2);
    addStatus(s, "p2", "epines");
    addStatus(s, "p2", "epines"); // deux instances indépendantes
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", PRISME);
    expect(hp(s, "p1")).toBe(18);
  });
});

describe("garde-fous anti-boucle", () => {
  it("boucle sur soi-même : coupée après 3 activations", () => {
    const s = createTestGame(2);
    addStatus(s, "p2", "test-auto-blessure");
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect(hp(s, "p2")).toBe(16); // 1 + 3 auto-blessures
    expect(since(s, 0, "TRIGGER_SUPPRESSED")).toHaveLength(1);
  });

  it("profondeur maximale : une tâche trop profonde est ignorée", () => {
    const s = createTestGame(2);
    enqueue(s, makeTasks(s, [dmg(T.LEFT, 5)], { sourceId: "p1", controllerId: "p1" }, 17));
    expect(drainQueue(s)).toBe("DONE");
    expect(hp(s, "p2")).toBe(20);
    expect(s.log.at(-1)!.data.reason).toBe("MAX_DEPTH");
  });

  it("budget de tâches : une explosion combinatoire est purgée proprement", () => {
    const s = createTestGame(2);
    const nest = (depth: number): any =>
      depth === 0 ? heal(T.SELF, 0) : { op: "REPEAT", times: 10, effects: [nest(depth - 1)] };
    expect(runEffects(s, "p1", [nest(4)])).toBe("DONE");
    expect(s.queue).toHaveLength(0);
    expect(s.log.some((e) => e.type === "ENGINE_GUARD" && e.data.reason === "TASK_BUDGET")).toBe(true);
  });
});
