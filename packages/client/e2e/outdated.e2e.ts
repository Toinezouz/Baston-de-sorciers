/**
 * Régression « écran blanc » : un client plus ancien que le serveur (catalogue différent)
 * ne doit JAMAIS afficher une page blanche. Il affiche un bandeau « Recharger » et remplace
 * les cartes inconnues par une carte « inconnue ».
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerCard } from "@baston/engine";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../server/src/config";
import { createGameServer, type GameServer } from "../../server/src/server";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const CHROMIUM = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
let server: GameServer;
let base: string;
let browser: Browser;

beforeAll(async () => {
  // Le serveur connaît une carte « du futur » que le client compilé ignore, en grand nombre.
  registerCard({
    id: "rune.futur.carte-inconnue",
    kind: "RUNE",
    slot: "AMORCE",
    schools: ["ETHER"],
    copies: 120,
    name: "Carte du futur",
    text: "Une carte que ce client ne connaît pas.",
    effects: [],
  });
  server = createGameServer({ ...loadConfig({}), port: 0, host: "127.0.0.1", logLevel: "silent", staticDir: DIST, botDelayMs: [50, 100] });
  base = `http://127.0.0.1:${await server.listen()}`;
  browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("client périmé", () => {
  it("bandeau de mise à jour, cartes inconnues affichées sans planter, jamais d'écran blanc", async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.locator(".outdated-banner").waitFor();
    await page.getByLabel("Ton pseudo de sorcier").fill("Retard");
    await page.getByRole("button", { name: /Jouer maintenant/ }).click();
    await expect.poll(() => page.locator(".hand .rune").count()).toBeGreaterThan(0);
    // La carte du futur apparaît comme « Carte inconnue », le reste de la table fonctionne.
    await expect.poll(() => page.locator(".rune", { hasText: "Carte inconnue" }).count(), { timeout: 5000 }).toBeGreaterThan(0);
    expect((await page.locator("#root").innerText()).trim().length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await page.close();
  }, 60_000);
});
