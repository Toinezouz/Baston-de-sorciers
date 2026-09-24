/**
 * Registre des parties en mémoire et des jetons de session.
 *
 * Choix assumé : aucune base de données. Une partie dure quelques dizaines de minutes ;
 * un redémarrage du serveur termine les parties en cours (voir README § Déploiement).
 */
import { DEFAULT_CONFIG, QUICK_CONFIG, type PlayerId } from "@baston/engine";
import type { GameMode } from "@baston/shared";
import type { ServerConfig } from "./config";
import { newGameCode, newSeed } from "./ids";
import type { Logger } from "./logger";
import { Room } from "./room";

export interface TokenBinding {
  gameId: string;
  playerId: PlayerId;
}

export class GameRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly tokens = new Map<string, TokenBinding>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ServerConfig,
    private readonly logger: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  /** Crée une partie ; null si la capacité du serveur est atteinte. */
  create(mode: GameMode = "standard", maxPlayers?: number): Room | null {
    if (this.rooms.size >= this.config.maxGames) return null;
    let code = newGameCode();
    while (this.rooms.has(code)) code = newGameCode();
    const seed = newSeed();
    const base = mode === "quick" ? QUICK_CONFIG : DEFAULT_CONFIG;
    const room = new Room(
      code,
      seed,
      { ...base, ...(maxPlayers ? { maxPlayers } : {}), ...this.config.gameOverrides },
      { config: this.config, logger: this.logger, now: this.now, onSessionEnd: (r, token) => this.onSessionEnd(r, token) },
    );
    this.rooms.set(code, room);
    this.logger.info("game created", { gameId: code, seed, mode });
    return room;
  }

  get(gameId: string): Room | undefined {
    return this.rooms.get(gameId.toUpperCase());
  }

  bind(token: string, binding: TokenBinding): void {
    this.tokens.set(token, binding);
  }

  resolve(token: string): { room: Room; playerId: PlayerId } | null {
    const b = this.tokens.get(token);
    if (!b) return null;
    const room = this.rooms.get(b.gameId);
    if (!room || !room.sessions.has(b.playerId)) {
      this.tokens.delete(token);
      return null;
    }
    return { room, playerId: b.playerId };
  }

  get size(): number {
    return this.rooms.size;
  }

  private onSessionEnd(room: Room, token: string): void {
    this.tokens.delete(token);
    if (room.sessions.size === 0) this.remove(room, "all players left");
  }

  private remove(room: Room, why: string): void {
    room.close();
    this.rooms.delete(room.id);
    for (const [token, b] of this.tokens) if (b.gameId === room.id) this.tokens.delete(token);
    this.logger.info("game removed", { gameId: room.id, why });
  }

  /** Supprime les parties terminées depuis longtemps ou inactives. */
  sweep(): void {
    const t = this.now();
    for (const room of [...this.rooms.values()]) {
      if (room.finishedAt !== null && t - room.finishedAt > this.config.finishedGameTtlMs) this.remove(room, "finished");
      else if (t - room.lastActivity > this.config.idleGameTtlMs) this.remove(room, "idle");
    }
  }

  startSweeper(intervalMs = 60_000): void {
    this.sweeper = setInterval(() => this.sweep(), intervalMs);
    this.sweeper.unref?.();
  }

  closeAll(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const room of [...this.rooms.values()]) this.remove(room, "shutdown");
  }
}
