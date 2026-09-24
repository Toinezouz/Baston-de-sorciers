/**
 * Simulation massive de parties entre bots : statistiques de rythme et d'équilibrage.
 *   npm run sim -- [parties=200] [joueurs=4]
 */
import { runBotGame } from "../test/helpers";

const games = Number(process.argv[2] ?? 200);
const players = Number(process.argv[3] ?? 4);

const t0 = performance.now();
let rounds = 0,
  turns = 0,
  steps = 0,
  guards = 0,
  suddenDeaths = 0;
const endReasons: Record<string, number> = {};
const castCount: Record<string, number> = {};
const winnerCast: Record<string, number> = {};

for (let i = 0; i < games; i++) {
  const { state, steps: st } = runBotGame({ players, seed: `sim-${players}-${i}` });
  steps += st;
  rounds += state.round;
  endReasons[state.endReason ?? "?"] = (endReasons[state.endReason ?? "?"] ?? 0) + 1;
  for (const ev of state.log) {
    if (ev.type === "TURN_STARTED") turns++;
    if (ev.type === "ENGINE_GUARD") guards++;
    if (ev.type === "SUDDEN_DEATH") suddenDeaths++;
    if (ev.type === "RUNE_RESOLVING") {
      const id = String(ev.data.defId);
      castCount[id] = (castCount[id] ?? 0) + 1;
      if (ev.sourceId === state.winnerId) winnerCast[id] = (winnerCast[id] ?? 0) + 1;
    }
  }
}
const ms = performance.now() - t0;
console.log(`${games} parties à ${players} joueurs en ${(ms / 1000).toFixed(1)} s (${(ms / games).toFixed(0)} ms/partie)`);
console.log(`Manches/partie : ${(rounds / games).toFixed(2)} — Tours/manche : ${(turns / rounds).toFixed(2)} — Actions/partie : ${(steps / games).toFixed(0)}`);
console.log(`Fins :`, endReasons, `— Garde-fous : ${guards} — Tours en mort subite : ${suddenDeaths}`);
console.log(`\nRunes : part jouée par le vainqueur (1/${players} = neutre)`);
for (const [id, n] of Object.entries(castCount).sort((a, b) => (winnerCast[b[0]] ?? 0) / b[1] - (winnerCast[a[0]] ?? 0) / a[1])) {
  console.log(`  ${((winnerCast[id] ?? 0) / n).toFixed(2)}  ${id} (${n})`);
}
