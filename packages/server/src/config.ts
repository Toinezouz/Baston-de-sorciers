/**
 * Configuration du serveur, lue depuis les variables d'environnement.
 * Voir README.md § Variables d'environnement.
 */
import type { GameConfig } from "@baston/engine";

export interface ServerConfig {
  port: number;
  host: string;
  /** Origines autorisées (CORS) pour Socket.IO. `true` = toutes (pratique en développement). */
  corsOrigin: string[] | true;
  /** Durée pendant laquelle le siège d'un joueur déconnecté reste réservé. */
  seatReservationMs: number;
  /** Durée de conservation d'une partie terminée (consultation, reconnexion). */
  finishedGameTtlMs: number;
  /** Durée d'inactivité au-delà de laquelle une partie est supprimée. */
  idleGameTtlMs: number;
  /** Nombre maximal de parties simultanées. */
  maxGames: number;
  /** Limitation de débit par socket (seau à jetons). */
  rateLimit: { burst: number; perSecond: number };
  /** Dossier du client compilé à servir (production). Vide = pas de fichiers statiques. */
  staticDir: string | null;
  /** Surcharges de configuration des parties (tests, réglages de serveur). */
  gameOverrides: Partial<GameConfig>;
  logLevel: "debug" | "info" | "warn" | "error" | "silent";
}

function int(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const cors = env.CORS_ORIGIN?.trim();
  const overrides: Partial<GameConfig> = {};
  if (env.PLANNING_MS) overrides.planningMs = int(env.PLANNING_MS, 60_000);
  if (env.CHOICE_MS) overrides.choiceMs = int(env.CHOICE_MS, 20_000);
  return {
    port: int(env.PORT, 3001),
    host: env.HOST ?? "0.0.0.0",
    corsOrigin: !cors || cors === "*" ? true : cors.split(",").map((s) => s.trim()),
    seatReservationMs: int(env.SEAT_RESERVATION_MS, 120_000),
    finishedGameTtlMs: int(env.FINISHED_GAME_TTL_MS, 10 * 60_000),
    idleGameTtlMs: int(env.IDLE_GAME_TTL_MS, 2 * 60 * 60_000),
    maxGames: int(env.MAX_GAMES, 500),
    rateLimit: { burst: int(env.RATE_LIMIT_BURST, 30), perSecond: int(env.RATE_LIMIT_PER_SECOND, 15) },
    staticDir: env.STATIC_DIR?.trim() || null,
    gameOverrides: overrides,
    logLevel: (["debug", "info", "warn", "error", "silent"].includes(env.LOG_LEVEL ?? "") ? env.LOG_LEVEL : "info") as ServerConfig["logLevel"],
  };
}
