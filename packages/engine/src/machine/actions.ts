/**
 * Validation et application des actions (joueurs et système).
 * Toute action illégale lève une `Rejection` : le dispatcher renvoie alors un refus
 * contrôlé et l'état n'est pas modifié.
 */
import { NAME_MAX_LENGTH } from "../constants";
import { reject } from "../errors";
import { answerChoice } from "../resolution/queue";
import { pickN } from "../rng";
import { emit } from "../state/events";
import { cardDef, getPlayer } from "../state/helpers";
import { RUNE_SLOTS, type GameState, type Player, type PlayerAction, type PlayerId, type SystemAction } from "../types";
import { abandonPlayer, autoLockAll, emptySpell, resumeAfterChoice, startGame } from "./phases";

function requirePhase(state: GameState, ...phases: GameState["phase"][]): void {
  if (!phases.includes(state.phase)) reject("WRONG_PHASE", `Action impossible pendant la phase ${state.phase}`);
}

function requireAliveCaster(state: GameState, p: Player) {
  requirePhase(state, "PLANNING");
  if (!p.alive) reject("PLAYER_DEAD");
  const spell = p.spell ?? (p.spell = emptySpell());
  return spell;
}

function publicSlots(p: Player) {
  return RUNE_SLOTS.filter((s) => p.spell?.runes[s]);
}

function emitSpellUpdated(state: GameState, p: Player): void {
  const runes = Object.fromEntries(
    RUNE_SLOTS.filter((s) => p.spell?.runes[s]).map((s) => [s, { id: p.spell!.runes[s], defId: state.cards[p.spell!.runes[s]!]?.defId }]),
  );
  emit(state, {
    type: "SPELL_UPDATED",
    sourceId: p.id,
    data: { slots: publicSlots(p) },
    private: { playerIds: [p.id], data: { runes } },
  });
}

function removeFromLobby(state: GameState, pid: PlayerId): void {
  delete state.players[pid];
  state.seatOrder = state.seatOrder.filter((id) => id !== pid);
  state.seatOrder.forEach((id, i) => (getPlayer(state, id).seat = i));
  emit(state, { type: "PLAYER_LEFT", targetId: pid, data: {} });
  if (state.hostId === pid) {
    state.hostId = state.seatOrder[0] ?? null;
    if (state.hostId) emit(state, { type: "HOST_CHANGED", targetId: state.hostId, data: {} });
  }
}

/** Résout automatiquement le choix en attente (timeout, abandon) avec le RNG serveur. */
function autoAnswer(state: GameState): void {
  const pending = state.pendingChoice;
  if (!pending) return;
  answerChoice(state, pickN(state.rng, pending.options.map((o) => o.id), pending.min), true);
  resumeAfterChoice(state);
}

