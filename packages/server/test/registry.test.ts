import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { createLogger } from "../src/logger";
import { TokenBucket } from "../src/rateLimit";
import { GameRegistry } from "../src/registry";

function registry(now: { t: number }) {
  const config = { ...loadConfig({}), logLevel: "silent" as const, idleGameTtlMs: 1000, finishedGameTtlMs: 500, maxGames: 3 };
  return new GameRegistry(config, createLogger("silent"), () => now.t);
}

describe("registre des parties", () => {
  it("codes uniques, limite de capacité, recherche insensible à la casse", () => {
    const now = { t: 0 };
    const reg = registry(now);
    const rooms = [reg.create(), reg.create(), reg.create()];
    expect(new Set(rooms.map((r) => r!.id)).size).toBe(3);
    expect(reg.create()).toBeNull();
    expect(reg.get(rooms[0]!.id.toLowerCase())).toBe(rooms[0]);
  });

  it("mode rapide et nombre de joueurs max appliqués", () => {
    const reg = registry({ t: 0 });
    const room = reg.create("quick", 3)!;
    expect(room.state.config).toMatchObject({ maxPlayers: 3, crownsToWin: 1, startingHp: 12 });
  });

  it("nettoyage : parties inactives et parties terminées", async () => {
    const now = { t: 0 };
    const reg = registry(now);
    const idle = reg.create()!;
    const finished = reg.create()!;
    await finished.join("A");
    finished.finishedAt = 0;
    now.t = 600;
    reg.sweep();
    expect(reg.get(finished.id)).toBeUndefined();
    expect(reg.get(idle.id)).toBe(idle);
    now.t = 1500;
    reg.sweep();
    expect(reg.size).toBe(0);
    expect(idle.closed).toBe(true);
  });

  it("jetons : résolution, invalidation à la fin de session", async () => {
    const reg = registry({ t: 0 });
    const room = reg.create()!;
    const joined = await room.join("A");
    if (!joined.ok) throw new Error();
    reg.bind(joined.data.token, { gameId: room.id, playerId: joined.data.playerId });
    expect(reg.resolve(joined.data.token)?.playerId).toBe(joined.data.playerId);
    await room.leave(joined.data.playerId);
    expect(reg.resolve(joined.data.token)).toBeNull();
    expect(reg.size).toBe(0); // partie vide supprimée
  });
});

describe("limitation de débit", () => {
  it("seau à jetons : rafale puis recharge progressive", () => {
    const now = { t: 0 };
    const b = new TokenBucket(3, 2, () => now.t);
    expect([b.take(), b.take(), b.take(), b.take()]).toEqual([true, true, true, false]);
    now.t = 500;
    expect([b.take(), b.take()]).toEqual([true, false]);
  });
});

describe("configuration", () => {
  it("lecture des variables d'environnement", () => {
    const c = loadConfig({ PORT: "8080", CORS_ORIGIN: "https://a.fr, https://b.fr", SEAT_RESERVATION_MS: "5000", PLANNING_MS: "45000", LOG_LEVEL: "warn" });
    expect(c).toMatchObject({ port: 8080, corsOrigin: ["https://a.fr", "https://b.fr"], seatReservationMs: 5000, logLevel: "warn" });
    expect(c.gameOverrides.planningMs).toBe(45000);
    expect(loadConfig({ PORT: "abc" }).port).toBe(3001);
    expect(loadConfig({}).corsOrigin).toBe(true);
  });
});
