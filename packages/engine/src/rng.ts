/**
 * Générateur pseudo-aléatoire déterministe (sfc32), seedé par une chaîne.
 * L'état (4 entiers 32 bits) vit dans `GameState.rng` : il est cloné et sérialisé
 * avec la partie, ce qui rend toute partie rejouable à partir de (seed, actions).
 *
 * RÈGLE : le moteur n'utilise jamais l'aléatoire ni l'horloge du système (vérifié par un test).
 */
import type { RngState } from "./types";

/** Hachage cyrb128 : chaîne → 4 graines 32 bits. */
export function seedFromString(seed: string): RngState {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const state: RngState = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  // Chauffe du générateur.
  for (let i = 0; i < 12; i++) nextUint32(state);
  return state;
}

/** Avance l'état (muté en place) et retourne un entier non signé 32 bits. */
export function nextUint32(s: RngState): number {
  let [a, b, c, d] = s;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  s[0] = a >>> 0;
  s[1] = b >>> 0;
  s[2] = c >>> 0;
  s[3] = d >>> 0;
  return t >>> 0;
}

/** Entier uniforme dans [0, max). */
export function randInt(s: RngState, max: number): number {
  if (max <= 0) throw new Error("randInt: max must be > 0");
  return Math.floor((nextUint32(s) / 4294967296) * max);
}

export function rollD6(s: RngState): number {
  return randInt(s, 6) + 1;
}

/** Mélange de Fisher-Yates (en place). */
export function shuffleInPlace<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

export function pick<T>(s: RngState, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("pick: empty array");
  return arr[randInt(s, arr.length)] as T;
}

/** Tire `n` éléments distincts (ordre du tirage). */
export function pickN<T>(s: RngState, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  shuffleInPlace(s, copy);
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
}

export function weightedIndex(s: RngState, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return 0;
  let r = randInt(s, 1_000_000) / 1_000_000 * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i] ?? 0);
    if (r < 0) return i;
  }
  return weights.length - 1;
}
