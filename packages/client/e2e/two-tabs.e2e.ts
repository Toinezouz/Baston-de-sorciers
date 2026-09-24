/**
 * Test de bout en bout : DEUX ONGLETS du même navigateur jouent l'un contre l'autre.
 * Critère d'acceptation fondamental du projet.
 *
 * Prérequis : `npm run build` (le serveur sert le client compilé) et un Chromium.
 * Lancement : `npm run test:e2e`
 */
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../server/src/config";
import { createGameServer, type GameServer } from "../../server/src/server";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const SHOTS = process.env.E2E_SCREENSHOTS;
const CHROMIUM = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

let server: GameServer;
let base: string;
let browser: Browser;

beforeAll(async () => {
  if (!existsSync(DIST)) throw new Error("Client non compilé : lancez `npm run build` d'abord.");
  server = createGameServer({
    ...loadConfig({}),
    port: 0,
    host: "127.0.0.1",
    logLevel: "silent",
    staticDir: DIST,
    seatReservationMs: 60_000,
    gameOverrides: { planningMs: 30_000, choiceMs: 10_000 },
  });
  base = `http://127.0.0.1:${await server.listen()}`;
  browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/** Joue un tour : pose une rune stable, lance le sort, répond aux choix éventuels. */
async function playTurn(page: Page) {
  const cast = page.getByRole("button", { name: /Lancer le sort/ });
  if (!(await cast.isVisible().catch(() => false))) return;
  if (await page.locator(".spell .rune").count() === 0) {
    const card = page.locator(".hand button.rune:not(.is-unstable):not(:disabled)").first();
    if (!(await card.count())) return;
    await card.click();
    // Attend la confirmation du serveur (la rune apparaît dans le sort).
    await page.locator(".spell .rune").first().waitFor({ timeout: 5000 }).catch(() => undefined);
  }
  if (await cast.isEnabled().catch(() => false)) await cast.click().catch(() => undefined);
}

async function answerChoices(page: Page) {
  const option = page.locator(".choice .choice-option").first();
  if (await option.isVisible().catch(() => false)) {
    await option.click().catch(() => undefined);
    const validate = page.getByRole("button", { name: /^Valider/ });
    if (await validate.isVisible().catch(() => false)) await validate.click().catch(() => undefined);
  }
}

const turnOf = async (page: Page) => Number((await page.locator(".game-meta").innerText()).match(/Tour (\d+)/)?.[1] ?? 0);

describe("deux onglets", () => {
  it("créent, rejoignent, jouent, se reconnectent et terminent une partie", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const a = await context.newPage();
    const b = await context.newPage();

    // 1. A crée une partie (mode rapide).
    await a.goto(base);
    await a.getByLabel("Ton pseudo de sorcier").fill("Alex");
    await a.getByLabel(/Rapide/).check();
    await a.getByRole("button", { name: "Créer la partie" }).click();
    const code = (await a.locator(".code").innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await shot(a, "1-lobby");

    // 2. B ouvre le lien d'invitation dans un AUTRE ONGLET du même navigateur.
    await b.goto(`${base}/partie/${code}`);
    await expect.poll(() => b.getByLabel("Code de la partie").inputValue()).toBe(code);
    await b.getByLabel("Ton pseudo de sorcier").fill("Marie");
    await b.getByRole("button", { name: "Rejoindre" }).click();
    await b.getByRole("button", { name: /Je suis prêt/ }).click();

    // 3. A voit Marie prête et lance.
    await a.getByText("prêt ✔").waitFor();
    await a.getByRole("button", { name: /Lancer la baston/ }).click();

    // 4. Chacun reçoit sa main.
    for (const p of [a, b]) await expect.poll(() => p.locator(".hand .rune").count()).toBe(6);
    await shot(a, "2-table");

    // 5–8. Chacun joue ; l'autre voit le résultat.
    await playTurn(a);
    await expect.poll(() => b.locator(".spell-status", { hasText: "prêt" }).count()).toBe(1); // B voit que A est prêt, sans voir ses runes
    await playTurn(b);
    for (const p of [a, b]) await expect.poll(() => turnOf(p), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => b.locator(".table-spell").count()).toBe(2);
    await expect.poll(() => a.locator(".log-line", { hasText: "lance" }).count()).toBeGreaterThan(0);
    await shot(b, "3-after-turn");

    // 13–15. B rafraîchit son onglet : il retrouve sa partie et sa main.
    await b.reload();
    await expect.poll(() => b.locator(".hand .rune").count(), { timeout: 10_000 }).toBeGreaterThan(0);
    expect(await b.locator(".player.is-me .player-name").innerText()).toContain("Marie");

    // B ferme son onglet ; A le voit déconnecté ; B revient dans un nouvel onglet (reprise via localStorage).
    await b.close();
    await a.locator(".opponents .dot-disconnected").waitFor({ timeout: 30_000 });
    await a.waitForTimeout(6500); // battement de cœur de l'onglet fermé devenu ancien
    const b2 = await context.newPage();
    await b2.goto(base);
    await expect.poll(() => b2.locator(".player.is-me .player-name").innerText().catch(() => ""), { timeout: 10_000 }).toContain("Marie");
    await a.locator(".opponents .dot-connected").waitFor();

    // 9–12. On joue jusqu'à la fin de la partie.
    for (let i = 0; i < 60; i++) {
      if (await a.locator(".gameover").isVisible().catch(() => false)) break;
      for (const p of [a, b2]) {
        await answerChoices(p);
        await playTurn(p);
      }
      await a.waitForTimeout(150);
    }
    await a.locator(".gameover").waitFor({ timeout: 15_000 });
    await b2.locator(".gameover").waitFor({ timeout: 15_000 });
    await shot(a, "4-game-over");
    const title = await a.locator(".gameover .modal-title").innerText();
    expect(title).toMatch(/Victoire|remporte/);

    // Retour à l'accueil.
    await a.getByRole("button", { name: "Retour à l'accueil" }).click();
    await a.getByRole("button", { name: "Créer la partie" }).waitFor();
    await context.close();
  }, 180_000);

  it("affichage mobile : la table tient dans un écran de téléphone", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto(base);
    await a.getByLabel("Ton pseudo de sorcier").fill("Téléphone");
    await a.getByRole("button", { name: "Créer la partie" }).click();
    const code = (await a.locator(".code").innerText()).trim();
    await b.goto(`${base}/partie/${code}`);
    await b.getByLabel("Ton pseudo de sorcier").fill("Autre");
    await b.getByRole("button", { name: "Rejoindre" }).click();
    await b.getByRole("button", { name: /Je suis prêt/ }).click();
    await a.getByRole("button", { name: /Lancer la baston/ }).click();
    await expect.poll(() => a.locator(".hand .rune").count()).toBe(8);
    // Pas de défilement horizontal de la page.
    const overflow = await a.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(a, "5-mobile");
    // Le journal s'ouvre en tiroir.
    await a.getByRole("button", { name: "Journal" }).tap();
    await a.locator(".log-panel.is-open").waitFor();
    await shot(a, "6-mobile-log");
    await context.close();
  }, 60_000);
});
