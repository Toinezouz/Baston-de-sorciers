/**
 * Tests d'intégration du serveur (réseau réel, clients Socket.IO).
 */
import { C2S, S2C, type SessionInfo } from "@baston/shared";
import { afterEach, describe, expect, it } from "vitest";
import { client, playUntilOver, reason, sleep, startServer, startedGame, type TestClient, type TestServer } from "./harness";

let srv: TestServer;
const clients: TestClient[] = [];
async function track<T extends TestClient | TestClient[]>(p: Promise<T>): Promise<T> {
  const c = await p;
  clients.push(...(Array.isArray(c) ? c : [c]));
  return c;
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await srv?.close();
});

describe("création et lobby", () => {
  it("créer, rejoindre avec le code (insensible à la casse), voir les joueurs, démarrer", async () => {
    srv = await startServer();
    const a = await track(client(srv.url));
    const created = await a.create("Alex");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.gameId).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.data.token).toMatch(/^[a-f0-9]{64}$/);

    const b = await track(client(srv.url));
    const joined = await b.join(created.data.gameId.toLowerCase(), "  Marie  ");
    expect(joined.ok).toBe(true);
    await a.waitFor((s) => s.view.public.players.length === 2);
    expect(a.view.public.players.map((p) => p.name)).toEqual(["Alex", "Marie"]);

    expect((await a.act({ type: "START_GAME" })).ok).toBe(false); // Marie n'est pas prête
    await b.act({ type: "SET_READY", ready: true });
    await a.waitFor((s) => s.view.public.players[1]!.ready);
    expect((await a.act({ type: "START_GAME" })).ok).toBe(true);
    for (const c of [a, b]) {
      const st = await c.waitFor((s) => s.view.public.phase === "PLANNING");
      expect(st.view.private!.hand).toHaveLength(8);
      expect(Object.values(st.deadlines).length).toBe(1);
    }
  });

  it("API HTTP : santé, aperçu d'une partie, code inconnu", async () => {
    srv = await startServer();
    const a = await track(client(srv.url));
    const created = await a.create("Alex", { maxPlayers: 3 });
    if (!created.ok) throw new Error();
    const health = await (await fetch(`${srv.url}/health`)).json();
    expect(health).toMatchObject({ ok: true, games: 1 });
    const info = await (await fetch(`${srv.url}/api/games/${created.data.gameId}`)).json();
    expect(info).toMatchObject({ exists: true, phase: "LOBBY", players: 1, maxPlayers: 3, joinable: true });
    expect((await fetch(`${srv.url}/api/games/ZZZZZZ`)).status).toBe(404);
    expect((await fetch(`${srv.url}/api/games/..%2F..%2Fetc`)).status).toBe(404);
  });

  it("partie pleine, partie déjà commencée, code inconnu", async () => {
    srv = await startServer();
    const [a] = await track(startedGame(srv.url, 2, { maxPlayers: 2 }));
    const c = await track(client(srv.url));
    const r = await c.join(a!.session!.gameId, "Tard");
    expect(reason(r)).toBe("GAME_ALREADY_STARTED");
    expect(reason(await c.join("ABCDEF", "X"))).toBe("GAME_NOT_FOUND");

    const host = await track(client(srv.url));
    const g = await host.create("H", { maxPlayers: 2 });
    if (!g.ok) throw new Error();
    await (await track(client(srv.url))).join(g.data.gameId, "B");
    const full = await (await track(client(srv.url))).join(g.data.gameId, "C");
    expect(reason(full)).toBe("GAME_FULL");
  });

  it("capacité du serveur atteinte", async () => {
    srv = await startServer({ maxGames: 1 });
    expect((await (await track(client(srv.url))).create("A")).ok).toBe(true);
    const r = await (await track(client(srv.url))).create("B");
    expect(reason(r)).toBe("SERVER_FULL");
  });

  it("quitter le lobby ; la partie disparaît quand tout le monde est parti", async () => {
    srv = await startServer();
    const a = await track(client(srv.url));
    const g = await a.create("A");
    if (!g.ok) throw new Error();
    const b = await track(client(srv.url));
    await b.join(g.data.gameId, "B");
    await a.waitFor((s) => s.view.public.players.length === 2);
    expect((await b.request(C2S.LEAVE)).ok).toBe(true);
    await a.waitFor((s) => s.view.public.players.length === 1);
    expect((await a.request(C2S.LEAVE)).ok).toBe(true);
    expect((await fetch(`${srv.url}/api/games/${g.data.gameId}`)).status).toBe(404);
  });
});

