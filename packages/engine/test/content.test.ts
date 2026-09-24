/**
 * Validation du contenu, conditions et montants dynamiques, lobby, abandon pendant un choix.
 */
import { describe, expect, it } from "vitest";
import { T, dmg, heal } from "../src/cards/dsl";
import { registerCard, registerStatus, registerSummon } from "../src/cards/registry";
import { dispatch } from "../src/dispatch";
import type { Amount, CardDefinition, Condition, GameState } from "../src/types";
import { castSpell, createLobby, createTestGame, giveRelic, hp, must, runEffects } from "./helpers";

const base = (id: string, extra: Partial<CardDefinition>): CardDefinition => ({
  id: `invalid.${id}`,
  kind: "RUNE",
  slot: "AMORCE",
  schools: ["ETHER"],
  copies: 0,
  name: "X",
  text: "X",
  effects: [],
  ...extra,
});

describe("validation du contenu", () => {
  it.each<[string, Partial<CardDefinition>]>([
    ["no-slot", { slot: undefined }],
    ["no-school", { schools: [] }],
    ["frappe-no-init", { slot: "FRAPPE" }],
    ["empty-text", { text: " " }],
    ["unknown-status", { effects: [{ op: "APPLY_STATUS", target: T.SELF, status: "nope" }] }],
    ["unknown-summon", { effects: [{ op: "SUMMON", summon: "nope" }] }],
    ["echo-unbounded", { effects: [{ op: "ECHO", while: { c: "CHANCE", percent: 50 }, max: 50, effects: [] }] }],
    ["choice-in-condition", { effects: [{ op: "IF", cond: { c: "HP_AT_MOST", who: T.CHOSEN_FOE, value: 3 }, then: [] }] }],
    ["bad-duration", { effects: [{ op: "APPLY_STATUS", target: T.SELF, status: "rage", duration: 42 }] }],
    ["relic-without-passive", { kind: "RELIC", slot: undefined }],
    ["one-option", { effects: [{ op: "CHOOSE_OPTION", prompt: "?", options: [{ label: "A", effects: [] }] }] }],
  ])("refuse une carte invalide (%s)", (id, extra) => {
    expect(() => registerCard(base(id, extra))).toThrow(/Invalid content/);
  });

  it("refuse les doublons et les statuts / invocations invalides", () => {
    expect(() => registerCard({ ...base("dup", {}), id: "rune.ether.prisme" })).toThrow(/Duplicate/);
    expect(() =>
      registerStatus({ id: "bad-status", name: "x", text: "x", polarity: "BUFF", stacking: "STACK", maxStacks: 0, defaultDuration: 1, passives: [{}] }),
    ).toThrow();
    expect(() => registerSummon({ id: "bad-summon", name: "x", text: "x", maxHp: 0, passives: [] })).toThrow();
  });
});

