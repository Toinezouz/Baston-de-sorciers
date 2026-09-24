/**
 * Extension « Échos du Grimoire » : nouvelles primitives et synergies entre cartes.
 */
import { describe, expect, it } from "vitest";
import { T, dmg } from "../src/cards/dsl";
import type { GameState, StatusInstance } from "../src/types";
import { castSpell, createTestGame, giveRelic, hp, runEffects } from "./helpers";

function addStatus(s: GameState, pid: string, defId: string, stacks = 1, remaining: number | "PERMANENT" = "PERMANENT"): void {
  const st: StatusInstance = { id: `t-${defId}-${pid}-${s.counters.status++}`, defId, sourceId: pid, stacks, remaining, appliedAt: 0 };
  s.players[pid]!.statuses.push(st);
}
const statusOf = (s: GameState, pid: string, id: string) => s.players[pid]!.statuses.find((x) => x.defId === id);
const PRISME = { AMORCE: "rune.ether.prisme" };
const idle = (s: GameState, ...pids: string[]) => pids.reduce((st, pid) => castSpell(st, pid, PRISME), s);

describe("synergies Braise", () => {
  it("Embrasement encaisse les Brûlures : 2 dégâts par cumul, puis la Brûlure s'éteint", () => {
    let s = createTestGame(3);
    addStatus(s, "p2", "brulure", 3);
    addStatus(s, "p3", "brulure", 1);
    s = castSpell(s, "p1", { TORSION: "rune.braise.embrasement" });
    s = idle(s, "p2", "p3");
    expect(hp(s, "p2")).toBe(14);
    expect(hp(s, "p3")).toBe(18);
    expect(statusOf(s, "p2", "brulure")).toBeUndefined();
  });

  it("Braises dormantes + Forge vive : la Rage du lanceur renforce ses Brûlures", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { AMORCE: "rune.braise.braises-dormantes", TORSION: "rune.braise.forge-vive" });
    s = idle(s, "p2", "p3");
    expect(statusOf(s, "p1", "rage")?.stacks).toBe(2);
    // Fin de tour : la Brûlure agit au nom de p1, dont la Rage (+2) s'applique (règle D18) : 1 + 2 = 3.
    expect(hp(s, "p2")).toBe(17);
  });
});

describe("synergies Ombre", () => {
  it("Peste noire aggrave un Venin existant, Sentence du venin l'exécute", () => {
    let s = createTestGame(3);
    addStatus(s, "p2", "venin", 2, 3);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.peste-noire" });
    s = idle(s, "p2", "p3");
    // Fin de tour : p2 (4 Venin) subit 4, p3 (1 Venin) subit 1.
    expect(hp(s, "p2")).toBe(16);
    expect(hp(s, "p3")).toBe(19);
    expect(statusOf(s, "p2", "venin")?.stacks).toBe(4);
  });

  it("Transfert des maux : mes effets néfastes passent sur la cible", () => {
    const s = createTestGame(2);
    addStatus(s, "p1", "venin", 3);
    addStatus(s, "p1", "faiblesse");
    addStatus(s, "p1", "rage", 1);
    runEffects(s, "p1", [{ op: "TRANSFER_STATUS", from: T.SELF, to: T.CHOSEN_FOE, polarity: "DEBUFF" }]);
    expect(s.players.p1!.statuses.map((x) => x.defId)).toEqual(["rage"]);
    expect(statusOf(s, "p2", "venin")?.stacks).toBe(3);
    expect(statusOf(s, "p2", "faiblesse")).toBeDefined();
  });

  it("Marque : +1 dégât par cumul sur CHAQUE coup (synergie avec les frappes multiples)", () => {
    const s = createTestGame(2);
    addStatus(s, "p2", "marque", 2);
    runEffects(s, "p1", [{ op: "REPEAT", times: 3, effects: [dmg(T.LEFT, 1)] }]);
    expect(hp(s, "p2")).toBe(11);
  });
});

describe("synergies Sève", () => {
  it("Symbiose et Charge du bosquet profitent des invocations", () => {
    let s = createTestGame(2);
    runEffects(s, "p1", [{ op: "SUMMON", summon: "golem-de-mousse" }, { op: "SUMMON", summon: "salamandre" }]);
    s.players.p1!.hp = 10;
    s = castSpell(s, "p1", { TORSION: "rune.seve.symbiose", FRAPPE: "rune.seve.charge-du-bosquet" });
    s = idle(s, "p2");
    expect(hp(s, "p1")).toBe(15); // 1 + 2 × 2 invocations
    const fromSummons = s.log.filter((e) => e.type === "DAMAGE" && e.targetId === "p2" && e.turn === 1);
    expect(fromSummons.length).toBeGreaterThanOrEqual(3); // 1 frappe + 2 charges
  });

  it("Lien vital soigne à chaque coup porté (3 fois par tour au plus)", () => {
    const s = createTestGame(2);
    s.players.p1!.hp = 10;
    addStatus(s, "p1", "lien-vital");
    runEffects(s, "p1", [{ op: "REPEAT", times: 5, effects: [dmg(T.LEFT, 1)] }]);
    expect(hp(s, "p1")).toBe(13);
  });
});

