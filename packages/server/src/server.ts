/**
 * Serveur HTTP + Socket.IO.
 *
 * Routes HTTP :
 *   GET /health               → état du serveur
 *   GET /api/games/:code      → aperçu d'une partie (pour la page « rejoindre »)
 *   GET /*                    → client compilé (si STATIC_DIR), avec repli SPA sur index.html
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve, sep } from "node:path";
import { catalogVersion } from "@baston/engine";
import { PROTOCOL_VERSION, gameIdSchema } from "@baston/shared";
import { Server } from "socket.io";
import type { ServerConfig } from "./config";
import { createLogger, type Logger } from "./logger";
import { GameRegistry } from "./registry";
import { registerSocketHandlers } from "./socket";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".webmanifest": "application/manifest+json",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url ?? "/", "http://x");
  const rootAbs = resolve(root);
  let file = normalize(join(rootAbs, decodeURIComponent(url.pathname)));
  if (!file.startsWith(rootAbs + sep) && file !== rootAbs) return false; // traversée de répertoire
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(rootAbs, "index.html"); // repli SPA
  if (!existsSync(file)) return false;
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    "content-type": MIME[extname(file)] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
  return true;
}

export interface GameServer {
  http: HttpServer;
  io: Server;
  registry: GameRegistry;
  logger: Logger;
  listen(): Promise<number>;
  close(): Promise<void>;
}

export function createGameServer(config: ServerConfig): GameServer {
  const logger = createLogger(config.logLevel);
  const registry = new GameRegistry(config, logger);

  const http = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    if (url.pathname === "/health") return json(res, 200, { ok: true, games: registry.size, protocol: PROTOCOL_VERSION, catalog: catalogVersion() });
    const m = /^\/api\/games\/([^/]+)$/.exec(url.pathname);
    if (m) {
      const code = gameIdSchema.safeParse(decodeURIComponent(m[1]!));
      const room = code.success ? registry.get(code.data) : undefined;
      return room ? json(res, 200, { exists: true, ...room.summary() }) : json(res, 404, { exists: false });
    }
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "NOT_FOUND" });
    if (config.staticDir && serveStatic(config.staticDir, req, res)) return;
    json(res, 404, { error: "NOT_FOUND" });
  });

  const io = new Server(http, {
    cors: { origin: config.corsOrigin },
    pingInterval: 10_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 16 * 1024,
    serveClient: false,
  });
  registerSocketHandlers(io, registry, config, logger);
  registry.startSweeper();

  return {
    http,
    io,
    registry,
    logger,
    listen: () =>
      new Promise((ok) => {
        http.listen(config.port, config.host, () => {
          const port = (http.address() as AddressInfo).port;
          logger.info("server listening", { port, host: config.host });
          ok(port);
        });
      }),
    close: async () => {
      registry.closeAll();
      await new Promise<void>((ok) => io.close(() => ok()));
    },
  };
}