describe("validation et sécurité", () => {
  it("charges utiles invalides ou forgées : refusées avant le moteur", async () => {
    srv = await startServer();
    const a = await track(client(srv.url));
    expect(reason(await a.request(C2S.CREATE, { name: "x".repeat(50) }))).toBe("INVALID_PAYLOAD");
    expect(reason(await a.request(C2S.CREATE, { name: "\u0000​ " }))).toBe("INVALID_PAYLOAD");
    expect(reason(await a.request(C2S.CREATE, "n'importe quoi"))).toBe("INVALID_PAYLOAD");
    expect(reason(await a.request(C2S.ACTION, { clientSeq: 1, action: { type: "LOCK_SPELL" } }))).toBe("NOT_IN_A_GAME");
    await a.create("Alex");
    const forged = await a.request(C2S.ACTION, { clientSeq: 1, action: { type: "SET_READY", ready: true, hp: 999 } });
    expect(reason(forged)).toBe("INVALID_PAYLOAD");
    const unknown = await a.request(C2S.ACTION, { clientSeq: 2, action: { type: "DEAL_DAMAGE", amount: 99 } });
    expect(reason(unknown)).toBe("INVALID_PAYLOAD");
    expect(reason(await a.request(C2S.RESUME, { token: "abc" }))).toBe("INVALID_PAYLOAD");
    expect(reason(await a.request(C2S.RESUME, { token: "0".repeat(64) }))).toBe("SESSION_INVALID");
    expect(reason(await a.create("Encore"))).toBe("ALREADY_IN_A_GAME");
  });

  it("un message sans accusé de réception est ignoré sans planter", async () => {
    srv = await startServer();
    const a = await track(client(srv.url));
    a.socket.emit(C2S.CREATE, { name: "Sans ack" });
    await sleep(100);
    expect(srv.server.registry.size).toBe(0);
    expect((await a.create("Avec ack")).ok).toBe(true);
  });

  it("limitation de débit", async () => {
    srv = await startServer({ rateLimit: { burst: 5, perSecond: 1 } });
    const a = await track(client(srv.url));
    await a.create("Alex");
    const acks = await Promise.all(Array.from({ length: 10 }, () => a.request(C2S.SYNC)));
    expect(acks.filter((x) => !x.ok && x.reason === "RATE_LIMITED").length).toBeGreaterThanOrEqual(5);
  });

  it("aucune carte de la main adverse ne transite vers un autre joueur", async () => {
    srv = await startServer();
    const [a, b] = await track(startedGame(srv.url, 2));
    await a!.castAny();
    await b!.castAny();
    await a!.waitFor((s) => s.view.public.turn === 2);
    await b!.waitFor((s) => s.view.public.turn === 2);
    const aHands = new Set(a!.states.flatMap((s) => s.view.private?.hand.map((c) => c.id) ?? []));
    const bSaw = JSON.stringify(b!.states);
    // Les cartes révélées dans les sorts sont publiques : on ne vérifie que celles restées en main.
    const revealed = new Set(
      b!.states.flatMap((s) => s.view.public.players.flatMap((p) => Object.values(p.spell?.runes ?? {}).map((r) => r!.id))),
    );
    // Une carte que B a lui-même possédée (ex. volée ensuite par A) lui est légitimement connue.
    const bOwn = new Set(b!.states.flatMap((s) => s.view.private?.hand.map((c) => c.id) ?? []));
    const stillSecret = [...aHands].filter((id) => !revealed.has(id) && !bOwn.has(id));
    expect(stillSecret.length).toBeGreaterThan(5);
    for (const id of stillSecret) expect(bSaw).not.toContain(`"${id}"`);
    expect(bSaw).not.toMatch(/"rng"|"seed"/);
  });
});

