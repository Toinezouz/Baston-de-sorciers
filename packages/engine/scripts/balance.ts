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
import { planSpell, type SpellStrategy } from "../src/ai";
import { createGame } from "../src/state/create";
import { dispatch } from "../src/dispatch";
import { seedFromString } from "../src/rng";
import type { GameState, PlayerAction, RngState } from "../src/types";

type Strategy = SpellStrategy;
/** STRATS=mono,opportuniste pour choisir les stratégies (4 joueurs par défaut, 2 pour un duel). */
const STRATEGIES: Strategy[] = (process.env.STRATS?.split(",") as Strategy[] | undefined) ?? ["aleatoire", "mono", "eclair", "duo"];
const spellFor = (s: GameState, pid: string, strat: Strategy, rng: RngState) => planSpell(s, pid, strat, rng);

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
