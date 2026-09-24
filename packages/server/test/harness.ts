/**
 * Harnais d'intégration : un vrai serveur sur un port aléatoire, de vrais clients Socket.IO.
 */
import { getCardDef, type PlayerAction, type PlayerView } from "@baston/engine";
import { C2S, S2C, type Ack, type KickedMessage, type SessionInfo, type StateMessage } from "@baston/shared";
import { io, type Socket } from "socket.io-client";
import { loadConfig, type ServerConfig } from "../src/config";
import { createGameServer, type GameServer } from "../src/server";

export interface TestServer {
  server: GameServer;
  url: string;
  close(): Promise<void>;
}

export async function startServer(overrides: Partial<ServerConfig> = {}): Promise<TestServer> {
  const config: ServerConfig = {
    ...loadConfig({}),
    port: 0,
    host: "127.0.0.1",
    logLevel: "silent",
    ...overrides,
    gameOverrides: { planningMs: 10_000, choiceMs: 10_000, ...overrides.gameOverrides },
  };
  const server = createGameServer(config);
  const port = await server.listen();
  return { server, url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

export class TestClient {
  socket: Socket;
  states: StateMessage[] = [];
  kicked: KickedMessage | null = null;
  session: SessionInfo | null = null;
  private seq = 0;
  private waiters: { pred: (s: StateMessage) => boolean; resolve: (s: StateMessage) => void }[] = [];

  constructor(url: string) {
    this.socket = io(url, { transports: ["websocket"], reconnection: false, forceNew: true });
    this.socket.on(S2C.STATE, (m: StateMessage) => {
      this.states.push(m);
      this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.resolve(m), false) : true));
    });
    this.socket.on(S2C.KICKED, (m: KickedMessage) => (this.kicked = m));
  }

  connected(): Promise<void> {
    return new Promise((ok, ko) => {
      if (this.socket.connected) return ok();
      this.socket.once("connect", () => ok());
      this.socket.once("connect_error", ko);
    });
  }

  request<T = unknown>(event: string, payload?: unknown): Promise<Ack<T>> {
    return new Promise((ok) => {
      if (payload === undefined) this.socket.emit(event, undefined, ok);
      else this.socket.emit(event, payload, ok);
    });
  }

  async create(name: string, extra: Record<string, unknown> = {}): Promise<Ack<SessionInfo>> {
    const ack = await this.request<SessionInfo>(C2S.CREATE, { name, ...extra });
    if (ack.ok) this.session = ack.data;
    return ack;
  }

  async join(gameId: string, name: string): Promise<Ack<SessionInfo>> {
    const ack = await this.request<SessionInfo>(C2S.JOIN, { gameId, name });
    if (ack.ok) this.session = ack.data;
    return ack;
  }

  async resume(token: string): Promise<Ack<SessionInfo>> {
    const ack = await this.request<SessionInfo>(C2S.RESUME, { token });
    if (ack.ok) {
      this.session = ack.data;
      this.seq = ack.data.lastClientSeq;
    }
    return ack;
  }

  act(action: PlayerAction, clientSeq = ++this.seq): Promise<Ack<{ version: number }>> {
    return this.request(C2S.ACTION, { clientSeq, action });
  }

  get last(): StateMessage {
    const s = this.states.at(-1);
    if (!s) throw new Error("no state yet");
    return s;
  }

  get view(): PlayerView {
    return this.last.view;
  }

  /** Attend un état satisfaisant le prédicat (y compris le dernier déjà reçu). */
  waitFor(pred: (s: StateMessage) => boolean, timeoutMs = 4000): Promise<StateMessage> {
    const current = this.states.at(-1);
    if (current && pred(current)) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`waitFor timeout (phase ${this.states.at(-1)?.view.public.phase})`)), timeoutMs);
      this.waiters.push({ pred, resolve: (s) => (clearTimeout(timer), resolve(s)) });
    });
  }

  /** Pose une rune de sa main (de préférence sans choix à faire) dans son emplacement puis verrouille. */
  async castAny(): Promise<void> {
    const hand = this.view.private!.hand;
    const simple = (defId: string) => {
      const def = getCardDef(defId);
      const json = JSON.stringify(def.effects);
      return !def.unstable && !json.includes('"CHOSEN"') && !json.includes("CHOOSE_OPTION") && !json.includes('"CHOICE"');
    };
    const card = hand.find((c) => simple(c.defId)) ?? hand.find((c) => !getCardDef(c.defId).unstable) ?? hand[0]!;
    const slot = getCardDef(card.defId).slot ?? "AMORCE";
    const placed = await this.act({ type: "PLACE_RUNE", cardId: card.id, slot });
    if (!placed.ok) throw new Error(`place failed: ${placed.reason}`);
    const locked = await this.act({ type: "LOCK_SPELL" });
    if (!locked.ok) throw new Error(`lock failed: ${locked.reason}`);
  }

  close(): void {
    this.socket.close();
  }
}

export async function client(url: string): Promise<TestClient> {
  const c = new TestClient(url);
  await c.connected();
  return c;
}

/** Crée une partie à `n` joueurs et la démarre. Retourne les clients (le 1er est l'hôte). */
export async function startedGame(url: string, n = 2, extra: Record<string, unknown> = {}): Promise<TestClient[]> {
  const host = await client(url);
  const created = await host.create("Hôte", extra);
  if (!created.ok) throw new Error(created.reason);
  const others: TestClient[] = [];
  for (let i = 1; i < n; i++) {
    const c = await client(url);
    const j = await c.join(created.data.gameId, `Joueur${i + 1}`);
    if (!j.ok) throw new Error(j.reason);
    await c.act({ type: "SET_READY", ready: true });
    others.push(c);
  }
  const start = await host.act({ type: "START_GAME" });
  if (!start.ok) throw new Error(start.reason);
  const all = [host, ...others];
  await Promise.all(all.map((c) => c.waitFor((s) => s.view.public.phase === "PLANNING")));
  return all;
}

/** "OK" ou le motif de refus d'un accusé de réception. */
export function reason(ack: Ack<unknown>): string {
  return ack.ok ? "OK" : ack.reason;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
