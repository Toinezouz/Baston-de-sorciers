/**
 * Analyse d'équilibrage par simulation (voir docs/06-equilibrage.md).
 *   npm run balance -- [parties=400]
 *
 * Quatre stratégies de bots s'affrontent à 4 joueurs (sièges tournants) :
 *   - aleatoire : 1 à 3 runes au hasard
 *   - mono      : sort le plus long possible dans UNE école (maximise les dés)
 *   - eclair    : une seule rune, de préférence une Frappe à forte initiative (joue vite)
 *   - duo       : deux runes de la même école si possible
 */
import { getCardDef } from "../src/cards/registry";
import { createGame } from "../src/state/create";
import { dispatch } from "../src/dispatch";
import { pick, randInt, seedFromString } from "../src/rng";
import { RUNE_SLOTS, SCHOOLS, type GameState, type PlayerAction, type RngState, type RuneSlot } from "../src/types";

type Strategy = "aleatoire" | "mono" | "eclair" | "duo" | "opportuniste";
/** STRATS=mono,opportuniste pour choisir les stratégies (4 joueurs par défaut, 2 pour un duel). */
const STRATEGIES: Strategy[] = (process.env.STRATS?.split(",") as Strategy[] | undefined) ?? ["aleatoire", "mono", "eclair", "duo"];

function spellFor(s: GameState, pid: string, strat: Strategy, rng: RngState): { cardId: string; slot: RuneSlot }[] {
  const hand = s.players[pid]!.hand.map((id) => ({ id, def: getCardDef(s.cards[id]!.defId) })).filter((c) => !c.def.unstable);
  if (!hand.length) {
    const any = s.players[pid]!.hand[0];
    return any ? [{ cardId: any, slot: "AMORCE" }] : [];
  }
  const bySlot = (cards: typeof hand) => {
    const out: { cardId: string; slot: RuneSlot }[] = [];
    for (const slot of RUNE_SLOTS) {
      const c = cards.find((x) => x.def.slot === slot);
      if (c) out.push({ cardId: c.id, slot });
    }
    return out;
  };
  switch (strat) {
    case "aleatoire": {
      const out: { cardId: string; slot: RuneSlot }[] = [];
      for (const slot of RUNE_SLOTS) {
        if (randInt(rng, 100) >= 60) continue;
        const cands = hand.filter((c) => c.def.slot === slot);
        if (cands.length) out.push({ cardId: pick(rng, cands).id, slot });
      }
      return out.length ? out : [{ cardId: hand[0]!.id, slot: hand[0]!.def.slot! }];
    }
    case "mono": {
      let best: { cardId: string; slot: RuneSlot }[] = [];
      for (const school of SCHOOLS) {
        const spell = bySlot(hand.filter((c) => c.def.schools.includes(school)));
        if (spell.length > best.length) best = spell;
      }
      return best;
    }
    case "duo": {
      for (const school of SCHOOLS) {
        const spell = bySlot(hand.filter((c) => c.def.schools.includes(school)));
        if (spell.length >= 2) return spell.slice(-2);
      }
      return bySlot(hand).slice(-2);
    }
    case "opportuniste": {
      // Un adversaire est à portée (≤ 4 PV) : Frappe la plus rapide seule pour l'achever avant qu'il n'agisse.
      const foes = s.seatOrder.filter((id) => id !== pid && s.players[id]!.alive);
      const lowFoe = foes.some((id) => s.players[id]!.hp <= 4);
      const frappes = hand.filter((c) => c.def.slot === "FRAPPE").sort((a, b) => (b.def.initiative ?? 0) - (a.def.initiative ?? 0));
      if (lowFoe && frappes[0]) return [{ cardId: frappes[0].id, slot: "FRAPPE" }];
      return spellFor(s, pid, "mono", rng);
    }
    case "eclair": {
      const frappes = hand.filter((c) => c.def.slot === "FRAPPE").sort((a, b) => (b.def.initiative ?? 0) - (a.def.initiative ?? 0));
      const c = frappes[0] ?? hand[0]!;
      return [{ cardId: c.id, slot: c.def.slot! }];
    }
  }
}

