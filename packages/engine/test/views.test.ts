/**
 * Informations cachées : ce que chaque joueur peut (et ne peut pas) voir.
 */
import { describe, expect, it } from "vitest";
import { T } from "../src/cards/dsl";
import { eventsFor, legalActionTypes, viewFor } from "../src/views";
import type { GameState } from "../src/types";
import { act, castSpell, createLobby, createTestGame, runEffects, setHand } from "./helpers";

function cardIdsIn(json: string): Set<string> {
  return new Set(json.match(/"[ct]\d+"/g)?.map((x) => x.slice(1, -1)) ?? []);
}

describe("vues", () => {
  it("un spectateur ne reçoit aucune vue privée ni aucune carte en main", () => {
    const s = createTestGame(3);
    const v = viewFor(s, null);
    expect(v.private).toBeNull();
    const ids = cardIdsIn(JSON.stringify(v));
    for (const p of Object.values(s.players)) for (const id of p.hand) expect(ids.has(id)).toBe(false);
  });

  it("la pioche n'est exposée que par ses compteurs ; ni graine ni état du hasard", () => {
    const s = createTestGame(2);
    const json = JSON.stringify(viewFor(s, "p1"));
    expect(viewFor(s, "p1").public.piles.GRIMOIRE.draw).toBe(s.piles.GRIMOIRE.draw.length);
    for (const id of s.piles.GRIMOIRE.draw) expect(cardIdsIn(json).has(id)).toBe(false);
    expect(json).not.toContain(s.seed);
    expect(json).not.toMatch(/"rng"|"queue"|"answers"/);
  });

  it("chaque joueur voit sa propre main et son sort en préparation", () => {
    let s = createTestGame(2);
    const [a] = setHand(s, "p1", ["rune.seve.pousse-vivace", "rune.seve.ecorce"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: a!, slot: "AMORCE" });
    const v = viewFor(s, "p1").private!;
    expect(v.hand).toHaveLength(1);
    expect(v.spell.AMORCE?.id).toBe(a);
    expect(v.legalActions).toContain("LOCK_SPELL");
  });

  it("après le dévoilement, les runes de tous les sorts sont publiques", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.nuee-de-mites" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme" });
    expect(s.phase).toBe("AWAITING_CHOICE");
    const p1 = viewFor(s, "p3").public.players.find((p) => p.id === "p1")!;
    expect(p1.spell?.runes?.TORSION?.defId).toBe("rune.ombre.nuee-de-mites");
  });

  it("un choix en attente : options visibles du seul joueur concerné", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.nuee-de-mites" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme" });
    const mine = viewFor(s, "p1");
    const other = viewFor(s, "p2");
    expect(mine.private!.pendingChoice?.options).toHaveLength(2);
    expect(mine.private!.legalActions).toContain("CHOOSE");
    expect(other.private!.pendingChoice).toBeNull();
    expect(other.public.pendingChoice).toMatchObject({ playerId: "p1" });
    expect(JSON.stringify(other.public.pendingChoice)).not.toContain("options");
    const requested = s.log.find((e) => e.type === "CHOICE_REQUESTED")!;
    expect(eventsFor([requested], "p2")[0]!.data.options).toBeUndefined();
    expect(eventsFor([requested], "p1")[0]!.data.options).toBeDefined();
  });

  it("pioche et vol : le détail des cartes n'est visible que des joueurs concernés", () => {
    const s = createTestGame(3);
    const from = s.log.length;
    runEffects(s, "p1", [{ op: "DRAW", target: T.SELF, count: 1 }, { op: "STEAL_CARD", from: T.LEFT, count: 1 }]);
    const evs = s.log.slice(from);
    for (const [pid, sees] of [["p1", true], ["p2", true], ["p3", false]] as const) {
      const stolen = eventsFor(evs, pid).find((e) => e.type === "CARD_STOLEN")!;
      expect(Array.isArray(stolen.data.cards)).toBe(sees);
    }
    const drawn = (pid: string) => eventsFor(evs, pid).find((e) => e.type === "CARDS_DRAWN")!;
    expect(drawn("p1").data.cards).toBeDefined();
    expect(drawn("p2").data.cards).toBeUndefined();
    // Les événements filtrés ne contiennent jamais la clé `private`.
    expect(eventsFor(evs, "p3").some((e) => "private" in e)).toBe(false);
  });

  it("actions légales selon la phase et le rôle", () => {
    const lobby = createLobby(2);
    expect(legalActionTypes(lobby, "p1")).toContain("START_GAME");
    expect(legalActionTypes(lobby, "p2")).not.toContain("START_GAME");
    let s: GameState = createTestGame(2);
    s = castSpell(s, "p1", { AMORCE: "rune.ether.prisme" });
    expect(legalActionTypes(s, "p1")).toEqual(["UNLOCK_SPELL", "LEAVE"]);
    expect(legalActionTypes(s, "inconnu")).toEqual([]);
  });

  it("statut de connexion et hôte visibles de tous", () => {
    const s = createTestGame(2);
    const v = viewFor(s, "p2").public;
    expect(v.players.find((p) => p.id === "p1")!.isHost).toBe(true);
    expect(v.players.every((p) => p.connection === "CONNECTED")).toBe(true);
  });
});
