/**
 * Intégrité face aux actions concurrentes, répétées ou périmées, et immutabilité de l'état.
 *
 * Le serveur sérialise les actions d'une partie : deux actions « simultanées » sont appliquées
 * l'une après l'autre, la seconde étant revalidée contre l'état produit par la première.
 */
import { describe, expect, it } from "vitest";
import { dispatch } from "../src/dispatch";
import type { DispatchInput, GameState } from "../src/types";
import { act, castSpell, createTestGame, must, setHand } from "./helpers";

/** Applique les entrées dans l'ordre, comme la file d'une salle serveur. */
function serial(s: GameState, inputs: DispatchInput[]) {
  const results: string[] = [];
  for (const input of inputs) {
    const r = dispatch(s, input);
    results.push(r.ok ? "OK" : r.reason);
    if (r.ok) s = r.state;
  }
  return { state: s, results };
}

describe("immutabilité et versions", () => {
  it("dispatch ne modifie jamais l'état reçu (succès comme refus)", () => {
    const s = createTestGame(2);
    const before = JSON.stringify(s);
    const id = s.players.p1!.hand[0]!;
    dispatch(s, { playerId: "p1", action: { type: "PLACE_RUNE", cardId: id, slot: "AMORCE" } });
    dispatch(s, { playerId: "p1", action: { type: "PLACE_RUNE", cardId: id, slot: "TORSION" } });
    dispatch(s, { playerId: "p1", action: { type: "PLACE_RUNE", cardId: id, slot: "FRAPPE" } });
    dispatch(s, { playerId: "p2", action: { type: "LOCK_SPELL" } });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("la version augmente de 1 par action acceptée, et seulement dans ce cas", () => {
    const s = createTestGame(2);
    const ok = dispatch(s, { system: { type: "CONNECTION", playerId: "p2", status: "DISCONNECTED" } });
    expect(ok.ok && ok.state.version).toBe(s.version + 1);
    const ko = dispatch(s, { playerId: "p1", action: { type: "LOCK_SPELL" } });
    expect(ko.ok).toBe(false);
  });

  it("les événements retournés sont exactement ceux ajoutés au journal", () => {
    const s = createTestGame(2);
    const r = dispatch(s, { system: { type: "CONNECTION", playerId: "p2", status: "DISCONNECTED" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.log.slice(s.log.length)).toEqual(r.events);
  });
});

describe("actions concurrentes", () => {
  it("double verrouillage simultané : une seule action acceptée (pas de double paiement)", () => {
    let s = createTestGame(2);
    const [id] = setHand(s, "p1", ["rune.seve.pousse-vivace"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: id!, slot: "AMORCE" });
    const lock: DispatchInput = { playerId: "p1", action: { type: "LOCK_SPELL" } };
    expect(serial(s, [lock, lock]).results).toEqual(["OK", "SPELL_LOCKED"]);
  });

  it("la même carte posée deux fois simultanément : la seconde est refusée", () => {
    const s = createTestGame(2);
    const [id] = setHand(s, "p1", ["rune.seve.pousse-vivace"]);
    const place: DispatchInput = { playerId: "p1", action: { type: "PLACE_RUNE", cardId: id!, slot: "AMORCE" } };
    const { state, results } = serial(s, [place, place]);
    expect(results).toEqual(["OK", "CARD_NOT_IN_HAND"]);
    expect(state.players.p1!.hand).not.toContain(id);
  });

  it("deux joueurs verrouillent en même temps : une seule résolution", () => {
    let s = createTestGame(2);
    const [a] = setHand(s, "p1", ["rune.braise.etincelle-tetue"]);
    const [b] = setHand(s, "p2", ["rune.ether.prisme"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: a!, slot: "AMORCE" });
    s = act(s, "p2", { type: "PLACE_RUNE", cardId: b!, slot: "AMORCE" });
    const { state, results } = serial(s, [
      { playerId: "p1", action: { type: "LOCK_SPELL" } },
      { playerId: "p2", action: { type: "LOCK_SPELL" } },
    ]);
    expect(results).toEqual(["OK", "OK"]);
    expect(state.log.filter((e) => e.type === "SPELLS_REVEALED")).toHaveLength(1);
    expect(state.players.p2!.hp).toBe(19);
  });

  it("une action arrivée après le changement de phase est refusée proprement", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { AMORCE: "rune.ether.prisme" });
    const { results } = serial(s, [
      { system: { type: "TIMEOUT", timerId: Object.keys(s.timers)[0]! } },
      { playerId: "p2", action: { type: "PLACE_RUNE", cardId: "c-inexistante", slot: "AMORCE" } },
    ]);
    expect(results[0]).toBe("OK");
    expect(results[1]).toBe("CARD_NOT_IN_HAND");
  });

  it("réponse de choix rejouée : la seconde est refusée", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.nuee-de-mites" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme" });
    const choose: DispatchInput = { playerId: "p1", action: { type: "CHOOSE", requestId: s.pendingChoice!.requestId, optionIds: ["p2"] } };
    const { results, state } = serial(s, [choose, choose]);
    expect(results).toEqual(["OK", "WRONG_PHASE"]);
    expect(state.players.p2!.statuses.find((x) => x.defId === "venin")?.stacks).toBe(2);
  });

  it("minuteur expiré après que tout le monde a joué : refusé (STALE_TIMER)", () => {
    let s = createTestGame(2);
    const timerId = Object.keys(s.timers)[0]!;
    s = castSpell(s, "p1", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    const r = dispatch(s, { system: { type: "TIMEOUT", timerId } });
    expect(r.ok || r.reason).toBe("STALE_TIMER");
    expect(Object.keys(s.timers)[0]).not.toBe(timerId); // nouveau minuteur pour le tour 2
  });

  it("choix et minuteur simultanés : le premier arrivé gagne, l'autre est refusé", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.nuee-de-mites" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme" });
    const pc = s.pendingChoice!;
    const a = serial(s, [
      { playerId: "p1", action: { type: "CHOOSE", requestId: pc.requestId, optionIds: ["p3"] } },
      { system: { type: "TIMEOUT", timerId: pc.timerId } },
    ]);
    expect(a.results).toEqual(["OK", "STALE_TIMER"]);
    const b = serial(s, [
      { system: { type: "TIMEOUT", timerId: pc.timerId } },
      { playerId: "p1", action: { type: "CHOOSE", requestId: pc.requestId, optionIds: ["p3"] } },
    ]);
    expect(b.results).toEqual(["OK", "WRONG_PHASE"]);
  });

  it("une valeur forgée par le client n'a aucun effet (seuls des identifiants sont acceptés)", () => {
    const s = createTestGame(2);
    const forged = { type: "PLACE_RUNE", cardId: s.players.p2!.hand[0], slot: "AMORCE", damage: 999999, hp: 999999 } as never;
    const r = dispatch(s, { playerId: "p1", action: forged });
    expect(r.ok || r.reason).toBe("CARD_NOT_IN_HAND");
    const unknown = dispatch(s, { playerId: "p1", action: { type: "SET_HP", hp: 999 } as never });
    expect(unknown.ok || unknown.reason).toBe("UNKNOWN_ACTION");
    must(s, { system: { type: "CONNECTION", playerId: "p1", status: "CONNECTED" } });
  });
});