function act(s: GameState, playerId: string, action: PlayerAction): GameState {
  const r = dispatch(s, { playerId, action });
  if (!r.ok) throw new Error(`${action.type}: ${r.reason}`);
  return r.state;
}

interface GameResult {
  state: GameState;
  strategies: Record<string, Strategy>;
}

function playGame(seed: string, strategies: Strategy[]): GameResult {
  let s = createGame({ id: "B", seed, config: FOCUS ? { focusDice: FOCUS } : {} });
  const map: Record<string, Strategy> = {};
  strategies.forEach((st, i) => {
    const pid = `p${i + 1}`;
    map[pid] = st;
    const r = dispatch(s, { system: { type: "JOIN", playerId: pid, name: `${st}-${i + 1}` } });
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  });
  for (let i = 2; i <= strategies.length; i++) s = act(s, `p${i}`, { type: "SET_READY", ready: true });
  s = act(s, "p1", { type: "START_GAME" });
  const rng = seedFromString(`${seed}:bots`);
  for (let guard = 0; s.phase !== "GAME_OVER" && guard < 20_000; guard++) {
    if (s.phase === "AWAITING_CHOICE") {
      const pc = s.pendingChoice!;
      // Choix raisonnable : cibler l'adversaire le plus affaibli, sinon la 1re option.
      const weakest = pc.options.filter((o) => s.players[o.id]).sort((a, b) => s.players[a.id]!.hp - s.players[b.id]!.hp)[0];
      s = act(s, pc.playerId, { type: "CHOOSE", requestId: pc.requestId, optionIds: [weakest?.id ?? pc.options[0]!.id].slice(0, pc.min) });
      continue;
    }
    const pending = s.seatOrder.find((pid) => s.players[pid]!.alive && s.players[pid]!.spell && !s.players[pid]!.spell!.locked);
    if (!pending) {
      const t = Object.keys(s.timers)[0];
      if (!t) throw new Error(`bloqué en ${s.phase}`);
      s = dispatch(s, { system: { type: "TIMEOUT", timerId: t } }).ok ? (dispatch(s, { system: { type: "TIMEOUT", timerId: t } }) as { state: GameState }).state : s;
      continue;
    }
    const plan = spellFor(s, pending, map[pending]!, rng);
    if (!plan.length) {
      s = dispatch(s, { system: { type: "TIMEOUT", timerId: Object.keys(s.timers)[0]! } }).ok
        ? (dispatch(s, { system: { type: "TIMEOUT", timerId: Object.keys(s.timers)[0]! } }) as { state: GameState }).state
        : s;
      continue;
    }
    for (const p of plan) s = act(s, pending, { type: "PLACE_RUNE", cardId: p.cardId, slot: p.slot });
    s = act(s, pending, { type: "LOCK_SPELL" });
  }
  return { state: s, strategies: map };
}

const games = Number(process.argv[2] ?? 400);
/** FOCUS=2,1,0 pour tester un bonus de Concentration. */
const FOCUS: [number, number, number] | null = process.env.FOCUS ? (process.env.FOCUS.split(",").map(Number) as [number, number, number]) : null;
if (FOCUS) console.log(`Concentration testée : ${FOCUS.join(" / ")} dé(s) bonus pour 1 / 2 / 3 runes`);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : "—");

// 1. Stratégies face à face (4 joueurs, rotation des sièges).
const wins: Record<string, number> = Object.fromEntries(STRATEGIES.map((s) => [s, 0]));
const seatWins = STRATEGIES.map(() => 0);
let draws = 0,
  rounds = 0,
  turns = 0,
  suddenTurns = 0,
  guardEvents = 0,
  maxRoundEnds = 0,
  roundDraws = 0;
