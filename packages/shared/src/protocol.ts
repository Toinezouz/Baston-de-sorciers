/**
 * Protocole client ↔ serveur (Socket.IO).
 *
 * Toutes les requêtes du client utilisent un accusé de réception (ack) Socket.IO :
 *   socket.emit(C2S.ACTION, payload, (ack: Ack<...>) => …)
 * Le serveur pousse l'état via S2C.STATE, à chaque changement et après une (re)connexion.
 *
 * Le client n'envoie JAMAIS de valeur de jeu (PV, dégâts…) : uniquement des intentions
 * portant des identifiants (carte, emplacement, option). L'identité du joueur est déduite
 * du jeton de session lié à la socket, jamais du contenu des messages.
 */
import type { GameEvent, PlayerAction, PlayerView, RejectReason } from "@baston/engine";

export const PROTOCOL_VERSION = 1;

/** Événements émis par le client. */
export const C2S = {
  CREATE: "game:create",
  JOIN: "game:join",
  RESUME: "game:resume",
  ACTION: "game:action",
  LEAVE: "game:leave",
  SYNC: "game:sync",
  /** Après la fin de partie : crée (ou rejoint) la partie de revanche. */
  REMATCH: "game:rematch",
  /** Lobby, hôte uniquement : ajouter / retirer un bot. */
  ADD_BOT: "game:add-bot",
  REMOVE_BOT: "game:remove-bot",
} as const;

/** Événements émis par le serveur. */
export const S2C = {
  STATE: "game:state",
  KICKED: "game:kicked",
  REMATCH_OFFER: "game:rematch-offer",
} as const;

export type GameMode = "standard" | "quick";
export type BotLevelName = "facile" | "normal" | "difficile";

export interface AddBotRequest {
  level: BotLevelName;
}

export interface RemoveBotRequest {
  playerId: string;
}

export interface CreateGameRequest {
  name: string;
  mode?: GameMode;
  maxPlayers?: number;
}

export interface JoinGameRequest {
  gameId: string;
  name: string;
}

export interface ResumeRequest {
  token: string;
}

export interface ActionRequest {
  /** Numéro de séquence strictement croissant par session (idempotence). */
  clientSeq: number;
  action: PlayerAction;
}

/** Informations de session renvoyées à la création / jonction / reprise. */
export interface SessionInfo {
  gameId: string;
  playerId: string;
  /** Secret à conserver côté client (localStorage) pour reprendre la partie. */
  token: string;
  /** Dernier clientSeq accepté (pour reprendre la numérotation après reconnexion). */
  lastClientSeq: number;
}

export type ServerRejectReason =
  | RejectReason
  | "INVALID_PAYLOAD"
  | "GAME_NOT_FOUND"
  | "SESSION_INVALID"
  | "NOT_IN_A_GAME"
  | "ALREADY_IN_A_GAME"
  | "RATE_LIMITED"
  | "SERVER_FULL"
  | "DUPLICATE_ACTION"
  | "SERVER_ERROR";

export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; reason: ServerRejectReason; message?: string };

/** État poussé par le serveur à chaque joueur. */
export interface StateMessage {
  gameId: string;
  version: number;
  /** Vrai pour une synchronisation complète (connexion, reprise) : le client remplace son journal. */
  full: boolean;
  view: PlayerView;
  /** Événements (déjà filtrés pour ce joueur) depuis la version précédente, ou les derniers en cas de `full`. */
  events: GameEvent[];
  /** Échéances des minuteurs actifs (epoch ms, horloge serveur). */
  deadlines: Record<string, number>;
  /** Horloge serveur à l'envoi, pour corriger le décalage d'horloge du client. */
  serverTime: number;
}

/** Un joueur a lancé une revanche : les autres peuvent la rejoindre. */
export interface RematchOfferMessage {
  gameId: string;
  by: string;
}

export interface KickedMessage {
  reason: "SESSION_REPLACED" | "GAME_CLOSED";
}

/** Nombre d'événements renvoyés lors d'une synchronisation complète. */
export const FULL_SYNC_EVENTS = 150;
