/**
 * Projections de l'état pour les clients.
 *
 * Un joueur reçoit : l'état public + SA vue privée (main, sort en préparation, choix en attente).
 * Il ne reçoit jamais : la main des autres, leurs runes avant le dévoilement, l'ordre de la
 * pioche, l'état du générateur aléatoire, la file de résolution interne.
 */
import { getPlayer, handSizeOf, maxHpOf } from "./state/helpers";
import {
  RUNE_SLOTS,
  type CardDefId,
  type CardInstanceId,
  type ConnectionStatus,
  type GameConfig,
  type GameEvent,
  type GameState,
  type PendingChoice,
  type Phase,
  type PileId,
  type PlayerAction,
  type PlayerId,
  type RuneSlot,
  type StatusInstance,
  type Summon,
  type TimerSpec,
} from "./types";

export interface CardView {
  id: CardInstanceId;
  defId: CardDefId;
}

export interface PublicSpellView {
  slots: RuneSlot[];
  locked: boolean;
  revealed: boolean;
  fizzled: boolean;
  resolvedSlots: RuneSlot[];
  /** Présent uniquement après le dévoilement. */
  runes?: Partial<Record<RuneSlot, CardView>>;
}

export interface PublicPlayerView {
  id: PlayerId;
  name: string;
  seat: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  crowns: number;
  handCount: number;
  handSize: number;
  relics: CardView[];
  statuses: StatusInstance[];
  connection: ConnectionStatus;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
  spell: PublicSpellView | null;
  stats: { damageDealt: number; kills: number; roundsWon: number };
}

export interface PublicGameView {
  id: string;
  version: number;
  phase: Phase;
  suspendedPhase: Phase | null;
  config: GameConfig;
  round: number;
  turn: number;
  hostId: PlayerId | null;
  players: PublicPlayerView[];
  summons: Summon[];
  initiativeOrder: PlayerId[];
  activeCasterId: PlayerId | null;
  piles: Record<PileId, { draw: number; discard: number }>;
  timers: TimerSpec[];
  pendingChoice: { requestId: string; playerId: PlayerId; kind: PendingChoice["kind"]; prompt: string } | null;
  winnerId: PlayerId | null;
  endReason: GameState["endReason"];
}

export interface PrivatePlayerView {
  playerId: PlayerId;
  hand: CardView[];
  spell: Partial<Record<RuneSlot, CardView>>;
  pendingChoice: Omit<PendingChoice, "key"> | null;
  legalActions: PlayerAction["type"][];
}

export interface PlayerView {
  public: PublicGameView;
  private: PrivatePlayerView | null;
}

function cardView(state: GameState, id: CardInstanceId): CardView {
  return { id, defId: state.cards[id]!.defId };
}

function runesView(state: GameState, runes: Partial<Record<RuneSlot, CardInstanceId>>): Partial<Record<RuneSlot, CardView>> {
  const out: Partial<Record<RuneSlot, CardView>> = {};
  for (const slot of RUNE_SLOTS) {
    const id = runes[slot];
    if (id) out[slot] = cardView(state, id);
  }
  return out;
}

