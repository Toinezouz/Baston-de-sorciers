/**
 * Connexion au serveur de jeu : Socket.IO, reprise automatique de session, file d'états.
 * Expose un magasin compatible avec `useSyncExternalStore`.
 */
import type { PlayerAction } from "@baston/engine";
import {
  C2S,
  S2C,
  type Ack,
  type CreateGameRequest,
  type KickedMessage,
  type SessionInfo,
  type StateMessage,
} from "@baston/shared";
import { io, type Socket } from "socket.io-client";
import { rejectMessage } from "./messages";
import { applyStateMessage, initialState, type ClientState, type Toast } from "./store";

/**
 * Stockage de la session :
 * - `sessionStorage` : la session de CET onglet (survit au rafraîchissement) ;
 * - `localStorage`   : la dernière session du navigateur, pour reprendre après une fermeture accidentelle.
 *   L'onglet propriétaire y écrit un battement de cœur : un autre onglet ne la reprend que si
 *   ce battement est ancien (onglet fermé). Ainsi deux onglets peuvent jouer l'un contre l'autre.
 */
const SESSION_KEY = "baston:session";
const HEARTBEAT_MS = 2000;
const STALE_AFTER_MS = 6000;

interface StoredSession {
  gameId: string;
  token: string;
  beat?: number;
}

function read(storage: Storage | undefined): StoredSession | null {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, s: StoredSession | null): void {
  try {
    if (s) storage?.setItem(SESSION_KEY, JSON.stringify(s));
    else storage?.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible (navigation privée) : la reprise ne marchera pas, le jeu oui */
  }
}

const tabStore = () => (typeof sessionStorage === "undefined" ? undefined : sessionStorage);
const browserStore = () => (typeof localStorage === "undefined" ? undefined : localStorage);

/** Session à reprendre au démarrage : celle de l'onglet, sinon une session orpheline du navigateur. */
function loadStored(): StoredSession | null {
  const own = read(tabStore());
  if (own) return own;
  const last = read(browserStore());
  if (last && Date.now() - (last.beat ?? 0) > STALE_AFTER_MS) return last;
  return null;
}

function saveStored(s: StoredSession): void {
  write(tabStore(), s);
  write(browserStore(), { ...s, beat: Date.now() });
}

function clearStored(token: string | undefined): void {
  write(tabStore(), null);
  const last = read(browserStore());
  if (last && last.token === token) write(browserStore(), null);
}

export class GameClient {
  private state: ClientState = initialState;
  private readonly listeners = new Set<() => void>();
  private readonly socket: Socket;
  private seq = 0;
  private toastId = 0;
  /** Vrai quand la socket est liée à une session côté serveur. */
  private bound = false;

  constructor(url?: string) {
    // Battement de cœur de l'onglet propriétaire de la session « navigateur ».
    setInterval(() => {
      const mine = read(tabStore());
      const last = read(browserStore());
      if (mine && last && last.token === mine.token) write(browserStore(), { ...last, beat: Date.now() });
    }, HEARTBEAT_MS);
    this.socket = io(url ?? "/", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 4000,
    });
    this.socket.on("connect", () => void this.onConnect());
    this.socket.on("disconnect", (reason) => {
      this.bound = false;
      this.set({ status: reason === "io client disconnect" ? "offline" : "reconnecting" });
    });
    this.socket.io.on("reconnect_attempt", () => this.set({ status: "reconnecting" }));
    this.socket.on(S2C.STATE, (msg: StateMessage) => {
      this.state = applyStateMessage(this.state, msg, Date.now());
      this.emit();
    });
    this.socket.on(S2C.KICKED, (msg: KickedMessage) => {
      this.bound = false;
      if (msg.reason === "GAME_CLOSED") clearStored(this.state.session?.token);
      else write(tabStore(), null); // session reprise ailleurs : cet onglet ne doit plus la réclamer
      this.set({ kicked: msg.reason, session: null, game: null, log: [] });
    });
  }

  // --- magasin -------------------------------------------------------------

  getSnapshot = (): ClientState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private set(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  toast(text: string, kind: Toast["kind"] = "error"): void {
    const t: Toast = { id: ++this.toastId, kind, text };
    this.set({ toasts: [...this.state.toasts, t].slice(-4) });
    setTimeout(() => this.dismissToast(t.id), 4500);
  }

  dismissToast(id: number): void {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  // --- connexion -----------------------------------------------------------

  private request<T>(event: string, payload?: unknown): Promise<Ack<T>> {
    return new Promise((resolve) => {
      if (!this.socket.connected) return resolve({ ok: false, reason: "SERVER_ERROR", message: rejectMessage("OFFLINE") });
      const timer = setTimeout(() => resolve({ ok: false, reason: "SERVER_ERROR", message: "Le serveur ne répond pas." }), 8000);
      this.socket.emit(event, payload, (ack: Ack<T>) => {
        clearTimeout(timer);
        resolve(ack);
      });
    });
  }

  private async onConnect(): Promise<void> {
    this.set({ status: "connected" });
    const stored = loadStored();
    if (!stored) return;
    const ack = await this.request<SessionInfo>(C2S.RESUME, { token: stored.token });
    if (ack.ok) this.adopt(ack.data);
    else {
      clearStored(stored.token);
      if (this.state.session) {
        this.set({ session: null, game: null, log: [] });
        this.toast("La partie n'est plus disponible.", "info");
      }
    }
  }

  private adopt(session: SessionInfo): void {
    this.bound = true;
    this.seq = Math.max(this.seq, session.lastClientSeq);
    saveStored({ gameId: session.gameId, token: session.token });
    this.set({ session, kicked: null });
  }

  async create(req: CreateGameRequest): Promise<boolean> {
    const ack = await this.request<SessionInfo>(C2S.CREATE, req);
    if (!ack.ok) return this.fail(ack.reason, ack.message);
    this.adopt(ack.data);
    return true;
  }

  async join(gameId: string, name: string): Promise<boolean> {
    const ack = await this.request<SessionInfo>(C2S.JOIN, { gameId, name });
    if (!ack.ok) return this.fail(ack.reason, ack.message);
    this.adopt(ack.data);
    return true;
  }

  /** Envoie une action de jeu ; les refus sont affichés en notification. */
  async act(action: PlayerAction): Promise<boolean> {
    if (!this.bound) return this.fail("OFFLINE");
    const ack = await this.request<{ version: number }>(C2S.ACTION, { clientSeq: ++this.seq, action });
    if (!ack.ok) return this.fail(ack.reason, ack.message);
    return true;
  }

  async leave(): Promise<void> {
    if (this.bound) await this.request(C2S.LEAVE);
    this.bound = false;
    clearStored(this.state.session?.token);
    this.set({ session: null, game: null, log: [], lastEvents: [], kicked: null });
  }

  async resync(): Promise<void> {
    if (this.bound) await this.request(C2S.SYNC);
  }

  private fail(reason: string, message?: string): false {
    this.toast(reason === "INVALID_PAYLOAD" && message ? message : rejectMessage(reason, message));
    return false;
  }
}
