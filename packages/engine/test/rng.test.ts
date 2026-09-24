import { describe, expect, it } from "vitest";
import { nextUint32, pickN, randInt, rollD6, seedFromString, shuffleInPlace, weightedIndex } from "../src/rng";

describe("générateur aléatoire seedé", () => {
  it("même graine ⇒ même séquence ; graines différentes ⇒ séquences différentes", () => {
    const a = seedFromString("abc");
    const b = seedFromString("abc");
    const c = seedFromString("abd");
    const seqA = Array.from({ length: 20 }, () => nextUint32(a));
    expect(Array.from({ length: 20 }, () => nextUint32(b))).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => nextUint32(c))).not.toEqual(seqA);
  });

  it("l'état est sérialisable et reprend à l'identique", () => {
    const a = seedFromString("serial");
    nextUint32(a);
    const copy = JSON.parse(JSON.stringify(a));
    expect(nextUint32(copy)).toBe(nextUint32(a));
  });

  it("d6 uniforme dans [1, 6]", () => {
    const s = seedFromString("dice");
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) counts[rollD6(s) - 1]!++;
    for (const n of counts) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });

  it("randInt borné et rejette un maximum invalide", () => {
    const s = seedFromString("int");
    for (let i = 0; i < 1000; i++) {
      const v = randInt(s, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
    expect(() => randInt(s, 0)).toThrow();
  });

  it("mélange = permutation ; tirage sans remise", () => {
    const s = seedFromString("shuffle");
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const shuffled = shuffleInPlace(s, [...arr]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(arr);
    expect(shuffled).not.toEqual(arr);
    const picked = pickN(s, arr, 10);
    expect(new Set(picked).size).toBe(10);
    expect(pickN(s, [1, 2], 5)).toHaveLength(2);
  });

  it("tirage pondéré : poids nuls jamais choisis, proportions respectées", () => {
    const s = seedFromString("weights");
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[weightedIndex(s, [0, 1, 2])]!++;
    expect(counts[0]).toBe(0);
    expect(Math.abs(counts[2]! / counts[1]! - 2)).toBeLessThan(0.15);
    expect(weightedIndex(s, [0, 0])).toBe(0);
  });
});
