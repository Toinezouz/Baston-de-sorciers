import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateCatalog } from "../src/cards/registry";
import { describeEvent } from "../src/format";
import { assertCardConservation, createTestGame, runBotGame } from "./helpers";

function listTs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listTs(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("fondations", () => {
  it("le catalogue de cartes est valide", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("le moteur n'utilise ni Math.random ni Date (déterminisme)", () => {
    const offenders = listTs(join(__dirname, "../src")).filter((f) => /Math\.random|Date\.now|new Date\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("une partie démarre en planification avec des mains pleines", () => {
    const s = createTestGame(3);
    expect(s.phase).toBe("PLANNING");
    expect(s.round).toBe(1);
    expect(s.turn).toBe(1);
    for (const p of Object.values(s.players)) {
      expect(p.hand).toHaveLength(8);
      expect(p.hp).toBe(20);
    }
    assertCardConservation(s);
  });
});

describe("simulation de parties complètes par bots", () => {
  it.each([2, 3, 4, 6])("%i joueurs : la partie se termine sans erreur et conserve les cartes", (n) => {
    const { state } = runBotGame({ players: n, seed: `smoke-${n}`, checkInvariants: true });
    expect(state.phase).toBe("GAME_OVER");
    expect(["CROWNS", "MAX_ROUNDS", "DRAW"]).toContain(state.endReason);
    if (state.endReason === "CROWNS") expect(state.players[state.winnerId!]!.crowns).toBe(state.config.crownsToWin);
    // Tous les événements sont formatables sans exception.
    const name = (id: string | null | undefined) => (id ? state.players[id]?.name ?? id : "?");
    for (const ev of state.log) describeEvent(ev, name);
  });

  it("50 parties aléatoires avec timeouts se terminent", () => {
    for (let i = 0; i < 50; i++) {
      const { state } = runBotGame({ players: 2 + (i % 5), seed: `bulk-${i}`, idlePercent: 15 });
      expect(state.phase).toBe("GAME_OVER");
    }
  });

  it("déterminisme : même seed + mêmes actions ⇒ même partie", () => {
    const a = runBotGame({ players: 4, seed: "replay" }).state;
    const b = runBotGame({ players: 4, seed: "replay" }).state;
    expect(b.log).toEqual(a.log);
    expect(b.winnerId).toBe(a.winnerId);
  });
});
