import type { ServerRejectReason } from "@baston/shared";

/** Messages d'erreur lisibles pour les motifs de refus du serveur et du moteur. */
const MESSAGES: Partial<Record<ServerRejectReason | "OFFLINE", string>> = {
  OFFLINE: "Connexion perdue : action impossible pour le moment.",
  INVALID_PAYLOAD: "Requête invalide.",
  GAME_NOT_FOUND: "Aucune partie avec ce code.",
  SESSION_INVALID: "Ta session a expiré.",
  NOT_IN_A_GAME: "Tu n'es plus dans cette partie.",
  ALREADY_IN_A_GAME: "Tu es déjà dans une partie.",
  RATE_LIMITED: "Doucement ! Trop d'actions d'un coup.",
  SERVER_FULL: "Le serveur est plein, réessaie plus tard.",
  DUPLICATE_ACTION: "Action déjà prise en compte.",
  SERVER_ERROR: "Erreur du serveur.",
  ENGINE_ERROR: "Erreur interne du moteur : action annulée.",
  NOT_IN_GAME: "Tu ne fais pas partie de cette partie.",
  GAME_FULL: "La partie est complète.",
  ALREADY_JOINED: "Tu as déjà rejoint cette partie.",
  GAME_ALREADY_STARTED: "La partie a déjà commencé.",
  GAME_OVER: "La partie est terminée.",
  NOT_HOST: "Seul l'hôte peut lancer la partie.",
  NOT_ENOUGH_PLAYERS: "Il faut au moins 2 sorciers.",
  PLAYERS_NOT_READY: "Tous les sorciers ne sont pas prêts.",
  WRONG_PHASE: "Ce n'est pas le moment.",
  PLAYER_DEAD: "Tu es éliminé pour cette manche.",
  CARD_NOT_IN_HAND: "Cette rune n'est pas dans ta main.",
  INVALID_SLOT: "Cette rune ne va pas dans cet emplacement.",
  SPELL_EMPTY: "Ton sort doit contenir au moins une rune.",
  SPELL_LOCKED: "Ton sort est déjà verrouillé.",
  SPELL_NOT_LOCKED: "Ton sort n'est pas verrouillé.",
  NO_PENDING_CHOICE: "Aucun choix en attente.",
  NOT_YOUR_CHOICE: "Ce n'est pas à toi de choisir.",
  STALE_REQUEST: "Ce choix n'est plus d'actualité.",
  INVALID_CHOICE: "Choix invalide.",
  INVALID_NAME: "Pseudo invalide (1 à 20 caractères).",
  UNKNOWN_ACTION: "Action inconnue.",
};

export function rejectMessage(reason: string, fallback?: string): string {
  return MESSAGES[reason as ServerRejectReason] ?? fallback ?? `Action refusée (${reason}).`;
}