describe("conditions et montants dynamiques", () => {
  const cond = (s: GameState, c: Condition, ctx: object = {}) => {
    const before = hp(s, "p2");
    runEffects(s, "p1", [{ op: "IF", cond: c, then: [dmg(T.LEFT, 1)] }], ctx);
    return hp(s, "p2") < before;
  };

  it("AND / OR / NOT, IS_DEAD, HAS_RELIC, ROLL_AT_LEAST, SPELL_SIZE", () => {
    const s = createTestGame(3);
    expect(cond(s, { c: "AND", of: [{ c: "CHANCE", percent: 100 }, { c: "CHANCE", percent: 0 }] })).toBe(false);
    expect(cond(s, { c: "OR", of: [{ c: "CHANCE", percent: 0 }, { c: "CHANCE", percent: 100 }] })).toBe(true);
    expect(cond(s, { c: "IS_DEAD", who: T.EVENT_TARGET }, { event: { type: "DAMAGE", targetId: "p3" } })).toBe(false);
    s.players.p3!.alive = false;
    expect(cond(s, { c: "IS_DEAD", who: T.EVENT_TARGET }, { event: { type: "DAMAGE", targetId: "p3" } })).toBe(true);
    expect(cond(s, { c: "HAS_RELIC", who: T.LEFT })).toBe(false);
    giveRelic(s, "p2", "relic.de-pipe");
    expect(cond(s, { c: "HAS_RELIC", who: T.LEFT })).toBe(true);
    expect(cond(s, { c: "ROLL_AT_LEAST", value: 7 }, { roll: 8 })).toBe(true);
    expect(cond(s, { c: "ROLL_AT_LEAST", value: 7 }, { roll: 6 })).toBe(false);
    expect(cond(s, { c: "SPELL_SIZE_AT_LEAST", value: 1 })).toBe(false); // hors sort
  });

  it("montants : PV manquants, montant de l'événement, total et palier du jet, bornes", () => {
    const s = createTestGame(2);
    s.players.p1!.hp = 14;
    const run = (amount: Amount, ctx: object = {}) => {
      const before = hp(s, "p2");
      runEffects(s, "p1", [dmg(T.LEFT, amount)], ctx);
      return before - hp(s, "p2");
    };
    expect(run({ from: "MISSING_HP" })).toBe(6);
    expect(run({ from: "EVENT_AMOUNT" }, { event: { type: "DAMAGE", amount: 3 } })).toBe(3);
    expect(run({ from: "ROLL_TOTAL", mul: 0.5 }, { roll: 9 })).toBe(4);
    expect(run({ from: "TIER", add: 1 }, { tier: 2 })).toBe(3);
    expect(run({ from: "ROLL_TOTAL", min: 2, max: 3 }, { roll: 12 })).toBe(3);
    expect(run({ from: "DEAD_PLAYERS", min: 1 })).toBe(1);
  });

  it("Deuil : +2 PV par sorcier mort cette manche", () => {
    let s = createTestGame(4);
    s.players.p3!.diedThisRound = true;
    s.players.p3!.alive = false;
    s.players.p1!.hp = 10;
    s = castSpell(s, "p1", { TORSION: "rune.ombre.deuil" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p4", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p1")).toBe(13);
  });
});

describe("lobby et abandon", () => {
  it("départ de l'hôte : l'hôte suivant est désigné, les sièges sont renumérotés", () => {
    let s = createLobby(3);
    s = must(s, { playerId: "p1", action: { type: "LEAVE" } });
    expect(s.hostId).toBe("p2");
    expect(s.seatOrder).toEqual(["p2", "p3"]);
    expect(s.players.p3!.seat).toBe(1);
    s = must(s, { system: { type: "ABANDON", playerId: "p3" } });
    expect(s.seatOrder).toEqual(["p2"]);
    const r = dispatch(s, { playerId: "p2", action: { type: "START_GAME" } });
    expect(r.ok || r.reason).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("déjà inscrit : refusé", () => {
    const s = createLobby(2);
    const r = dispatch(s, { system: { type: "JOIN", playerId: "p1", name: "Bis" } });
    expect(r.ok || r.reason).toBe("ALREADY_JOINED");
  });

  it("abandon du joueur qui doit choisir : choix résolu automatiquement, la partie continue", () => {
    let s = createTestGame(4);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.nuee-de-mites" });
    for (const pid of ["p2", "p3", "p4"]) s = castSpell(s, pid, { AMORCE: "rune.ether.prisme" });
    expect(s.pendingChoice?.playerId).toBe("p1");
    s = must(s, { playerId: "p1", action: { type: "LEAVE" } });
    expect(s.phase).toBe("PLANNING");
    expect(s.players.p1!.connection).toBe("ABANDONED");
    expect(s.log.some((e) => e.type === "CHOICE_MADE" && e.data.auto)).toBe(true);
  });

  it("un sorcier qui a abandonné ne bloque jamais sur un choix futur", () => {
    const s = createTestGame(3);
    s.players.p1!.connection = "ABANDONED";
    expect(runEffects(s, "p1", [heal(T.SELF, 0), dmg(T.CHOSEN_FOE, 2)])).toBe("DONE");
    expect(hp(s, "p2") + hp(s, "p3")).toBe(38);
  });
});