describe("actions, idempotence, concurrence", () => {
  it("un même clientSeq renvoyé n'est appliqué qu'une fois ; un ancien est refusé", async () => {
    srv = await startServer();
    const [a] = await track(startedGame(srv.url, 2));
    const card = a!.view.private!.hand.find((c) => c.defId !== "rune.instable")!;
    const { getCardDef } = await import("@baston/engine");
    const action = { type: "PLACE_RUNE" as const, cardId: card.id, slot: getCardDef(card.defId).slot! };
    const first = await a!.act(action, 10);
    const retry = await a!.act(action, 10);
    expect(first).toEqual(retry);
    expect(first.ok).toBe(true);
    const old = await a!.act({ type: "LOCK_SPELL" }, 9);
    expect(reason(old)).toBe("DUPLICATE_ACTION");
    await a!.waitFor((s) => s.view.private!.hand.length === 7);
  });

  it("actions simultanées de deux joueurs : une seule résolution, états cohérents", async () => {
    srv = await startServer();
    const [a, b] = await track(startedGame(srv.url, 2));
    const { getCardDef } = await import("@baston/engine");
    void getCardDef;
    // Pose en parallèle, puis verrouillage simultané des deux joueurs.
    const [pa, pb] = await Promise.all([a!.castAny(), b!.castAny()]);
    void pa;
    void pb;
    const sa = await a!.waitFor((s) => s.view.public.turn === 2);
    const sb = await b!.waitFor((s) => s.view.public.turn === 2);
    expect(sa.version).toBe(sb.version);
    expect(sa.view.public.players.map((p) => p.hp)).toEqual(sb.view.public.players.map((p) => p.hp));
    const reveals = a!.states.flatMap((s) => s.events).filter((e) => e.type === "SPELLS_REVEALED");
    expect(reveals).toHaveLength(1);
  });

  it("rafale d'actions non attendues : traitées dans l'ordre d'envoi", async () => {
    srv = await startServer();
    const [a] = await track(startedGame(srv.url, 2));
    const { getCardDef } = await import("@baston/engine");
    const card = a!.view.private!.hand.find((x) => x.defId !== "rune.instable")!;
    const slot = getCardDef(card.defId).slot!;
    const acks = await Promise.all([
      a!.act({ type: "PLACE_RUNE", cardId: card.id, slot }),
      a!.act({ type: "LOCK_SPELL" }),
      a!.act({ type: "UNLOCK_SPELL" }),
      a!.act({ type: "REMOVE_RUNE", slot }),
    ]);
    expect(acks.map((x) => x.ok)).toEqual([true, true, true, true]);
  });

  it("les versions reçues sont strictement croissantes", async () => {
    srv = await startServer();
    const [a, b] = await track(startedGame(srv.url, 2));
    await a!.castAny();
    await b!.castAny();
    await a!.waitFor((s) => s.view.public.turn === 2);
    const versions = a!.states.map((s) => s.version);
    for (let i = 1; i < versions.length; i++) expect(versions[i]!).toBeGreaterThan(versions[i - 1]!);
  });
});

describe("minuteurs", () => {
  it("temps de planification écoulé : le serveur verrouille et résout seul", async () => {
    srv = await startServer({ gameOverrides: { planningMs: 300 } });
    const [a, b] = await track(startedGame(srv.url, 2));
    const s = await a!.waitFor((m) => m.view.public.turn === 2, 3000);
    expect(s.events.concat(...a!.states.map((x) => x.events)).some((e) => e.type === "SPELL_LOCKED" && e.data.auto)).toBe(true);
    const deadline = Object.values(s.deadlines)[0]!;
    expect(deadline).toBeGreaterThan(s.serverTime);
    expect(deadline - s.serverTime).toBeLessThanOrEqual(300);
    await b!.waitFor((m) => m.view.public.turn === 2);
  });
});