export function applyPlayerAction(state: GameState, playerId: PlayerId, action: PlayerAction): void {
  const p = state.players[playerId];
  if (!p) reject("NOT_IN_GAME");
  if (state.phase === "GAME_OVER" && action.type !== "LEAVE") reject("GAME_OVER");

  switch (action.type) {
    case "SET_READY": {
      requirePhase(state, "LOBBY");
      p.ready = action.ready;
      emit(state, { type: "PLAYER_READY", targetId: p.id, data: { ready: p.ready } });
      return;
    }

    case "START_GAME": {
      requirePhase(state, "LOBBY");
      if (state.hostId !== playerId) reject("NOT_HOST");
      if (state.seatOrder.length < state.config.minPlayers) reject("NOT_ENOUGH_PLAYERS");
      const notReady = state.seatOrder.filter((id) => id !== playerId && !getPlayer(state, id).ready);
      if (notReady.length) reject("PLAYERS_NOT_READY");
      for (const id of state.seatOrder) getPlayer(state, id).ready = true;
      startGame(state);
      return;
    }

    case "PLACE_RUNE": {
      const spell = requireAliveCaster(state, p);
      if (spell.locked) reject("SPELL_LOCKED");
      if (!RUNE_SLOTS.includes(action.slot)) reject("INVALID_SLOT");
      if (!p.hand.includes(action.cardId)) reject("CARD_NOT_IN_HAND");
      const def = cardDef(state, action.cardId);
      if (def.kind !== "RUNE") reject("CARD_NOT_IN_HAND");
      if (!def.unstable && def.slot !== action.slot) reject("INVALID_SLOT", `${def.name} va dans l'emplacement ${def.slot}`);
      const previous = spell.runes[action.slot];
      p.hand = p.hand.filter((id) => id !== action.cardId);
      if (previous) p.hand.push(previous);
      spell.runes[action.slot] = action.cardId;
      emitSpellUpdated(state, p);
      return;
    }

    case "REMOVE_RUNE": {
      const spell = requireAliveCaster(state, p);
      if (spell.locked) reject("SPELL_LOCKED");
      const cardId = spell.runes[action.slot];
      if (!cardId) reject("INVALID_SLOT", "Emplacement vide");
      delete spell.runes[action.slot];
      p.hand.push(cardId);
      emitSpellUpdated(state, p);
      return;
    }

    case "LOCK_SPELL": {
      const spell = requireAliveCaster(state, p);
      if (spell.locked) reject("SPELL_LOCKED");
      if (publicSlots(p).length === 0) reject("SPELL_EMPTY", "Un sort doit contenir au moins une rune");
      spell.locked = true;
      emit(state, { type: "SPELL_LOCKED", sourceId: p.id, data: { auto: false, slots: publicSlots(p) } });
      return;
    }

    case "UNLOCK_SPELL": {
      const spell = requireAliveCaster(state, p);
      if (!spell.locked) reject("SPELL_NOT_LOCKED");
      spell.locked = false;
      emit(state, { type: "SPELL_UNLOCKED", sourceId: p.id, data: {} });
      return;
    }

    case "CHOOSE": {
      requirePhase(state, "AWAITING_CHOICE");
      const pending = state.pendingChoice;
      if (!pending) reject("NO_PENDING_CHOICE");
      if (pending.requestId !== action.requestId) reject("STALE_REQUEST");
      if (pending.playerId !== playerId) reject("NOT_YOUR_CHOICE");
      const ids = action.optionIds;
      const legal = new Set(pending.options.map((o) => o.id));
      if (
        ids.length < pending.min ||
        ids.length > pending.max ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => legal.has(id))
      )
        reject("INVALID_CHOICE");
      answerChoice(state, ids, false);
      resumeAfterChoice(state);
      return;
    }

    case "LEAVE": {
      if (state.phase === "LOBBY") removeFromLobby(state, playerId);
      else if (state.phase !== "GAME_OVER") applySystemAction(state, { type: "ABANDON", playerId });
      return;
    }

    default:
      reject("UNKNOWN_ACTION");
  }
}

export function applySystemAction(state: GameState, action: SystemAction): void {
  switch (action.type) {
    case "JOIN": {
      if (state.phase !== "LOBBY") reject("GAME_ALREADY_STARTED");
      if (state.players[action.playerId]) reject("ALREADY_JOINED");
      const name = action.name.trim();
      if (!name || name.length > NAME_MAX_LENGTH) reject("INVALID_NAME");
      if (state.seatOrder.length >= state.config.maxPlayers) reject("GAME_FULL");
      state.players[action.playerId] = {
        id: action.playerId,
        name,
        seat: state.seatOrder.length,
        hp: state.config.startingHp,
        baseMaxHp: state.config.startingHp,
        alive: true,
        crowns: 0,
        hand: [],
        spell: null,
        relics: [],
        statuses: [],
        connection: "CONNECTED",
        ready: !!action.bot,
        isBot: !!action.bot,
        diedThisRound: false,
        killedBy: null,
        lastHitBy: null,
        stats: { damageDealt: 0, kills: 0, roundsWon: 0 },
      };
      state.seatOrder.push(action.playerId);
      if (!state.hostId) state.hostId = action.playerId;
      emit(state, { type: "PLAYER_JOINED", targetId: action.playerId, data: { name, seat: state.seatOrder.length - 1 } });
      return;
    }

    case "TIMEOUT": {
      const timer = state.timers[action.timerId];
      if (!timer) reject("STALE_TIMER");
      if (timer.kind === "PLANNING") {
        delete state.timers[timer.id];
        autoLockAll(state);
      } else {
        autoAnswer(state);
      }
      return;
    }

    case "CONNECTION": {
      const p = state.players[action.playerId];
      if (!p) reject("NOT_IN_GAME");
      if (p.connection === "ABANDONED" || p.connection === action.status) return;
      p.connection = action.status;
      emit(state, { type: "CONNECTION_CHANGED", targetId: p.id, data: { status: action.status } });
      return;
    }

    case "ABANDON": {
      const p = state.players[action.playerId];
      if (!p) reject("NOT_IN_GAME");
      if (state.phase === "LOBBY") {
        removeFromLobby(state, p.id);
        return;
      }
      if (state.phase === "GAME_OVER") return;
      abandonPlayer(state, p.id);
      if (state.pendingChoice?.playerId === p.id) autoAnswer(state);
      return;
    }
  }
}
