/**
 * Déroulement de la partie : tours, manches, Couronnes, fin de partie, minuteurs.
 */
import { describe, expect, it } from "vitest";
import { T, dmg } from "../src/cards/dsl";
import { dispatch } from "../src/dispatch";
import type { GameState } from "../src/types";
import { act, assertCardConservation, castSpell, createTestGame, defineTestRune, giveRelic, hp, must, runEffects, setHand, stackPile } from "./helpers";

const PRISME = { AMORCE: "rune.ether.prisme" };
const SPARK = { AMORCE: "rune.braise.etincelle-tetue" };
const NOVA = defineTestRune("nova", "AMORCE", [dmg(T.ALL_FOES, 5)]);

function allPrisme(s: GameState): GameState {
  for (const pid of s.seatOrder) if (s.players[pid]!.alive) s = castSpell(s, pid, PRISME);
  return s;
}

function planningTimer(s: GameState): string {
  const t = Object.values(s.timers).find((x) => x.kind === "PLANNING");
  if (!t) throw new Error("no planning timer");
  return t.id;
}

describe("tours", () => {
  it("fin de tour : les runes jouées sont défaussées et les mains complétées", () => {
    let s = createTestGame(3);
    s = allPrisme(s);
    for (const p of Object.values(s.players)) expect(p.hand).toHaveLength(8);
    expect(s.piles.GRIMOIRE.discard.length).toBeGreaterThanOrEqual(3);
    assertCardConservation(s);
  });

  it("taille de main augmentée par la Sacoche sans fond", () => {
    let s = createTestGame(2);
    giveRelic(s, "p1", "relic.sacoche-sans-fond");
    s = allPrisme(s);
    expect(s.players.p1!.hand).toHaveLength(9);
  });

  it("les statuts expirent en fin de tour selon leur durée", () => {
    let s = createTestGame(2);
    runEffects(s, "p1", [{ op: "APPLY_STATUS", target: T.SELF, status: "rage", duration: 1 }]);
    s = allPrisme(s);
    expect(s.players.p1!.statuses).toHaveLength(1); // Clairvoyance de Prisme reste (2 tours)
    expect(s.players.p1!.statuses[0]!.defId).toBe("clairvoyance");
    expect(s.log.some((e) => e.type === "STATUS_EXPIRED" && e.data.status === "rage")).toBe(true);
  });

  it("un sort peut être déverrouillé et modifié avant la révélation", () => {
    let s = createTestGame(2);
    const [a, b] = setHand(s, "p1", ["rune.seve.pousse-vivace", "rune.seve.ecorce"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: a!, slot: "AMORCE" });
    s = act(s, "p1", { type: "LOCK_SPELL" });
    s = act(s, "p1", { type: "UNLOCK_SPELL" });
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: b!, slot: "AMORCE" }); // remplace, a revient en main
    expect(s.players.p1!.hand).toContain(a);
    s = act(s, "p1", { type: "REMOVE_RUNE", slot: "AMORCE" });
    expect(s.players.p1!.hand.sort()).toEqual([a!, b!].sort());
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: b!, slot: "AMORCE" });
    s = act(s, "p1", { type: "LOCK_SPELL" });
    s = castSpell(s, "p2", PRISME);
    expect(s.log.some((e) => e.type === "RUNE_RESOLVING" && e.data.defId === "rune.seve.ecorce")).toBe(true);
  });

  it("temps écoulé : runes posées conservées, sort vide complété au hasard", () => {
    let s = createTestGame(3);
    const [id] = setHand(s, "p1", ["rune.seve.pousse-vivace", "rune.seve.ecorce"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: id!, slot: "AMORCE" });
    s = castSpell(s, "p2", PRISME);
    s = must(s, { system: { type: "TIMEOUT", timerId: planningTimer(s) } });
    const casts = s.log.filter((e) => e.type === "SPELL_CAST" && e.turn === 1);
    expect(casts.map((e) => e.sourceId).sort()).toEqual(["p1", "p2", "p3"]);
    expect(casts.find((e) => e.sourceId === "p1")!.data.runes).toEqual(["rune.seve.pousse-vivace"]);
    expect(s.log.filter((e) => e.type === "SPELL_LOCKED" && e.data.auto).map((e) => e.sourceId).sort()).toEqual(["p1", "p3"]);
    expect(s.turn).toBe(2);
  });

  it("un sorcier sans aucune rune ne lance rien (temps écoulé), la partie continue", () => {
    let s = createTestGame(2, "empty-hand");
    s.piles.GRIMOIRE.discard.push(...s.players.p2!.hand);
    s.players.p2!.hand = [];
    s = castSpell(s, "p1", PRISME);
    s = must(s, { system: { type: "TIMEOUT", timerId: planningTimer(s) } });
    expect(s.turn).toBe(2);
    expect(s.log.some((e) => e.type === "SPELL_CAST" && e.sourceId === "p2")).toBe(false);
    expect(s.players.p2!.hand).toHaveLength(8); // main refaite en fin de tour
  });
});

