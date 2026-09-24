/**
 * Salon : une partie en cours sur le serveur.
 *
 * - Détient l'état autoritaire (`GameState`) et le fait évoluer UNIQUEMENT via `dispatch`.
 * - Sérialise toutes les entrées (actions joueurs, minuteurs, connexions) dans une file
 *   de promesses : deux actions « simultanées » sont traitées l'une après l'autre, la seconde
 *   étant revalidée contre l'état produit par la première.
 * - Arme les minuteurs demandés par le moteur et lui renvoie `TIMEOUT` à l'échéance.
 * - Pousse à chaque joueur SA vue filtrée après chaque changement.
 */
import {
  BOT_NAMES,
  botDecide,
  createGame,
  seedFromString,
  type BotLevel,
  type RngState,
  dispatch,
  eventsFor,
  viewFor,
  type DispatchInput,
  type DispatchResult,
  type GameConfig,
  type GameEvent,
  type GameState,
  type PlayerAction,
  type PlayerId,
} from "@baston/engine";
import { FULL_SYNC_EVENTS, S2C, type Ack, type KickedMessage, type RematchOfferMessage, type StateMessage } from "@baston/shared";
import type { Socket } from "socket.io";
import type { ServerConfig } from "./config";
import { newPlayerId, newSeed, newSessionToken } from "./ids";
import type { Logger } from "./logger";

export interface PlayerSession {
  playerId: PlayerId;
  token: string;
  /** Dernier numéro de séquence traité et sa réponse (idempotence des renvois). */
  lastClientSeq: number;
  lastAck: Ack<{ version: number }> | null;
}

export interface RoomDeps {
  config: ServerConfig;
  logger: Logger;
  /** Appelé quand une session se termine définitivement (départ, abandon). */
  onSessionEnd(room: Room, token: string): void;
  now?: () => number;
}

export interface RoomSummary {
  gameId: string;
  phase: GameState["phase"];
  players: number;
  maxPlayers: number;
  joinable: boolean;
}

export class Room {
  state: GameState;
  readonly sessions = new Map<PlayerId, PlayerSession>();
  /** Historique des entrées acceptées : avec la graine, permet de rejouer la partie (debug). */
  readonly inputs: DispatchInput[] = [];
  lastActivity: number;
  finishedAt: number | null = null;
  closed = false;
  /** Partie de revanche créée depuis celle-ci. */
  rematchId: string | null = null;

  private readonly sockets = new Map<PlayerId, Socket>();
  private readonly timers = new Map<string, { handle: NodeJS.Timeout; deadline: number }>();
  private readonly reservations = new Map<PlayerId, NodeJS.Timeout>();
  /** Bots de la partie : niveau, générateur aléatoire propre, minuteur de réflexion. */
  readonly bots = new Map<PlayerId, { level: BotLevel; rng: RngState; timer: NodeJS.Timeout | null; acting: boolean }>();
  private chain: Promise<unknown> = Promise.resolve();
  private readonly now: () => number;

  constructor(
    readonly id: string,
    readonly seed: string,
    gameConfig: Partial<GameConfig>,
    private readonly deps: RoomDeps,
  ) {
    this.now = deps.now ?? Date.now;
    this.state = createGame({ id, seed, config: gameConfig });
    this.lastActivity = this.now();
  }

  // -------------------------------------------------------------------------
  // File séquentielle
  // -------------------------------------------------------------------------