export function publicView(state: GameState): PublicGameView {
  const ts = state.turnState;
  return {
    id: state.id,
    version: state.version,
    phase: state.phase,
    suspendedPhase: state.suspendedPhase,
    config: state.config,
    round: state.round,
    turn: state.turn,
    hostId: state.hostId,
    players: state.seatOrder.map((pid) => {
      const p = getPlayer(state, pid);
      const spell = p.spell;
      return {
        id: p.id,
        name: p.name,
        seat: p.seat,
        hp: p.hp,
        maxHp: maxHpOf(state, pid),
        alive: p.alive,
        crowns: p.crowns,
        handCount: p.hand.length,
        handSize: handSizeOf(state, pid),
        relics: p.relics.map((id) => cardView(state, id)),
        statuses: structuredClone(p.statuses),
        connection: p.connection,
        ready: p.ready,
        isHost: state.hostId === pid,
        isBot: p.isBot,
        spell: spell
          ? {
              slots: RUNE_SLOTS.filter((s) => spell.runes[s]),
              locked: spell.locked,
              revealed: spell.revealed,
              fizzled: spell.fizzled,
              resolvedSlots: [...spell.resolvedSlots],
              ...(spell.revealed ? { runes: runesView(state, spell.runes) } : {}),
            }
          : null,
        stats: { ...p.stats },
      };
    }),
    summons: structuredClone(Object.values(state.summons).sort((a, b) => a.enteredAt - b.enteredAt)),
    initiativeOrder: ts ? [...ts.initiativeOrder] : [],
    activeCasterId: ts && ts.spellIndex >= 0 ? ts.initiativeOrder[ts.spellIndex] ?? null : null,
    piles: {
      GRIMOIRE: { draw: state.piles.GRIMOIRE.draw.length, discard: state.piles.GRIMOIRE.discard.length },
      COFFRE: { draw: state.piles.COFFRE.draw.length, discard: state.piles.COFFRE.discard.length },
      OUTRE_TOMBE: { draw: state.piles.OUTRE_TOMBE.draw.length, discard: state.piles.OUTRE_TOMBE.discard.length },
    },
    timers: Object.values(state.timers).map((t) => ({ ...t })),
    pendingChoice: state.pendingChoice
      ? {
          requestId: state.pendingChoice.requestId,
          playerId: state.pendingChoice.playerId,
          kind: state.pendingChoice.kind,
          prompt: state.pendingChoice.prompt,
        }
      : null,
    winnerId: state.winnerId,
    endReason: state.endReason,
  };
}

export function legalActionTypes(state: GameState, playerId: PlayerId): PlayerAction["type"][] {
  const p = state.players[playerId];
  if (!p) return [];
  switch (state.phase) {
    case "LOBBY":
      return state.hostId === playerId ? ["SET_READY", "START_GAME", "LEAVE"] : ["SET_READY", "LEAVE"];
    case "PLANNING":
      if (!p.alive || !p.spell) return ["LEAVE"];
      return p.spell.locked ? ["UNLOCK_SPELL", "LEAVE"] : ["PLACE_RUNE", "REMOVE_RUNE", "LOCK_SPELL", "LEAVE"];
    case "AWAITING_CHOICE":
      return state.pendingChoice?.playerId === playerId ? ["CHOOSE", "LEAVE"] : ["LEAVE"];
    case "GAME_OVER":
      return ["LEAVE"];
    default:
      return ["LEAVE"];
  }
}

export function privateView(state: GameState, playerId: PlayerId): PrivatePlayerView | null {
  const p = state.players[playerId];
  if (!p) return null;
  const pending = state.pendingChoice?.playerId === playerId ? state.pendingChoice : null;
  let pendingView: PrivatePlayerView["pendingChoice"] = null;
  if (pending) {
    const { key: _key, ...rest } = pending;
    pendingView = structuredClone(rest);
  }
  return {
    playerId,
    hand: p.hand.map((id) => cardView(state, id)),
    spell: p.spell ? runesView(state, p.spell.runes) : {},
    pendingChoice: pendingView,
    legalActions: legalActionTypes(state, playerId),
  };
}

/** Vue complète pour un joueur (ou un spectateur si `playerId` est null). */
export function viewFor(state: GameState, playerId: PlayerId | null): PlayerView {
  return { public: publicView(state), private: playerId ? privateView(state, playerId) : null };
}

/** Filtre un événement pour un destinataire : les données privées ne sont fusionnées que pour les ayants droit. */
export function eventFor(ev: GameEvent, playerId: PlayerId | null): GameEvent {
  const { private: priv, ...rest } = ev;
  if (priv && playerId && priv.playerIds.includes(playerId)) return { ...rest, data: { ...rest.data, ...priv.data } };
  return { ...rest, data: { ...rest.data } };
}

export function eventsFor(events: GameEvent[], playerId: PlayerId | null): GameEvent[] {
  return events.map((e) => eventFor(e, playerId));
}
