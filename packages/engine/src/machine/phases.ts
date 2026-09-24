/**
 * Machine à états de la partie.
 *
 *   LOBBY → ROUND_SETUP → TURN_START → PLANNING → REVEAL → RESOLUTION → TURN_END → ROUND_CHECK
 *                ↑                                    ⇅ AWAITING_CHOICE              │
 *                └──────────── ROUND_END ←───────────────────────────────────────────┤ (≤ 1 vivant)
 *                                  └→ GAME_OVER                 TURN_START ←─────────┘ (sinon)
 *
 * Chaque phase a une action d'entrée (`onEnter`, exécutée une seule fois) et une étape
 * (`onRun`) qui retourne la phase suivante, "WAIT" (attente d'une action joueur) ou
 * "SUSPENDED" (un choix est demandé pendant la résolution).
 * `advance` enchaîne les phases automatiques jusqu'à la prochaine attente.
 */
import { GUARDS } from "../constants";
import { EngineError } from "../errors";
import { killPlayer, finalizeDeaths } from "../resolution/deaths";
import { alivePlayerCount, drainQueue, enqueue, enqueueTriggersSince, makeTasks } from "../resolution/queue";
import { pick, randInt, shuffleInPlace } from "../rng";
import { emit } from "../state/events";
import {
  alivePlayers,
  cardDef,
  discardCard,
  drawFromPile,
  getPlayer,
  maxHpOf,
  refillHand,
  statusesOf,
  sumModifier,
} from "../state/helpers";
import { RUNE_SLOTS, type GameState, type Phase, type PlayerId, type RuneSlot, type Spell } from "../types";

type RunResult = Phase | "WAIT" | "SUSPENDED";

export function emptySpell(): Spell {
  return { runes: {}, locked: false, revealed: false, resolvedSlots: [], fizzled: false };
}

// ---------------------------------------------------------------------------
// Manche
// ---------------------------------------------------------------------------

function setupRound(state: GameState): void {
  state.round += 1;
  state.turn = 0;
  state.turnState = null;
  state.summons = {};
  state.delayed = [];
  state.queue = [];
  state.guards.perSpell = {};
  state.guards.perTurn = {};

  if (state.round === 1) {
    for (const pile of Object.values(state.piles)) shuffleInPlace(state.rng, pile.draw);
  }

  const grudgeRecipients: PlayerId[] = [];
  for (const pid of state.seatOrder) {
    const p = getPlayer(state, pid);
    if (p.diedThisRound && p.connection !== "ABANDONED") grudgeRecipients.push(pid);
    p.statuses = [];
    p.spell = null;
    p.alive = p.connection !== "ABANDONED";
    p.diedThisRound = false;
    p.lastHitBy = null;
    p.hp = p.alive ? maxHpOf(state, pid) : 0;
  }

  const logIndex = state.log.length;
  emit(state, { type: "ROUND_STARTED", data: { round: state.round, players: alivePlayers(state).map((p) => p.id) } });
  for (const p of alivePlayers(state)) refillHand(state, p.id);

  // Rancunes d'outre-tombe pour les sorciers morts lors de la manche précédente.
  for (const pid of grudgeRecipients) {
    const [cardId] = drawFromPile(state, "OUTRE_TOMBE", 1);
    if (!cardId) continue;
    const def = cardDef(state, cardId);
    emit(state, { type: "GRUDGE_DRAWN", targetId: pid, data: { card: cardId, defId: def.id } });
    enqueue(state, makeTasks(state, def.effects, { sourceId: pid, controllerId: pid, cardDefId: def.id, label: def.name }));
    discardCard(state, cardId);
  }
  enqueueTriggersSince(state, logIndex, null);
}

