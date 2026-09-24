import { allCardDefs } from "@baston/engine";
import { describe, expect, it } from "vitest";
import { CARD_ART, hashString } from "../src/art/cardArt";
import { EMBLEMS } from "../src/art/emblems";

describe("illustrations", () => {
  const cards = allCardDefs().filter((c) => c.copies > 0);

  it("plus de 100 cartes différentes, chacune avec une illustration dédiée", () => {
    expect(cards.length).toBeGreaterThan(100);
    const missing = cards.filter((c) => !CARD_ART[c.id]).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it("chaque emblème référencé existe", () => {
    for (const [id, [main, second]] of Object.entries(CARD_ART)) {
      expect(EMBLEMS[main], id).toBeDefined();
      if (second) expect(EMBLEMS[second], id).toBeDefined();
    }
  });

  it("aucune entrée orpheline, et chaque illustration est unique (emblèmes + graine)", () => {
    const ids = new Set(cards.map((c) => c.id));
    expect(Object.keys(CARD_ART).filter((id) => !ids.has(id))).toEqual([]);
    const signatures = new Set(Object.entries(CARD_ART).map(([id, [a, b]]) => `${a}|${b ?? ""}|${hashString(id) % 5}|${hashString(id) % 17}`));
    expect(signatures.size).toBe(Object.keys(CARD_ART).length);
  });
});
