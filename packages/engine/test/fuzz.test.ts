/**
 * Robustesse : des clients malveillants ou bogués envoient des actions aléatoires (légales ou non).
 * Le moteur ne doit jamais lever d'erreur interne ni produire un état incohérent.
 */
import { describe, expect, it } from "vitest";
import { botActions } from "../src/bot";
import { dispatch } from "../src/dispatch";
import { maxHpOf } from "../src/state/helpers";
import { pick, randInt, seedFromString } from "../src/rng";
import { RUNE_SLOTS, type DispatchInput, type GameState, type RngState } from "../src/types";
import { assertCardConservation, createTestGame } from "./helpers";

function randomInput(s: GameState, rng: RngState): DispatchInput {
  const pids = [...s.seatOrder, "intrus"];
  const pid = pick(rng, pids);
  const anyCard = pick(rng, [...Object.keys(s.cards), "c0", "x"]);
  const slot = pick(rng, [...RUNE_SLOTS, "NOPE" as never]);
  const roll = randInt(rng, 14);
  switch (roll) {
    case 0:
      return { playerId: pid, action: { type: "PLACE_RUNE", cardId: anyCard, slot } };
    case 1:
      return { playerId: pid, action: { type: "REMOVE_RUNE", slot } };
    case 2:
      return { playerId: pid, action: { type: "LOCK_SPELL" } };
    case 3:
      return { playerId: pid, action: { type: "UNLOCK_SPELL" } };
    case 4:
      return { playerId: pid, action: { type: "CHOOSE", requestId: s.pendingChoice?.requestId ?? "req0", optionIds: [pick(rng, [...pids, "0", "1"])] } };
    case 5:
      return { playerId: pid, action: { type: "START_GAME" } };
    case 6:
      return { system: { type: "TIMEOUT", timerId: pick(rng, [...Object.keys(s.timers), "plan-9-9"]) } };
    case 7:
      return { system: { type: "CONNECTION", playerId: pid, status: pick(rng, ["CONNECTED", "DISCONNECTED"] as const) } };
    case 8:
      return { playerId: pid, action: { type: "GARBAGE" } as never };
    case 9:
      if (randInt(rng, 20) === 0) return { system: { type: "ABANDON", playerId: pid } };
      return { playerId: pid, action: { type: "SET_READY", ready: true } };
    default: {
      // Actions légales du bot, pour faire avancer la partie.
      for (const p of s.seatOrder) {
        const a = botActions(s, p, rng)[0];
        if (a) return { playerId: p, action: a };
      }
      const t = Object.keys(s.timers)[0];
      return t ? { system: { type: "TIMEOUT", timerId: t } } : { playerId: pid, action: { type: "LOCK_SPELL" } };
    }
  }
}

function checkInvariants(s: GameState): void {
  assertCardConservation(s);
  for (const p of Object.values(s.players)) {
    if (p.alive) {
      expect(p.hp).toBeGreaterThan(0);
      expect(p.hp).toBeLessThanOrEqual(maxHpOf(s, p.id));
    }
    for (const st of p.statuses) expect(st.stacks).toBeGreaterThan(0);
  }
  expect(s.pendingChoice !== null).toBe(s.phase === "AWAITING_CHOICE");
  const waiting = ["LOBBY", "PLANNING", "AWAITING_CHOICE", "GAME_OVER"];
  expect(waiting).toContain(s.phase);
  if (s.phase === "PLANNING") expect(Object.values(s.timers).some((t) => t.kind === "PLANNING")).toBe(true);
  if (s.phase === "AWAITING_CHOICE") expect(s.timers[s.pendingChoice!.timerId]).toBeDefined();
  if (s.phase !== "AWAITING_CHOICE") expect(s.queue).toHaveLength(0);
}

describe("fuzzing", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i))("partie %i : aucune erreur interne, invariants respectés", (i) => {
    let s = createTestGame(2 + (i % 5), `fuzz-${i}`);
    const rng = seedFromString(`fuzz-rng-${i}`);
    let accepted = 0;
    for (let step = 0; step < 1500 && s.phase !== "GAME_OVER"; step++) {
      const r = dispatch(s, randomInput(s, rng));
      if (!r.ok) {
        expect(r.reason, r.message).not.toBe("ENGINE_ERROR");
        continue;
      }
      accepted++;
      s = r.state;
      checkInvariants(s);
    }
    expect(accepted > 50 || s.phase === "GAME_OVER").toBe(true);
  });
});