function endRound(state: GameState): void {
  const alive = alivePlayers(state);
  const winner = alive.length === 1 ? alive[0]! : null;
  if (winner) {
    winner.crowns += 1;
    winner.stats.roundsWon += 1;
    emit(state, { type: "CROWN_AWARDED", targetId: winner.id, data: { crowns: winner.crowns } });
    for (const relic of drawFromPile(state, "COFFRE", 1)) {
      winner.relics.push(relic);
      emit(state, { type: "RELIC_GAINED", targetId: winner.id, data: { card: relic, defId: state.cards[relic]?.defId } });
    }
  }
  // Manche nulle (tous morts simultanément, ou limite de tours) : aucune Couronne. [RULE D4]
  emit(state, {
    type: "ROUND_ENDED",
    data: { round: state.round, winnerId: winner?.id ?? null, reason: winner ? "LAST_STANDING" : alive.length === 0 ? "ALL_DEAD" : "TURN_LIMIT" },
  });
  // Nettoyage des éléments en jeu.
  for (const p of Object.values(state.players)) {
    if (p.spell) for (const id of Object.values(p.spell.runes)) if (id) discardCard(state, id);
    p.spell = null;
  }
  state.turnState = null;
}

/** Détermine si le match est terminé ; fixe `winnerId` / `endReason` le cas échéant. */
function checkMatchOver(state: GameState): boolean {
  const players = Object.values(state.players);
  const active = players.filter((p) => p.connection !== "ABANDONED");
  if (active.length <= 1) {
    state.winnerId = active[0]?.id ?? null;
    state.endReason = "FORFEIT";
    return true;
  }
  const champion = players.find((p) => p.crowns >= state.config.crownsToWin);
  if (champion) {
    state.winnerId = champion.id;
    state.endReason = "CROWNS";
    return true;
  }
  if (state.round >= state.config.maxRounds) {
    // Départage [RULE D5] : Couronnes, puis dégâts infligés ; sinon égalité.
    const ranked = [...active].sort((a, b) => b.crowns - a.crowns || b.stats.damageDealt - a.stats.damageDealt);
    const [first, second] = ranked;
    const tied = second && first && second.crowns === first.crowns && second.stats.damageDealt === first.stats.damageDealt;
    state.winnerId = tied ? null : first?.id ?? null;
    state.endReason = tied ? "DRAW" : "MAX_ROUNDS";
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tour
// ---------------------------------------------------------------------------

function startTurn(state: GameState): void {
  state.turn += 1;
  state.guards.perTurn = {};
  state.guards.perSpell = {};
  const logIndex = state.log.length;
  emit(state, { type: "TURN_STARTED", data: { turn: state.turn } });
  if (state.turn >= state.config.suddenDeathTurn) {
    // Mort subite [RULE D11] : perte de PV croissante, ignore protections et immunités.
    const amount = state.turn - state.config.suddenDeathTurn + 1;
    emit(state, { type: "SUDDEN_DEATH", amount, data: { amount } });
    const anchor = alivePlayers(state)[0];
    if (anchor) {
      enqueue(
        state,
        makeTasks(state, [{ op: "LOSE_HP", target: { sel: "ALL_PLAYERS" }, amount }], {
          sourceId: null,
          controllerId: anchor.id,
          label: "Mort subite",
        }),
      );
    }
  }
  enqueueTriggersSince(state, logIndex, null);
}

function startPlanning(state: GameState): void {
  for (const p of Object.values(state.players)) {
    p.spell = p.alive ? emptySpell() : null;
    // Main vide : le sorcier ne peut rien lancer, il est verrouillé d'office.
    if (p.spell && p.hand.length === 0) p.spell.locked = true;
  }
  const timerId = `plan-${state.round}-${state.turn}`;
  state.timers[timerId] = { id: timerId, kind: "PLANNING", durationMs: state.config.planningMs };
}

export function planningTimerId(state: GameState): string | undefined {
  return Object.values(state.timers).find((t) => t.kind === "PLANNING")?.id;
}

function allSpellsLocked(state: GameState): boolean {
  return alivePlayers(state).every((p) => p.spell?.locked);
}

/**
 * Fin du temps de planification [RULE D7] : les runes déjà posées sont lancées ;
 * un sorcier sans aucune rune posée lance une rune tirée au sort dans sa main.
 */
export function autoLockAll(state: GameState): void {
  for (const p of alivePlayers(state)) {
    const spell = p.spell ?? (p.spell = emptySpell());
    if (spell.locked) continue;
    const placed = RUNE_SLOTS.filter((s) => spell.runes[s]);
    if (placed.length === 0 && p.hand.length > 0) {
      const cardId = pick(state.rng, p.hand);
      const def = cardDef(state, cardId);
      // Rune instable : emplacement aléatoire. [RULE D22]
      const slot: RuneSlot = def.slot ?? (RUNE_SLOTS[randInt(state.rng, RUNE_SLOTS.length)] as RuneSlot);
      p.hand = p.hand.filter((id) => id !== cardId);
      spell.runes[slot] = cardId;
    }
    spell.locked = true;
    emit(state, { type: "SPELL_LOCKED", sourceId: p.id, data: { auto: true, slots: RUNE_SLOTS.filter((s) => spell.runes[s]) } });
  }
}

function reveal(state: GameState): void {
  const casters: PlayerId[] = [];
  const revealed: { playerId: PlayerId; runes: Partial<Record<RuneSlot, string>> }[] = [];
  for (const p of alivePlayers(state)) {
    const spell = p.spell;
    if (!spell) continue;
    for (const slot of RUNE_SLOTS) {
      const cardId = spell.runes[slot];
      if (!cardId || !cardDef(state, cardId).unstable) continue;
      // Rune instable : on retourne la pioche jusqu'à une rune stable de cet emplacement.
      const flipped: string[] = [];
      let replacement: string | null = null;
      for (let i = 0; i < GUARDS.MAX_UNSTABLE_FLIPS; i++) {
        const [c] = drawFromPile(state, "GRIMOIRE", 1);
        if (!c) break;
        const d = cardDef(state, c);
        if (!d.unstable && d.slot === slot) {
          replacement = c;
          break;
        }
        flipped.push(d.id);
        discardCard(state, c);
      }
      discardCard(state, cardId);
      if (replacement) spell.runes[slot] = replacement;
      else delete spell.runes[slot];
      emit(state, {
        type: "RUNE_REPLACED",
        sourceId: p.id,
        data: { slot, replacement: replacement ? state.cards[replacement]?.defId : null, flipped },
      });
    }
    spell.revealed = true;
    const runes: Partial<Record<RuneSlot, string>> = {};
    for (const slot of RUNE_SLOTS) {
      const id = spell.runes[slot];
      if (id) runes[slot] = state.cards[id]!.defId;
    }
    revealed.push({ playerId: p.id, runes });
    if (Object.keys(runes).length > 0) casters.push(p.id);
  }
  emit(state, { type: "SPELLS_REVEALED", data: { spells: revealed } });

  // Initiative [RULE D1] : moins de runes d'abord, puis initiative de la Frappe (+ modificateurs),
  // puis tirage serveur. Un tirage est fait pour chaque lanceur, dans l'ordre des sièges.
  const keyed = casters.map((pid) => {
    const spell = getPlayer(state, pid).spell!;
    const count = RUNE_SLOTS.filter((s) => spell.runes[s]).length;
    const frappe = spell.runes.FRAPPE;
    const initiative = (frappe ? cardDef(state, frappe).initiative ?? 0 : 0) + sumModifier(state, pid, "INITIATIVE");
    return { pid, count, initiative, roll: randInt(state.rng, 1_000_000) };
  });
  keyed.sort((a, b) => a.count - b.count || b.initiative - a.initiative || b.roll - a.roll);
  state.turnState = { initiativeOrder: keyed.map((k) => k.pid), spellIndex: -1 };
  emit(state, {
    type: "INITIATIVE_SET",
    data: { order: keyed.map((k) => ({ playerId: k.pid, runes: k.count, initiative: k.initiative })) },
  });
}

type NextStep = { kind: "RUNE"; playerId: PlayerId; slot: RuneSlot; cardId: string } | { kind: "CAST" } | null;

/** Avance le curseur de résolution : prochaine rune à résoudre, début d'un sort, ou fin. */
function nextStep(state: GameState): NextStep {
  const ts = state.turnState;
  if (!ts) return null;
  for (;;) {
    if (ts.spellIndex >= 0) {
      const pid = ts.initiativeOrder[ts.spellIndex]!;
      const p = getPlayer(state, pid);
      const spell = p.spell;
      if (spell && !spell.fizzled) {
        const slot = RUNE_SLOTS.find((s) => spell.runes[s] && !spell.resolvedSlots.includes(s));
        if (slot) {
          if (!p.alive) {
            // Lanceur mort avant ou pendant son sort : les runes restantes sont annulées. [RULE D6]
            spell.fizzled = true;
            emit(state, { type: "SPELL_FIZZLED", sourceId: pid, data: { reason: "CASTER_DEAD" } });
          } else {
            spell.resolvedSlots.push(slot);
            return { kind: "RUNE", playerId: pid, slot, cardId: spell.runes[slot]! };
          }
        }
      }
    }
    ts.spellIndex += 1;
    if (ts.spellIndex >= ts.initiativeOrder.length) return null;
    const pid = ts.initiativeOrder[ts.spellIndex]!;
    if (!getPlayer(state, pid).alive) continue; // l'annulation est journalisée au passage suivant
    state.guards.perSpell = {};
    const logIndex = state.log.length;
    const spell = getPlayer(state, pid).spell!;
    emit(state, {
      type: "SPELL_CAST",
      sourceId: pid,
      data: { runes: RUNE_SLOTS.filter((s) => spell.runes[s]).map((s) => state.cards[spell.runes[s]!]!.defId) },
    });
    enqueueTriggersSince(state, logIndex, pid);
    return { kind: "CAST" };
  }
}

function runResolution(state: GameState): RunResult {
  for (;;) {
    if (drainQueue(state) === "SUSPENDED") return "SUSPENDED";
    // Dès qu'il reste au plus un sorcier, les sorts restants ne sont pas lancés. [RULE D6]
    if (alivePlayerCount(state) <= 1) return "TURN_END";
    const step = nextStep(state);
    if (!step) return "TURN_END";
    if (step.kind === "CAST") continue;
    const def = cardDef(state, step.cardId);
    emit(state, { type: "RUNE_RESOLVING", sourceId: step.playerId, data: { slot: step.slot, defId: def.id } });
    enqueue(
      state,
      makeTasks(state, def.effects, {
        sourceId: step.playerId,
        controllerId: step.playerId,
        spellOwnerId: step.playerId,
        cardDefId: def.id,
        label: def.name,
      }),
    );
  }
}

function beginTurnEnd(state: GameState): void {
  state.guards.perSpell = {};
  const logIndex = state.log.length;
  emit(state, { type: "TURN_ENDING", data: { turn: state.turn } });
  enqueueTriggersSince(state, logIndex, null);
}

/** Décompte des durées, défausse des sorts, repioche. */
function cleanupTurn(state: GameState): void {
  const holders = [...alivePlayers(state).map((p) => p.id), ...Object.keys(state.summons)];
  for (const id of holders) {
    const list = statusesOf(state, id);
    for (const st of [...list]) {
      if (st.remaining === "PERMANENT") continue;
      st.remaining -= 1;
      if (st.remaining <= 0) {
        list.splice(list.indexOf(st), 1);
        emit(state, { type: "STATUS_EXPIRED", targetId: id, data: { status: st.defId } });
      }
    }
  }
  for (const p of Object.values(state.players)) {
    if (p.spell) for (const id of Object.values(p.spell.runes)) if (id) discardCard(state, id);
    p.spell = null;
  }
  state.turnState = null;
  for (const p of alivePlayers(state)) refillHand(state, p.id);
}

// ---------------------------------------------------------------------------
// Tables d'entrée / d'étape
// ---------------------------------------------------------------------------

const onEnter: Partial<Record<Phase, (s: GameState) => void>> = {
  ROUND_SETUP: setupRound,
  TURN_START: startTurn,
  PLANNING: startPlanning,
  REVEAL: reveal,
  TURN_END: beginTurnEnd,
  ROUND_END: endRound,
  GAME_OVER(state) {
    state.timers = {};
    state.pendingChoice = null;
    state.queue = [];
    emit(state, { type: "GAME_OVER", data: { winnerId: state.winnerId, reason: state.endReason } });
  },
};

const onRun: Record<Phase, (s: GameState) => RunResult> = {
  LOBBY: () => "WAIT",
  ROUND_SETUP: (s) => (drainQueue(s) === "SUSPENDED" ? "SUSPENDED" : "TURN_START"),
  TURN_START: (s) => {
    if (drainQueue(s) === "SUSPENDED") return "SUSPENDED";
    return alivePlayerCount(s) <= 1 ? "ROUND_CHECK" : "PLANNING";
  },
  PLANNING: (s) => {
    if (!allSpellsLocked(s)) return "WAIT";
    for (const t of Object.values(s.timers)) if (t.kind === "PLANNING") delete s.timers[t.id];
    return "REVEAL";
  },
  REVEAL: () => "RESOLUTION",
  RESOLUTION: runResolution,
  AWAITING_CHOICE: () => "WAIT",
  TURN_END: (s) => {
    if (drainQueue(s) === "SUSPENDED") return "SUSPENDED";
    cleanupTurn(s);
    return "ROUND_CHECK";
  },
  ROUND_CHECK: (s) => (alivePlayerCount(s) <= 1 || s.turn >= s.config.maxTurnsPerRound ? "ROUND_END" : "TURN_START"),
  ROUND_END: (s) => (checkMatchOver(s) ? "GAME_OVER" : "ROUND_SETUP"),
  GAME_OVER: () => "WAIT",
};

function setPhase(state: GameState, phase: Phase, entered: boolean): void {
  const from = state.phase;
  state.phase = phase;
  state.phaseEntered = entered;
  emit(state, { type: "PHASE_CHANGED", data: { from, to: phase } });
}

/** Enchaîne les phases automatiques jusqu'à ce qu'une action joueur soit nécessaire. */
export function advance(state: GameState): void {
  for (let i = 0; i < GUARDS.MAX_PHASE_TRANSITIONS; i++) {
    if (!state.phaseEntered) {
      state.phaseEntered = true;
      onEnter[state.phase]?.(state);
    }
    const result = onRun[state.phase](state);
    if (result === "WAIT") return;
    if (result === "SUSPENDED") {
      state.suspendedPhase = state.phase;
      setPhase(state, "AWAITING_CHOICE", true);
      return;
    }
    setPhase(state, result, false);
  }
  throw new EngineError("Too many automatic phase transitions");
}

/** Reprend la phase interrompue après la réponse à un choix. */
export function resumeAfterChoice(state: GameState): void {
  const back = state.suspendedPhase;
  if (!back) throw new EngineError("No suspended phase");
  state.suspendedPhase = null;
  setPhase(state, back, true);
}

/** Lance la partie depuis le lobby. */
export function startGame(state: GameState): void {
  emit(state, { type: "GAME_STARTED", data: { players: [...state.seatOrder] } });
  setPhase(state, "ROUND_SETUP", false);
}

/** Abandon définitif d'un sorcier en cours de partie (pas une « mort au combat » : aucun déclencheur). [RULE D20] */
export function abandonPlayer(state: GameState, pid: PlayerId): void {
  const p = getPlayer(state, pid);
  if (p.connection === "ABANDONED") return;
  p.connection = "ABANDONED";
  emit(state, { type: "CONNECTION_CHANGED", targetId: pid, data: { status: "ABANDONED" } });
  if (p.alive) {
    killPlayer(state, pid, "ABANDON", {});
    finalizeDeaths(state, [pid], {});
  }
  if (p.spell && !p.spell.locked) p.spell.locked = true;
}

