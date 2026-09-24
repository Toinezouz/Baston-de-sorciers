import { createGame, dispatch, viewFor, type GameEvent, type GameState } from "@baston/engine";
import type { StateMessage } from "@baston/shared";
import { describe, expect, it } from "vitest";
import { lastRevealedSpells, opponents, powerPreview, sortHand } from "../src/game/helpers";
import { rejectMessage } from "../src/net/messages";
import { applyStateMessage, initialState, MAX_LOG, remainingMs } from "../src/net/store";

function msg(version: number, events: GameEvent[] = [], full = false, gameId = "G"): StateMessage {
  const state = createGame({ id: gameId, seed: "x" });
  return { gameId, version, full, view: viewFor(state, null), events, deadlines: {}, serverTime: 10_000 };
}
const ev = (seq: number): GameEvent => ({ seq, round: 0, turn: 0, depth: 0, type: "PHASE_CHANGED", data: {} });

describe("magasin client", () => {
  it("ajoute les événements des nouvelles versions et ignore les messages périmés", () => {
    let s = applyStateMessage(initialState, msg(1, [ev(1)], true), 0);
    s = applyStateMessage(s, msg(2, [ev(2)]), 0);
    expect(s.log.map((e) => e.seq)).toEqual([1, 2]);
    const stale = applyStateMessage(s, msg(2, [ev(99)]), 0);
    expect(stale).toBe(s);
    expect(applyStateMessage(s, msg(1, [ev(98)]), 0)).toBe(s);
  });

  it("une synchronisation complète remplace le journal", () => {
    let s = applyStateMessage(initialState, msg(5, [ev(1), ev(2)], true), 0);
    s = applyStateMessage(s, msg(5, [ev(7)], true), 0);
    expect(s.log.map((e) => e.seq)).toEqual([7]);
    expect(s.lastEvents).toEqual([]);
  });

  it("changement de partie : le journal repart de zéro", () => {
    let s = applyStateMessage(initialState, msg(9, [ev(1)], true, "A"), 0);
    s = applyStateMessage(s, msg(1, [ev(2)], false, "B"), 0);
    expect(s.log.map((e) => e.seq)).toEqual([2]);
  });

  it("journal borné et décalage d'horloge calculé", () => {
    let s = applyStateMessage(initialState, msg(1, [], true), 4_000);
    expect(s.clockOffset).toBe(6_000);
    for (let v = 2; v < MAX_LOG + 20; v++) s = applyStateMessage(s, msg(v, [ev(v)]), 0);
    expect(s.log.length).toBe(MAX_LOG);
  });

  it("temps restant corrigé du décalage d'horloge, jamais négatif", () => {
    expect(remainingMs(20_000, 5_000, 10_000)).toBe(5_000);
    expect(remainingMs(1_000, 0, 10_000)).toBe(0);
  });

  it("messages d'erreur en français, repli générique", () => {
    expect(rejectMessage("CARD_NOT_IN_HAND")).toMatch(/main/);
    expect(rejectMessage("QUELQUE_CHOSE")).toMatch(/QUELQUE_CHOSE/);
  });
});

describe("sélecteurs d'affichage", () => {
  function started(n: number): GameState {
    let s = createGame({ id: "G", seed: "sel" });
    for (let i = 1; i <= n; i++) {
      const r = dispatch(s, { system: { type: "JOIN", playerId: `p${i}`, name: `J${i}` } });
      if (r.ok) s = r.state;
    }
    for (let i = 2; i <= n; i++) {
      const r = dispatch(s, { playerId: `p${i}`, action: { type: "SET_READY", ready: true } });
      if (r.ok) s = r.state;
    }
    const r = dispatch(s, { playerId: "p1", action: { type: "START_GAME" } });
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  }

  it("adversaires dans l'ordre de table à partir de ma gauche", () => {
    const view = viewFor(started(4), "p3");
    expect(opponents(view).map((p) => p.id)).toEqual(["p4", "p1", "p2"]);
  });

  it("aperçu de puissance et tri de la main", () => {
    expect(powerPreview(["rune.braise.etincelle-tetue", "rune.duo.tison-d-ombre"])).toEqual([
      { school: "BRAISE", dice: 2 },
      { school: "OMBRE", dice: 1 },
    ]);
    // Concentration : +2 dés pour un sort d'une rune.
    expect(powerPreview(["rune.ether.rayon-astral"], [2, 1, 0])).toEqual([{ school: "ETHER", dice: 3 }]);
    const sorted = sortHand([{ defId: "rune.instable" }, { defId: "rune.ether.rayon-astral" }, { defId: "rune.seve.pousse-vivace" }]);
    expect(sorted.map((c) => c.defId)).toEqual(["rune.seve.pousse-vivace", "rune.ether.rayon-astral", "rune.instable"]);
  });

  it("derniers sorts révélés, triés selon l'initiative", () => {
    const log: GameEvent[] = [
      { seq: 1, round: 1, turn: 3, depth: 0, type: "SPELLS_REVEALED", data: { spells: [{ playerId: "a", runes: { AMORCE: "x" } }, { playerId: "b", runes: { AMORCE: "y" } }, { playerId: "c", runes: {} }] } },
      { seq: 2, round: 1, turn: 3, depth: 0, type: "INITIATIVE_SET", data: { order: [{ playerId: "b" }, { playerId: "a" }] } },
    ];
    const r = lastRevealedSpells(log)!;
    expect(r.turn).toBe(3);
    expect(r.spells.map((s) => s.playerId)).toEqual(["b", "a"]);
    expect(lastRevealedSpells([])).toBeNull();
  });
});
