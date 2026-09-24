/**
 * Couche temps réel : traduit les messages Socket.IO en appels au salon.
 *
 * Sécurité :
 * - chaque charge utile est validée par Zod (sinon INVALID_PAYLOAD) ;
 * - l'identité du joueur vient UNIQUEMENT de la session liée à la socket ;
 * - limitation de débit par socket ;
 * - toute exception est rattrapée et transformée en réponse contrôlée.
 */
import {
  C2S,
  actionRequestSchema,
  addBotSchema,
  removeBotSchema,
  createGameSchema,
  joinGameSchema,
  resumeSchema,
  type Ack,
  type SessionInfo,
} from "@baston/shared";
import type { Server, Socket } from "socket.io";
import type { ZodType } from "zod";
import type { ServerConfig } from "./config";
import type { Logger } from "./logger";
import { TokenBucket } from "./rateLimit";
import type { GameRegistry } from "./registry";
import type { PlayerSession, Room } from "./room";

export interface SocketSession {
  gameId: string;
  playerId: string;
}

type AckFn = (ack: Ack<unknown>) => void;

function invalid(message: string): Ack<never> {
  return { ok: false, reason: "INVALID_PAYLOAD", message };
}

export function registerSocketHandlers(io: Server, registry: GameRegistry, config: ServerConfig, logger: Logger): void {
  io.on("connection", (socket: Socket) => {
    socket.data.session = null as SocketSession | null;
    const bucket = new TokenBucket(config.rateLimit.burst, config.rateLimit.perSecond);

    /** Enveloppe commune : ack obligatoire, débit, validation, erreurs. */
    function on<T>(event: string, schema: ZodType<T, any, any> | null, handler: (payload: T) => Promise<Ack<unknown>>): void {
      socket.on(event, async (payload: unknown, ack: unknown) => {
        if (typeof ack !== "function") return; // protocole : toujours avec accusé de réception
        const reply = ack as AckFn;
        if (!bucket.take()) return reply({ ok: false, reason: "RATE_LIMITED" });
        let data: T = undefined as T;
        if (schema) {
          const parsed = schema.safeParse(payload);
          if (!parsed.success) return reply(invalid(parsed.error.issues[0]?.message ?? "Invalid payload"));
          data = parsed.data;
        }
        try {
          reply(await handler(data));
        } catch (err) {
          logger.error("handler error", { event, message: err instanceof Error ? err.message : String(err) });
          reply({ ok: false, reason: "SERVER_ERROR" });
        }
      });
    }

    function current(): { room: Room; playerId: string } | null {
      const s = socket.data.session as SocketSession | null;
      if (!s) return null;
      const room = registry.get(s.gameId);
      if (!room || !room.sessions.has(s.playerId)) {
        socket.data.session = null;
        return null;
      }
      return { room, playerId: s.playerId };
    }

    async function enter(room: Room, session: PlayerSession): Promise<Ack<SessionInfo>> {
      registry.bind(session.token, { gameId: room.id, playerId: session.playerId });
      socket.data.session = { gameId: room.id, playerId: session.playerId } satisfies SocketSession;
      await room.attach(session.playerId, socket);
      return { ok: true, data: { gameId: room.id, playerId: session.playerId, token: session.token, lastClientSeq: session.lastClientSeq } };
    }

    on(C2S.CREATE, createGameSchema, async (req) => {
      if (current()) return { ok: false, reason: "ALREADY_IN_A_GAME" };
      const room = registry.create(req.mode, req.maxPlayers);
      if (!room) return { ok: false, reason: "SERVER_FULL" };
      const joined = await room.join(req.name);
      if (!joined.ok) return joined;
      return enter(room, joined.data);
    });

    on(C2S.JOIN, joinGameSchema, async (req) => {
      if (current()) return { ok: false, reason: "ALREADY_IN_A_GAME" };
      const room = registry.get(req.gameId);
      if (!room) return { ok: false, reason: "GAME_NOT_FOUND" };
      const joined = await room.join(req.name);
      if (!joined.ok) return joined;
      return enter(room, joined.data);
    });

    on(C2S.RESUME, resumeSchema, async (req) => {
      const found = registry.resolve(req.token);
      if (!found) return { ok: false, reason: "SESSION_INVALID" };
      const cur = current();
      if (cur && (cur.room !== found.room || cur.playerId !== found.playerId)) return { ok: false, reason: "ALREADY_IN_A_GAME" };
      return enter(found.room, found.room.sessions.get(found.playerId)!);
    });

    on(C2S.ACTION, actionRequestSchema, async (req) => {
      const cur = current();
      if (!cur) return { ok: false, reason: "NOT_IN_A_GAME" };
      return cur.room.action(cur.playerId, req.clientSeq, req.action);
    });

    on(C2S.SYNC, null, async () => {
      const cur = current();
      if (!cur) return { ok: false, reason: "NOT_IN_A_GAME" };
      await cur.room.idle();
      cur.room.sendFull(cur.playerId);
      return { ok: true, data: undefined };
    });

    on(C2S.ADD_BOT, addBotSchema, async (req) => {
      const cur = current();
      if (!cur) return { ok: false, reason: "NOT_IN_A_GAME" };
      if (cur.room.state.hostId !== cur.playerId) return { ok: false, reason: "NOT_HOST" };
      return cur.room.addBot(req.level);
    });

    on(C2S.REMOVE_BOT, removeBotSchema, async (req) => {
      const cur = current();
      if (!cur) return { ok: false, reason: "NOT_IN_A_GAME" };
      if (cur.room.state.hostId !== cur.playerId) return { ok: false, reason: "NOT_HOST" };
      return cur.room.removeBot(req.playerId);
    });

    on(C2S.REMATCH, null, async () => {
      const cur = current();
      if (!cur) return { ok: false, reason: "NOT_IN_A_GAME" };
      const old = cur.room;
      if (old.state.phase !== "GAME_OVER") return { ok: false, reason: "WRONG_PHASE" };
      const name = old.state.players[cur.playerId]?.name ?? "Sorcier";
      let next = old.rematchId ? registry.get(old.rematchId) : undefined;
      const created = !next;
      if (!next) {
        next = registry.createWithConfig(old.state.config, "rematch") ?? undefined;
        if (!next) return { ok: false, reason: "SERVER_FULL" };
        old.rematchId = next.id;
        // Les bots suivent : même table, même niveau.
        for (const level of old.botLevels()) await next.addBot(level);
      }
      const joined = await next.join(name);
      if (!joined.ok) return joined;
      if (created) old.offerRematch({ gameId: next.id, by: name }, cur.playerId);
      await old.leave(cur.playerId);
      return enter(next, joined.data);
    });

    on(C2S.LEAVE, null, async () => {
      const cur = current();
      if (!cur) return { ok: false, reason: "NOT_IN_A_GAME" };
      await cur.room.leave(cur.playerId);
      socket.data.session = null;
      return { ok: true, data: undefined };
    });

    socket.on("disconnect", () => {
      const cur = current();
      if (cur) void cur.room.detach(cur.playerId, socket).catch(() => undefined);
    });
  });
}