describe("déconnexion et reconnexion", () => {
  it("un joueur se déconnecte puis revient avec son jeton : état privé restauré", async () => {
    srv = await startServer();
    const [a, b] = await track(startedGame(srv.url, 2));
    const token = b!.session!.token;
    const hand = b!.view.private!.hand.map((c) => c.id);
    await b!.act({ type: "SET_READY", ready: true }).catch(() => undefined); // consomme un clientSeq (refusé : mauvaise phase)
    b!.close();
    const bId = b!.session!.playerId;
    await a!.waitFor((s) => s.view.public.players.find((p) => p.id === bId)!.connection === "DISCONNECTED");

    const b2 = await track(client(srv.url));
    const resumed = await b2.resume(token);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.playerId).toBe(bId);
    expect(resumed.data.lastClientSeq).toBe(2); // SET_READY du lobby + l'action refusée
    const full = await b2.waitFor((s) => s.full);
    expect(full.view.private!.hand.map((c) => c.id)).toEqual(hand);
    expect(full.events.length).toBeGreaterThan(0);
    await a!.waitFor((s) => s.view.public.players.find((p) => p.id === bId)!.connection === "CONNECTED");
    // Il peut rejouer immédiatement.
    await b2.castAny();
  });

  it("siège réservé expiré en partie : abandon, l'autre joueur gagne par forfait", async () => {
    srv = await startServer({ seatReservationMs: 200 });
    const [a, b] = await track(startedGame(srv.url, 2));
    const token = b!.session!.token;
    b!.close();
    const end = await a!.waitFor((s) => s.view.public.phase === "GAME_OVER", 3000);
    expect(end.view.public.winnerId).toBe(a!.session!.playerId);
    expect(end.view.public.endReason).toBe("FORFEIT");
    const late = await (await track(client(srv.url))).resume(token);
    expect(reason(late)).toBe("SESSION_INVALID");
  });

  it("siège réservé expiré dans le lobby : le joueur est retiré", async () => {
    srv = await startServer({ seatReservationMs: 150 });
    const a = await track(client(srv.url));
    const g = await a.create("A");
    if (!g.ok) throw new Error();
    const b = await track(client(srv.url));
    await b.join(g.data.gameId, "B");
    await a.waitFor((s) => s.view.public.players.length === 2);
    b.close();
    await a.waitFor((s) => s.view.public.players.length === 1, 3000);
  });

  it("reprise sur un deuxième appareil : l'ancien est déconnecté de la partie", async () => {
    srv = await startServer();
    const [a] = await track(startedGame(srv.url, 2));
    const other = await track(client(srv.url));
    expect((await other.resume(a!.session!.token)).ok).toBe(true);
    await sleep(50);
    expect(a!.kicked?.reason).toBe("SESSION_REPLACED");
    const r = await a!.act({ type: "LOCK_SPELL" });
    expect(reason(r)).toBe("NOT_IN_A_GAME");
  });
});

describe("partie complète en réseau", () => {
  it("deux clients jouent une partie rapide jusqu'à la victoire", async () => {
    // Bots bien plus rapides qu'un humain : limitation de débit relevée pour ce test.
    srv = await startServer({ gameOverrides: { planningMs: 2000, choiceMs: 500 }, rateLimit: { burst: 1000, perSecond: 1000 } });
    const players = await track(startedGame(srv.url, 2, { mode: "quick" }));
    await playUntilOver(players);
    const final = await players[1]!.waitFor((s) => s.view.public.phase === "GAME_OVER", 5000);
    expect(final.view.public.winnerId).toBeTruthy();
    expect(players[0]!.last.view.public.winnerId).toBe(final.view.public.winnerId);
  }, 30_000);
});

describe("revanche", () => {
  it("après la fin, un joueur lance la revanche et l'autre la rejoint via la proposition", async () => {
    // Bots bien plus rapides qu'un humain : limitation de débit relevée pour ce test.
    srv = await startServer({ gameOverrides: { planningMs: 2000, choiceMs: 500 }, rateLimit: { burst: 1000, perSecond: 1000 } });
    const [a, b] = await track(startedGame(srv.url, 2, { mode: "quick", maxPlayers: 3 }));
    const early = await a!.request(C2S.REMATCH);
    expect(reason(early)).toBe("WRONG_PHASE");
    await playUntilOver([a!, b!]);
    await b!.waitFor((s) => s.view.public.phase === "GAME_OVER", 5000);
    const oldCode = a!.session!.gameId;

    const offers: { gameId: string; by: string }[] = [];
    b!.socket.on(S2C.REMATCH_OFFER, (m) => offers.push(m));
    const ra = await a!.request<SessionInfo>(C2S.REMATCH);
    expect(reason(ra)).toBe("OK");
    if (!ra.ok) return;
    expect(ra.data.gameId).not.toBe(oldCode);
    await sleep(50);
    expect(offers).toEqual([{ gameId: ra.data.gameId, by: "Hôte" }]);

    const rb = await b!.request<SessionInfo>(C2S.REMATCH);
    expect(rb.ok && rb.data.gameId).toBe(ra.data.gameId);
    // Même réglages (mode rapide, 3 joueurs max), nouveau lobby avec les deux joueurs, A hôte.
    const lobby = await a!.waitFor((s) => s.gameId === ra.data.gameId && s.view.public.players.length === 2);
    expect(lobby.view.public.config).toMatchObject({ crownsToWin: 1, maxPlayers: 3 });
    expect(lobby.view.public.hostId).toBe(ra.data.playerId);
    // L'ancienne partie, désormais vide, a été supprimée.
    expect((await fetch(`${srv.url}/api/games/${oldCode}`)).status).toBe(404);
  }, 30_000);
});
