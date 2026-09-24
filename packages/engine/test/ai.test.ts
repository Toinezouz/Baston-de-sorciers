import { describe, expect, it } from "vitest";
import { botDecide, isDefensive, isSelfHarm, type BotLevel } from "../src/ai";
import { getCardDef } from "../src/cards/registry";
import { createGame } from "../src/state/create";
import { dispatch } from "../src/dispatch";
import { seedFromString } from "../src/rng";
import type { GameState } from "../src/types";
import { assertCardConservation } from "./helpers";

/** Partie entièrement jouée par des bots ; toute action refusée fait échouer le test. */
function botGame(levels: BotLevel[], seed: string): GameState {
  let s = createGame({ id: "AI", seed });
  levels.forEach((_, i) => {
    // Le premier siège rejoint comme « humain » (hôte ; un bot n'est jamais hôte) mais est piloté par l'IA.
    const r = dispatch(s, { system: { type: "JOIN", playerId: `b${i}`, name: `Bot${i}`, bot: i > 0 } });
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  });
  let r = dispatch(s, { playerId: "b0", action: { type: "START_GAME" } });
  if (!r.ok) throw new Error(r.reason);
  s = r.state;
  const rngs = levels.map((_, i) => seedFromString(`${seed}:${i}`));
  for (let guard = 0; s.phase !== "GAME_OVER"; guard++) {
    if (guard > 5000) throw new Error("partie de bots interminable");
    let acted = false;
    for (let i = 0; i < levels.length; i++) {
      for (const action of botDecide(s, `b${i}`, levels[i]!, rngs[i]!)) {
        r = dispatch(s, { playerId: `b${i}`, action });
        if (!r.ok) throw new Error(`bot b${i} (${levels[i]}) : ${action.type} refusé (${r.reason})`);
        s = r.state;
        acted = true;
      }
    }
    if (!acted) {
      const t = Object.keys(s.timers)[0];
      if (!t) throw new Error(`bloqué en ${s.phase}`);
      r = dispatch(s, { system: { type: "TIMEOUT", timerId: t } });
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
  }
  return s;
}

describe("bots", () => {
  it("les joueurs rejoints comme bots sont marqués et prêts d'office", () => {
    const r = dispatch(createGame({ id: "X", seed: "x" }), { system: { type: "JOIN", playerId: "b", name: "Bot", bot: true } });
    expect(r.ok && r.state.players.b).toMatchObject({ isBot: true, ready: true });
  });

  it("un bot n'est jamais hôte : au départ de l'hôte, un autre humain prend la main", () => {
    let s = createGame({ id: "H", seed: "h" });
    for (const [id, bot] of [["h1", false], ["b1", true], ["h2", false]] as const) {
      const r = dispatch(s, { system: { type: "JOIN", playerId: id, name: id, bot } });
      if (r.ok) s = r.state;
    }
    expect(s.hostId).toBe("h1");
    const r = dispatch(s, { playerId: "h1", action: { type: "LEAVE" } });
    expect(r.ok && r.state.hostId).toBe("h2");
  });

  it.each<BotLevel[]>([
    ["facile", "facile"],
    ["normal", "difficile", "facile"],
    ["difficile", "difficile", "normal", "facile", "normal", "difficile"],
  ])("partie complète sans action illégale : %s", (...levels) => {
    for (let g = 0; g < 5; g++) {
      const s = botGame(levels, `ai-${levels.join("-")}-${g}`);
      expect(s.phase).toBe("GAME_OVER");
      assertCardConservation(s);
    }
  });

  it("le niveau difficile bat nettement le niveau facile", () => {
    let hard = 0;
    const games = 40;
    for (let g = 0; g < games; g++) {
      const s = botGame(g % 2 ? ["difficile", "facile"] : ["facile", "difficile"], `duel-${g}`);
      const winnerIdx = Number(s.winnerId?.slice(1));
      if ((g % 2 ? 0 : 1) === winnerIdx) hard++;
    }
    expect(hard / games).toBeGreaterThan(0.6);
  });

  it("classification des cartes : automutilation et défense", () => {
    expect(isSelfHarm(getCardDef("rune.braise.cratere"))).toBe(true);
    expect(isSelfHarm(getCardDef("rune.ombre.pacte-sanglant"))).toBe(true);
    expect(isSelfHarm(getCardDef("rune.ether.rayon-astral"))).toBe(false);
    expect(isDefensive(getCardDef("rune.seve.ecorce"))).toBe(true);
    expect(isDefensive(getCardDef("rune.braise.attise"))).toBe(false);
  });
});