const bySize: Record<number, { spells: number; dmg: number }> = { 1: { spells: 0, dmg: 0 }, 2: { spells: 0, dmg: 0 }, 3: { spells: 0, dmg: 0 } };
const cardPlays: Record<string, number> = {};
const cardDamage: Record<string, number> = {};

for (let g = 0; g < games; g++) {
  const order = STRATEGIES.map((_, i) => STRATEGIES[(i + g) % STRATEGIES.length]!);
  const { state, strategies } = playGame(`bal-${g}`, order);
  if (state.winnerId) {
    wins[strategies[state.winnerId]!]!++;
    seatWins[state.seatOrder.indexOf(state.winnerId)]!++;
  } else draws++;
  if (state.endReason === "MAX_ROUNDS") maxRoundEnds++;
  rounds += state.round;
  let currentSpell: { size: number; dmg: number } | null = null;
  let currentRune: string | null = null;
  for (const e of state.log) {
    if (e.type === "TURN_STARTED") turns++;
    if (e.type === "SUDDEN_DEATH") suddenTurns++;
    if (e.type === "ENGINE_GUARD") guardEvents++;
    if (e.type === "ROUND_ENDED" && !e.data.winnerId) roundDraws++;
    if (e.type === "SPELL_CAST") {
      if (currentSpell) {
        bySize[currentSpell.size]!.spells++;
        bySize[currentSpell.size]!.dmg += currentSpell.dmg;
      }
      currentSpell = { size: (e.data.runes as string[]).length, dmg: 0 };
    }
    if (e.type === "TURN_ENDING" && currentSpell) {
      bySize[currentSpell.size]!.spells++;
      bySize[currentSpell.size]!.dmg += currentSpell.dmg;
      currentSpell = null;
      currentRune = null;
    }
    if (e.type === "RUNE_RESOLVING") {
      currentRune = String(e.data.defId);
      cardPlays[currentRune] = (cardPlays[currentRune] ?? 0) + 1;
    }
    if (e.type === "DAMAGE" && currentRune && e.sourceId !== e.targetId) {
      if (currentSpell) currentSpell.dmg += e.amount ?? 0;
      cardDamage[currentRune] = (cardDamage[currentRune] ?? 0) + (e.amount ?? 0);
    }
  }
}

console.log(`\n=== ${games} parties à ${STRATEGIES.length} joueurs : ${STRATEGIES.join(", ")} (sièges tournants) ===`);
for (const s of STRATEGIES) console.log(`  ${s.padEnd(10)} victoires : ${pct(wins[s]!, games)}`);
console.log(`  parties sans vainqueur : ${pct(draws, games)} — fin à la limite de manches : ${pct(maxRoundEnds, games)}`);
console.log(`\nAvantage de siège : ${seatWins.map((w, i) => `siège ${i + 1} ${pct(w, games - draws)}`).join(" · ")}`);
console.log(`Rythme : ${(rounds / games).toFixed(2)} manches/partie, ${(turns / rounds).toFixed(1)} tours/manche, manches nulles ${pct(roundDraws, rounds)}, tours en mort subite ${pct(suddenTurns, turns)}`);
console.log(`Garde-fous déclenchés : ${guardEvents}`);
console.log(`\nDégâts adverses moyens par sort selon sa taille :`);
for (const n of [1, 2, 3]) console.log(`  ${n} rune(s) : ${(bySize[n]!.dmg / Math.max(1, bySize[n]!.spells)).toFixed(2)} (${bySize[n]!.spells} sorts, ${(bySize[n]!.dmg / Math.max(1, bySize[n]!.spells) / n).toFixed(2)} par rune)`);
console.log(`\nDégâts moyens par utilisation (runes offensives, ≥ 50 utilisations) :`);
Object.entries(cardDamage)
  .filter(([id]) => (cardPlays[id] ?? 0) >= 50)
  .map(([id, d]) => [id, d / cardPlays[id]!] as const)
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, avg]) => console.log(`  ${avg.toFixed(2).padStart(5)}  ${id} (${cardPlays[id]})`));