describe("synergies Éther", () => {
  it("Hâte et Gel modifient l'ordre de résolution à nombre de runes égal", () => {
    let s = createTestGame(2);
    addStatus(s, "p1", "gel");
    addStatus(s, "p2", "hate");
    s = castSpell(s, "p1", { FRAPPE: "rune.ether.comete" }); // initiative 18 − 8 = 10
    s = castSpell(s, "p2", { FRAPPE: "rune.chimere.farce-cruelle" }); // initiative 1 + 8 = 9
    const order = s.log.find((e) => e.type === "INITIATIVE_SET")!.data.order as { playerId: string; initiative: number }[];
    expect(order.map((o) => o.initiative)).toEqual([10, 9]);
    // Gel : −1 dé (Comète seule : 1 + 2 Concentration − 1 = 2 dés).
    expect((s.log.find((e) => e.type === "DICE_ROLLED" && e.sourceId === "p1")!.data.rolls as number[]).length).toBe(2);
  });

  it("Comète : +2 dégâts si le sort est le premier résolu", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { FRAPPE: "rune.ether.comete" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme", TORSION: "rune.ether.dissipation" });
    const dmgs = s.log.filter((e) => e.type === "DAMAGE" && e.sourceId === "p1" && e.targetId === "p2").map((e) => e.amount);
    expect(dmgs).toHaveLength(2);
    expect(dmgs[1]).toBe(2);
  });

  it("Inspiration augmente la main complétée en fin de tour ; Savoir interdit tape selon la main", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { AMORCE: "rune.ether.meditation" });
    s = idle(s, "p2");
    expect(s.players.p1!.hand).toHaveLength(9);
    const before = hp(s, "p2");
    s = castSpell(s, "p1", { FRAPPE: "rune.ether.savoir-interdit" });
    s = idle(s, "p2");
    const dealt = s.log.filter((e) => e.type === "DAMAGE" && e.sourceId === "p1" && e.turn === 2).reduce((a, e) => a + (e.amount ?? 0), 0);
    expect(dealt).toBeGreaterThanOrEqual(1 + 4); // palier ≥ 1, main de 8 → +4
    expect(before - hp(s, "p2")).toBe(dealt);
  });

  it("Sentinelle de cristal : Clairvoyance au début de chaque tour", () => {
    let s = createTestGame(2);
    runEffects(s, "p1", [{ op: "SUMMON", summon: "sentinelle-de-cristal" }]);
    s = idle(s, "p1", "p2");
    expect(statusOf(s, "p1", "clairvoyance")).toBeDefined();
  });
});

describe("synergies Chimère", () => {
  it("Tour de passe-passe vole les bonus d'un adversaire", () => {
    const s = createTestGame(2);
    addStatus(s, "p2", "egide", 4);
    addStatus(s, "p2", "rage", 2);
    addStatus(s, "p2", "venin", 1);
    runEffects(s, "p1", [{ op: "TRANSFER_STATUS", from: T.CHOSEN_FOE, to: T.SELF, polarity: "BUFF" }]);
    expect(s.players.p2!.statuses.map((x) => x.defId)).toEqual(["venin"]);
    expect(statusOf(s, "p1", "egide")?.stacks).toBe(4);
    expect(statusOf(s, "p1", "rage")?.stacks).toBe(2);
  });

  it("Grand chapardage : une seule cible choisie pour les dégâts ET le vol", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { FRAPPE: "rune.chimere.grand-chapardage" });
    s = idle(s, "p2", "p3");
    expect(s.pendingChoice?.playerId).toBe("p1");
  });
});

describe("reliques de l'extension", () => {
  it("Cloche funèbre : une mort blesse tous les adversaires du porteur", () => {
    const s = createTestGame(4);
    giveRelic(s, "p4", "relic.cloche-funebre");
    s.players.p2!.hp = 1;
    runEffects(s, "p1", [dmg(T.LEFT, 1)]);
    expect([hp(s, "p1"), hp(s, "p3")]).toEqual([19, 19]);
  });

  it("Lentille astrale : pioche sur un jet de 10 ou plus", () => {
    let draws = 0;
    for (let i = 0; i < 30; i++) {
      const s = createTestGame(2, `lentille-${i}`);
      giveRelic(s, "p1", "relic.lentille-astrale");
      runEffects(s, "p1", [{ op: "POWER_ROLL", dice: 3, tiers: [[], [], []] }]);
      const total = s.log.find((e) => e.type === "DICE_ROLLED")!.data.total as number;
      expect(s.players.p1!.hand.length).toBe(total >= 10 ? 9 : 8);
      if (total >= 10) draws++;
    }
    expect(draws).toBeGreaterThan(0);
  });

  it("Œuf de salamandre et Graine éternelle invoquent au début de la manche", () => {
    let s = createTestGame(2);
    giveRelic(s, "p1", "relic.oeuf-de-salamandre");
    giveRelic(s, "p2", "relic.graine-eternelle");
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = idle(s, "p2");
    expect(s.round).toBe(2);
    const defs = Object.values(s.summons).map((x) => `${x.controllerId}:${x.defId}`).sort();
    expect(defs).toEqual(["p1:salamandre", "p2:golem-de-mousse"]); // la graine est éternelle
  });
});