  /** Exécute `fn` après toutes les opérations déjà en file (exclusion mutuelle par salon). */
  private enqueue<T>(fn: () => T): Promise<T> {
    const run = this.chain.then(() => {
      if (this.closed) throw new Error("ROOM_CLOSED");
      return fn();
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Applique une entrée au moteur ; en cas de succès, met à jour minuteurs et clients. */
  private apply(input: DispatchInput): DispatchResult {
    const r = dispatch(this.state, input);
    if (!r.ok) {
      if (r.reason === "ENGINE_ERROR") {
        // L'état n'a pas changé ; la graine et l'historique permettent de reproduire le bug.
        this.deps.logger.error("engine error", { gameId: this.id, seed: this.seed, inputs: this.inputs.length, input, message: r.message });
      }
      return r;
    }
    this.state = r.state;
    this.inputs.push(input);
    this.lastActivity = this.now();
    if (this.state.phase === "GAME_OVER" && this.finishedAt === null) {
      this.finishedAt = this.now();
      this.deps.logger.info("game over", { gameId: this.id, winner: this.state.winnerId, reason: this.state.endReason });
    }
    this.syncTimers();
    this.broadcast(r.events);
    this.scheduleBots();
    return r;
  }

  // -------------------------------------------------------------------------
  // Bots
  // -------------------------------------------------------------------------

  /** Un bot doit-il agir dans l'état courant ? */
  private botNeedsToAct(pid: PlayerId): boolean {
    const p = this.state.players[pid];
    if (!p) return false;
    if (this.state.phase === "AWAITING_CHOICE") return this.state.pendingChoice?.playerId === pid;
    return this.state.phase === "PLANNING" && p.alive && !!p.spell && !p.spell.locked;
  }

  /** Planifie la « réflexion » des bots qui ont quelque chose à faire. */
  private scheduleBots(): void {
    if (this.closed) return;
    const [min, max] = this.deps.config.botDelayMs;
    for (const [pid, bot] of this.bots) {
      if (bot.timer || bot.acting || !this.botNeedsToAct(pid)) continue;
      const choosing = this.state.phase === "AWAITING_CHOICE";
      const delay = Math.round((choosing ? 0.5 : 1) * (min + Math.random() * Math.max(0, max - min)));
      bot.timer = setTimeout(() => {
        bot.timer = null;
        void this.enqueue(() => {
          if (!this.bots.has(pid) || !this.botNeedsToAct(pid)) return;
          bot.acting = true;
          try {
            for (const action of botDecide(this.state, pid, bot.level, bot.rng)) {
              const r = this.apply({ playerId: pid, action });
              if (!r.ok) {
                this.deps.logger.warn("bot action rejected", { gameId: this.id, pid, action: action.type, reason: r.reason });
                break;
              }
            }
          } finally {
            bot.acting = false;
          }
          this.scheduleBots();
        }).catch(() => undefined);
      }, delay);
      bot.timer.unref?.();
    }
  }

  /** Ajoute un bot (lobby uniquement). */
  addBot(level: BotLevel): Promise<Ack<{ playerId: PlayerId }>> {
    return this.enqueue(() => {
      if (this.state.phase !== "LOBBY") return { ok: false as const, reason: "WRONG_PHASE" as const };
      const used = new Set(Object.values(this.state.players).map((p) => p.name));
      const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Automate ${this.bots.size + 1}`;
      const playerId = `bot_${newPlayerId().slice(3)}`;
      const r = this.apply({ system: { type: "JOIN", playerId, name, bot: true } });
      if (!r.ok) return { ok: false as const, reason: r.reason };
      this.bots.set(playerId, { level, rng: seedFromString(newSeed()), timer: null, acting: false });
      return { ok: true as const, data: { playerId } };
    });
  }

  /** Retire un bot (lobby uniquement). */
  removeBot(playerId: PlayerId): Promise<Ack<undefined>> {
    return this.enqueue(() => {
      const bot = this.bots.get(playerId);
      if (!bot) return { ok: false as const, reason: "NOT_IN_GAME" as const };
      if (this.state.phase !== "LOBBY") return { ok: false as const, reason: "WRONG_PHASE" as const };
      if (bot.timer) clearTimeout(bot.timer);
      this.bots.delete(playerId);
      this.apply({ system: { type: "ABANDON", playerId } });
      return { ok: true as const, data: undefined };
    });
  }

  /** Niveau de chaque bot (pour la revanche). */
  botLevels(): BotLevel[] {
    return [...this.bots.values()].map((b) => b.level);
  }

  // -------------------------------------------------------------------------
  // Minuteurs
  // -------------------------------------------------------------------------

  /** Aligne les minuteurs réels sur ceux demandés par le moteur. */
  private syncTimers(): void {
    for (const [id, t] of this.timers) {
      if (!this.state.timers[id]) {
        clearTimeout(t.handle);
        this.timers.delete(id);
      }
    }
    for (const spec of Object.values(this.state.timers)) {
      if (this.timers.has(spec.id)) continue;
      const handle = setTimeout(() => {
        void this.enqueue(() => {
          if (!this.timers.has(spec.id)) return;
          this.timers.delete(spec.id);
          this.apply({ system: { type: "TIMEOUT", timerId: spec.id } });
        }).catch(() => undefined);
      }, spec.durationMs);
      handle.unref?.();
      this.timers.set(spec.id, { handle, deadline: this.now() + spec.durationMs });
    }
  }

  private deadlines(): Record<string, number> {
    return Object.fromEntries([...this.timers].map(([id, t]) => [id, t.deadline]));
  }

  // -------------------------------------------------------------------------
  // Diffusion
  // -------------------------------------------------------------------------

  private message(playerId: PlayerId, events: GameEvent[], full: boolean): StateMessage {
    return {
      gameId: this.id,
      version: this.state.version,
      full,
      view: viewFor(this.state, playerId),
      events: eventsFor(events, playerId),
      deadlines: this.deadlines(),
      serverTime: this.now(),
    };
  }

  private broadcast(events: GameEvent[]): void {
    for (const [playerId, socket] of this.sockets) socket.emit(S2C.STATE, this.message(playerId, events, false));
  }

  /** Synchronisation complète d'un joueur (connexion, reprise, demande explicite). */
  sendFull(playerId: PlayerId): void {
    const socket = this.sockets.get(playerId);
    if (socket) socket.emit(S2C.STATE, this.message(playerId, this.state.log.slice(-FULL_SYNC_EVENTS), true));
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  /** Inscrit un nouveau joueur (lobby uniquement). */
  join(name: string): Promise<Ack<PlayerSession>> {
    return this.enqueue(() => {
      const playerId = newPlayerId();
      const r = this.apply({ system: { type: "JOIN", playerId, name } });
      if (!r.ok) return { ok: false as const, reason: r.reason, ...(r.message ? { message: r.message } : {}) };
      const session: PlayerSession = { playerId, token: newSessionToken(), lastClientSeq: 0, lastAck: null };
      this.sessions.set(playerId, session);
      this.deps.logger.info("player joined", { gameId: this.id, playerId });
      return { ok: true as const, data: session };
    });
  }

  /** Associe une socket à un joueur (connexion ou reprise) et lui envoie l'état complet. */
  attach(playerId: PlayerId, socket: Socket): Promise<void> {
    return this.enqueue(() => {
      const previous = this.sockets.get(playerId);
      if (previous && previous !== socket) {
        // Un seul appareil actif par siège : l'ancien est déconnecté de la partie.
        const kicked: KickedMessage = { reason: "SESSION_REPLACED" };
        previous.emit(S2C.KICKED, kicked);
        previous.data.session = null;
      }
      this.sockets.set(playerId, socket);
      const reservation = this.reservations.get(playerId);
      if (reservation) {
        clearTimeout(reservation);
        this.reservations.delete(playerId);
      }
      if (this.state.players[playerId]?.connection === "DISCONNECTED") {
        this.apply({ system: { type: "CONNECTION", playerId, status: "CONNECTED" } });
      }
      this.sendFull(playerId);
    });
  }

  /** Socket perdue : le joueur est marqué déconnecté et son siège est réservé un temps. */
  detach(playerId: PlayerId, socket: Socket): Promise<void> {
    return this.enqueue(() => {
      if (this.sockets.get(playerId) !== socket) return;
      this.sockets.delete(playerId);
      if (!this.sessions.has(playerId)) return;
      this.apply({ system: { type: "CONNECTION", playerId, status: "DISCONNECTED" } });
      const handle = setTimeout(() => {
        void this.enqueue(() => {
          this.reservations.delete(playerId);
          if (this.sockets.has(playerId) || !this.sessions.has(playerId)) return;
          this.deps.logger.info("seat reservation expired", { gameId: this.id, playerId });
          if (this.state.phase !== "GAME_OVER") this.apply({ system: { type: "ABANDON", playerId } });
          this.endSession(playerId);
        }).catch(() => undefined);
      }, this.deps.config.seatReservationMs);
      handle.unref?.();
      this.reservations.set(playerId, handle);
    });
  }

  /** Action d'un joueur, avec idempotence sur `clientSeq`. */
  action(playerId: PlayerId, clientSeq: number, action: PlayerAction): Promise<Ack<{ version: number }>> {
    return this.enqueue(() => {
      const session = this.sessions.get(playerId);
      if (!session) return { ok: false as const, reason: "SESSION_INVALID" as const };
      // Renvoi du même message (réseau instable) : on renvoie la même réponse sans rejouer l'action.
      if (clientSeq === session.lastClientSeq && session.lastAck) return session.lastAck;
      if (clientSeq <= session.lastClientSeq) return { ok: false as const, reason: "DUPLICATE_ACTION" as const };
      const r = this.apply({ playerId, action });
      const ack: Ack<{ version: number }> = r.ok
        ? { ok: true, data: { version: this.state.version } }
        : { ok: false, reason: r.reason, ...(r.message ? { message: r.message } : {}) };
      session.lastClientSeq = clientSeq;
      session.lastAck = ack;
      if (r.ok && action.type === "LEAVE") this.endSession(playerId);
      return ack;
    });
  }

  /** Départ volontaire (bouton « Quitter »). */
  leave(playerId: PlayerId): Promise<void> {
    return this.enqueue(() => {
      if (!this.sessions.has(playerId)) return;
      if (this.state.phase !== "GAME_OVER") this.apply({ playerId, action: { type: "LEAVE" } });
      this.endSession(playerId);
    });
  }

  private endSession(playerId: PlayerId): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    this.sessions.delete(playerId);
    const socket = this.sockets.get(playerId);
    if (socket) socket.data.session = null;
    this.sockets.delete(playerId);
    const reservation = this.reservations.get(playerId);
    if (reservation) clearTimeout(reservation);
    this.reservations.delete(playerId);
    this.deps.onSessionEnd(this, session.token);
  }

  // -------------------------------------------------------------------------
  // Divers
  // -------------------------------------------------------------------------

  /** Annonce la revanche aux joueurs encore présents. */
  offerRematch(offer: RematchOfferMessage, except: PlayerId): void {
    for (const [pid, socket] of this.sockets) if (pid !== except) socket.emit(S2C.REMATCH_OFFER, offer);
  }

  summary(): RoomSummary {
    return {
      gameId: this.id,
      phase: this.state.phase,
      players: this.state.seatOrder.length,
      maxPlayers: this.state.config.maxPlayers,
      joinable: this.state.phase === "LOBBY" && this.state.seatOrder.length < this.state.config.maxPlayers,
    };
  }

  connectedCount(): number {
    return this.sockets.size;
  }

  /** Attend que toutes les opérations en file soient traitées (tests, arrêt propre). */
  idle(): Promise<void> {
    return this.enqueue(() => undefined).catch(() => undefined);
  }

  close(reason: KickedMessage["reason"] = "GAME_CLOSED"): void {
    if (this.closed) return;
    this.closed = true;
    for (const t of this.timers.values()) clearTimeout(t.handle);
    for (const t of this.reservations.values()) clearTimeout(t);
    for (const b of this.bots.values()) if (b.timer) clearTimeout(b.timer);
    this.timers.clear();
    this.reservations.clear();
    for (const socket of this.sockets.values()) {
      socket.emit(S2C.KICKED, { reason } satisfies KickedMessage);
      socket.data.session = null;
    }
    this.sockets.clear();
  }
}