describe("manches", () => {
  it("le vainqueur de la manche gagne une Couronne et une relique", () => {
    let s = createTestGame(2);
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s.players.p1!.crowns).toBe(1);
    expect(s.players.p1!.relics).toHaveLength(1);
    expect(s.log.some((e) => e.type === "CROWN_AWARDED" && e.targetId === "p1")).toBe(true);
  });

  it("nouvelle manche : PV restaurés, statuts et invocations effacés, mains conservées", () => {
    let s = createTestGame(2);
    runEffects(s, "p1", [{ op: "SUMMON", summon: "feu-follet" }, { op: "APPLY_STATUS", target: T.SELF, status: "rage" }]);
    s.players.p1!.hp = 5;
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s.round).toBe(2);
    expect(hp(s, "p1")).toBe(20);
    expect(s.players.p1!.statuses).toEqual([]);
    expect(Object.keys(s.summons)).toHaveLength(0);
    expect(s.players.p1!.hand).toHaveLength(8);
  });

  it("Rancune « Revanche » : le mort frappe son meurtrier au début de la manche suivante", () => {
    let s = createTestGame(2);
    stackPile(s, "OUTRE_TOMBE", ["grudge.revanche"]);
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s.round).toBe(2);
    expect(s.log.some((e) => e.type === "GRUDGE_DRAWN" && e.data.defId === "grudge.revanche")).toBe(true);
    expect(hp(s, "p1")).toBe(17);
  });

  it("relique éternelle : conservée à la mort et active la manche suivante", () => {
    let s = createTestGame(2);
    giveRelic(s, "p2", "relic.couronne-de-ronces");
    giveRelic(s, "p2", "relic.de-pipe");
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s.players.p2!.relics.map((id) => s.cards[id]!.defId)).toEqual(["relic.couronne-de-ronces"]);
    expect(s.players.p2!.statuses.some((x) => x.defId === "epines")).toBe(true);
  });

  it("plusieurs morts simultanées : le survivant gagne la manche", () => {
    let s = createTestGame(4);
    for (const pid of ["p2", "p3", "p4"]) s.players[pid]!.hp = 3;
    s = castSpell(s, "p1", { AMORCE: NOVA });
    for (const pid of ["p2", "p3", "p4"]) s = castSpell(s, pid, PRISME);
    const deaths = s.log.filter((e) => e.type === "PLAYER_DIED" && e.round === 1);
    expect(deaths.map((e) => e.targetId).sort()).toEqual(["p2", "p3", "p4"]);
    expect(new Set(deaths.map((e) => e.depth)).size).toBe(1);
    expect(s.players.p1!.crowns).toBe(1);
    expect(s.round).toBe(2);
    // Chaque mort reçoit une Rancune.
    expect(s.log.filter((e) => e.type === "GRUDGE_DRAWN").map((e) => e.targetId).sort()).toEqual(["p2", "p3", "p4"]);
  });

  it("mort subite : perte de PV croissante à partir du tour configuré", () => {
    let s = createTestGame(2, "sd", { suddenDeathTurn: 2 });
    s = allPrisme(s);
    expect(hp(s, "p1")).toBe(19); // tour 2 : −1
    s = allPrisme(s);
    expect(hp(s, "p1")).toBe(17); // tour 3 : −2
  });

  it("limite de tours : manche nulle sans Couronne", () => {
    let s = createTestGame(2, "cap", { maxTurnsPerRound: 2, suddenDeathTurn: 99 });
    s = allPrisme(s);
    s = allPrisme(s);
    expect(s.round).toBe(2);
    const ended = s.log.find((e) => e.type === "ROUND_ENDED")!;
    expect(ended.data).toMatchObject({ winnerId: null, reason: "TURN_LIMIT" });
  });
});

describe("fin de partie", () => {
  it("limite de manches : départage aux Couronnes", () => {
    let s = createTestGame(2, "maxr", { maxRounds: 1 });
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s.phase).toBe("GAME_OVER");
    expect(s).toMatchObject({ winnerId: "p1", endReason: "MAX_ROUNDS" });
  });

  it("limite de manches : départage aux dégâts infligés, sinon égalité", () => {
    let s = createTestGame(2, "maxd", { maxRounds: 1, maxTurnsPerRound: 1 });
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s).toMatchObject({ phase: "GAME_OVER", winnerId: "p1", endReason: "MAX_ROUNDS" });

    let d = createTestGame(2, "draw", { maxRounds: 1, maxTurnsPerRound: 1 });
    d = allPrisme(d);
    expect(d).toMatchObject({ phase: "GAME_OVER", winnerId: null, endReason: "DRAW" });
    expect(d.log.at(-1)!.type).toBe("GAME_OVER");
  });

  it("après la fin : plus aucune action de jeu, minuteurs vidés", () => {
    let s = createTestGame(2, "end", { crownsToWin: 1 });
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s.phase).toBe("GAME_OVER");
    expect(s.timers).toEqual({});
    const r = dispatch(s, { playerId: "p2", action: { type: "PLACE_RUNE", cardId: s.players.p2!.hand[0]!, slot: "AMORCE" } });
    expect(r.ok || r.reason).toBe("GAME_OVER");
    expect(dispatch(s, { playerId: "p2", action: { type: "LEAVE" } }).ok).toBe(true);
  });

  it("un abandonné reste hors jeu aux manches suivantes et ne reçoit pas de Rancune", () => {
    let s = createTestGame(3);
    s = must(s, { system: { type: "ABANDON", playerId: "p3" } });
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", SPARK);
    s = castSpell(s, "p2", PRISME);
    expect(s.round).toBe(2);
    expect(s.players.p3!.alive).toBe(false);
    expect(s.log.some((e) => e.type === "GRUDGE_DRAWN" && e.targetId === "p3")).toBe(false);
    // Seuls p1 et p2 planifient : la partie avance sans p3.
    s = allPrisme(s);
    expect(s.turn).toBe(2);
  });
});
