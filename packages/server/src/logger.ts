import type { ServerConfig } from "./config";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const;

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

/** Journal structuré minimal (une ligne JSON par entrée). */
export function createLogger(level: ServerConfig["logLevel"]): Logger {
  const min = LEVELS[level];
  const log = (lvl: keyof typeof LEVELS, msg: string, data?: Record<string, unknown>) => {
    if (LEVELS[lvl] < min) return;
    const line = JSON.stringify({ t: new Date().toISOString(), lvl, msg, ...data });
    (lvl === "error" || lvl === "warn" ? console.error : console.log)(line);
  };
  return {
    debug: (m, d) => log("debug", m, d),
    info: (m, d) => log("info", m, d),
    warn: (m, d) => log("warn", m, d),
    error: (m, d) => log("error", m, d),
  };
}
