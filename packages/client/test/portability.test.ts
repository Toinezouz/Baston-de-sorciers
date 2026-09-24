/**
 * Portabilité Windows / macOS : leurs systèmes de fichiers ignorent la casse.
 * Deux modules ne différant que par la casse (ex. `cardArt.ts` et `CardArt.tsx`) y entrent en collision :
 * le build casse, ou pire, le mauvais module est importé (écran blanc). Incident réel corrigé.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../..");
const SKIP = new Set(["node_modules", "dist", ".git", "coverage"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    if (SKIP.has(f)) return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("portabilité", () => {
  it("aucun fichier ni module ne diffère d'un autre seulement par la casse", () => {
    const files = [...walk(join(ROOT, "packages")), ...walk(join(ROOT, "docs"))].map((f) => relative(ROOT, f));
    const byKey = new Map<string, string[]>();
    for (const f of files) {
      // Clé insensible à la casse ET à l'extension de module (résolution des imports sans extension).
      const key = f.toLowerCase().replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
      byKey.set(key, [...(byKey.get(key) ?? []), f]);
    }
    const collisions = [...byKey.values()].filter((v) => v.length > 1);
    expect(collisions).toEqual([]);
  });
});
