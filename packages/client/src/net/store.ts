/**
 * État côté client, mis à jour de façon PURE à partir des messages du serveur.
 * Le client n'invente jamais d'état de jeu : il affiche la dernière vue reçue.
 */
import type { GameEvent } from "@baston/engine";
import type { SessionInfo, StateMessage } from "@baston/shared";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface Toast {
  id: number;
  kind: "error" | "info";
  text: string;
}

export interface ClientState {
  status: ConnectionStatus;
  session: SessionInfo | null;
  /** Dernier état reçu du serveur. */
  game: StateMessage | null;
  /** Journal cumulé (événements filtrés pour ce joueur). */
  log: GameEvent[];
  /** Événements du dernier message (pour les animations). */
  lastEvents: GameEvent[];
  /** Décalage horloge serveur − horloge locale (ms). */
  clockOffset: number;
  toasts: Toast[];
  kicked: "SESSION_REPLACED" | "GAME_CLOSED" | null;
  /** Revanche proposée par un autre joueur de la partie terminée. */
  rematchOffer: { gameId: string; by: string } | null;
  /** Vrai si le serveur annonce un protocole ou un catalogue différent de ce client (client périmé). */
  outdated: boolean;
}

export const MAX_LOG = 400;

export const initialState: ClientState = {
  status: "connecting",
  session: null,
  game: null,
  log: [],
  lastEvents: [],
  clockOffset: 0,
  toasts: [],
  kicked: null,
  rematchOffer: null,
  outdated: false,
};

/**
 * Intègre un état serveur. Les messages périmés (version ≤ courante, hors synchro complète)
 * sont ignorés : l'affichage ne peut jamais revenir en arrière.
 */
export function applyStateMessage(prev: ClientState, msg: StateMessage, localNow: number): ClientState {
  const current = prev.game;
  const sameGame = current?.gameId === msg.gameId;
  if (sameGame && !msg.full && msg.version <= current.version) return prev;
  const log = msg.full || !sameGame ? msg.events : [...prev.log, ...msg.events];
  return {
    ...prev,
    game: msg,
    log: log.length > MAX_LOG ? log.slice(-MAX_LOG) : log,
    lastEvents: msg.full ? [] : msg.events,
    clockOffset: msg.serverTime - localNow,
  };
}

/** Temps restant (ms) avant une échéance serveur, corrigé du décalage d'horloge. */
export function remainingMs(deadline: number, clockOffset: number, localNow: number): number {
  return Math.max(0, deadline - (localNow + clockOffset));
}
