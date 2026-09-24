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
    botDelayMs: [50, 150],
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
    // Animations réduites : pas de rejeu animé, le test va droit au but.
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
    const a = await context.newPage();
    const b = await context.newPage();

    // 1. A crée une partie (mode rapide).
    await a.goto(base);
    await a.getByLabel("Ton pseudo de sorcier").fill("Alex");
    await a.getByRole("radio", { name: /Rapide/ }).check();
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

    // Revanche : A la lance, B reçoit la proposition et la rejoint ; tous deux se retrouvent au lobby.
    await a.getByRole("button", { name: /Revanche/ }).click();
    const newCode = (await a.locator(".code").innerText()).trim();
    expect(newCode).not.toBe(code);
    await b2.getByRole("button", { name: /Rejoindre la revanche de Alex/ }).click();
    await expect.poll(() => b2.locator(".code").innerText().catch(() => "")).toBe(newCode);
    await expect.poll(() => a.locator(".lobby-players li").count()).toBe(2);

    // Retour à l'accueil.
    await b2.getByRole("button", { name: "Quitter" }).click();
    await b2.getByRole("button", { name: "Créer la partie" }).waitFor();
    await context.close();
  }, 180_000);

  it("rejeu animé de la résolution, que l'on peut passer", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto(base);
    await a.getByLabel("Ton pseudo de sorcier").fill("Alex");
    await a.getByRole("button", { name: "Créer la partie" }).click();
    const code = (await a.locator(".code").innerText()).trim();
    await b.goto(`${base}/partie/${code}`);
    await b.getByLabel("Ton pseudo de sorcier").fill("Marie");
    await b.getByRole("button", { name: "Rejoindre" }).click();
    await b.getByRole("button", { name: /Je suis prêt/ }).click();
    await a.getByRole("button", { name: /Lancer la baston/ }).click();
    await expect.poll(() => a.locator(".hand .rune").count()).toBe(8);
    // Raccourcis clavier : « 1 » pose la première rune, Entrée lance le sort.
    await a.keyboard.press("1");
    await a.locator(".spell .rune").first().waitFor();
    await a.keyboard.press("Enter");
    await playTurn(b);
    await b.locator(".replay").waitFor();
    await expect.poll(() => b.locator(".replay-title").first().innerText()).toMatch(/Révélation|lance/);
    await shot(b, "7-replay");
    await b.getByRole("button", { name: /Passer/ }).click();
    await expect.poll(() => b.locator(".table-spell").count()).toBe(2);
    // Sans intervention, le rejeu se termine seul.
    await a.locator(".table-spell").first().waitFor({ timeout: 20_000 });
    await context.close();
  }, 60_000);

  it("partie solo contre 3 bots jusqu'à la victoire, illustrations et grimoire", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
    const a = await context.newPage();
    await a.goto(base);
    // Grimoire : plus de 100 cartes, toutes illustrées.
    await a.getByRole("button", { name: /Grimoire/ }).click();
    expect(await a.locator(".grimoire-title, .modal-title").first().innerText()).toMatch(/Grimoire — (\d{3}) cartes/);
    const runes = await a.locator(".grimoire .rune").count();
    expect(runes).toBeGreaterThan(80);
    expect(await a.locator(".grimoire .rune .card-art").count()).toBe(runes);
    await a.keyboard.press("Escape");
    // Partie solo.
    await a.getByLabel("Ton pseudo de sorcier").fill("Solo");
    await a.getByLabel("Mode").selectOption("quick");
    await a.getByRole("button", { name: /Jouer maintenant/ }).click();
    await expect.poll(() => a.locator(".opponents .player").count()).toBe(3);
    expect(await a.locator(".opponents .player-name", { hasText: "🤖" }).count()).toBe(3);
    for (let i = 0; i < 80; i++) {
      if (await a.locator(".gameover").isVisible().catch(() => false)) break;
      await answerChoices(a);
      await playTurn(a);
      await a.waitForTimeout(150);
    }
    await a.locator(".gameover").waitFor({ timeout: 20_000 });
    await shot(a, "8-solo-over");
    await context.close();
  }, 120_000);

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
    await a.getByRole("button", { name: "Journal", exact: true }).tap();
    await a.locator(".log-panel.is-open").waitFor();
    await shot(a, "6-mobile-log");
    await a.getByRole("button", { name: "Fermer le journal" }).tap();
    await a.locator(".log-panel.is-open").waitFor({ state: "detached" });
    await context.close();
  }, 60_000);
});
