import { describe, expect, it } from "vitest";
import { registerStatus } from "../src/cards/registry";
import { dispatch } from "../src/dispatch";
import { eventsFor, viewFor } from "../src/views";
import type { GameState, StatusInstance } from "../src/types";
import { act, assertCardConservation, castSpell, createLobby, createTestGame, giveRelic, hp, must, setHand, stackGrimoire } from "./helpers";

function addStatus(s: GameState, pid: string, defId: string, stacks = 1): void {
  const st: StatusInstance = { id: `test-${defId}-${pid}`, defId, sourceId: pid, stacks, remaining: "PERMANENT", appliedAt: 0 };
  s.players[pid]!.statuses.push(st);
}

function eventsOfTurn(s: GameState, type: string) {
  return s.log.filter((e) => e.type === type && e.round === s.round);
}

// Statut de test volontairement dangereux : renvoie TOUS les dégâts, sans protection anti-boucle.
registerStatus({
  id: "test-miroir-infini",
  name: "Miroir infini (test)",
  text: "Renvoie 1 dégât à chaque blessure.",
  polarity: "BUFF",
  stacking: "IGNORE",
  maxStacks: 1,
  defaultDuration: "PERMANENT",
  passives: [{ trigger: { on: "ON_DAMAGE_RECEIVED", filter: { otherIsFoe: true }, effects: [{ op: "DAMAGE", target: { sel: "EVENT_SOURCE" }, amount: 1 }] } }],
});

describe("dégâts, soins, protections", () => {
  it("une rune inflige des dégâts à la cible attendue", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p2")).toBe(19);
    expect(hp(s, "p1")).toBe(20);
    expect(s.phase).toBe("PLANNING");
    expect(s.turn).toBe(2);
    assertCardConservation(s);
  });

  it("le vol de vie soigne du montant réellement infligé", () => {
    let s = createTestGame(2);
    s.players.p1!.hp = 15;
    s = castSpell(s, "p1", { AMORCE: "rune.ombre.murmure-du-caveau" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p2")).toBe(18);
    expect(hp(s, "p1")).toBe(17);
  });

  it("l'Égide absorbe les dégâts et s'use", () => {
    let s = createTestGame(2);
    addStatus(s, "p2", "egide", 2);
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p2")).toBe(20);
    expect(s.players.p2!.statuses.find((x) => x.defId === "egide")?.stacks).toBe(1);
    expect(eventsOfTurn(s, "DAMAGE_PREVENTED")).toHaveLength(1);
  });

  it("les soins sont plafonnés aux PV max", () => {
    let s = createTestGame(2);
    s.players.p1!.hp = 19;
    s = castSpell(s, "p1", { AMORCE: "rune.seve.pousse-vivace" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p1")).toBe(20);
    expect(s.log.filter((e) => e.type === "HEAL").at(-1)?.amount).toBe(1);
  });

  it("modificateurs de relique : Plastron runique réduit les dégâts", () => {
    let s = createTestGame(2);
    giveRelic(s, "p2", "relic.plastron-runique");
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p2")).toBe(20);
  });
});

describe("résolution, initiative, dés", () => {
  it("le sort le plus court résout en premier", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { AMORCE: "rune.seve.pousse-vivace", TORSION: "rune.seve.seve-montante", FRAPPE: "rune.seve.fouet-de-liane" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    const order = s.log.find((e) => e.type === "INITIATIVE_SET")!.data.order as { playerId: string }[];
    expect(order.map((o) => o.playerId)).toEqual(["p2", "p1"]);
  });

  it("à nombre égal, l'initiative de la Frappe départage", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { FRAPPE: "rune.braise.cratere" }); // initiative 3
    s = castSpell(s, "p2", { FRAPPE: "rune.ether.rayon-astral" }); // initiative 11
    const order = s.log.find((e) => e.type === "INITIATIVE_SET")!.data.order as { playerId: string }[];
    expect(order.map((o) => o.playerId)).toEqual(["p2", "p1"]);
  });

  it("la Puissance lance un dé par rune de la même école", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue", TORSION: "rune.braise.attise", FRAPPE: "rune.braise.pluie-de-cendres" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    const roll = s.log.find((e) => e.type === "DICE_ROLLED" && e.sourceId === "p1")!;
    expect((roll.data.rolls as number[]).length).toBe(3);
  });

  it("Concentration : un sort d'une seule rune lance 2 dés de plus", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { FRAPPE: "rune.ether.rayon-astral" });
    s = castSpell(s, "p2", { AMORCE: "rune.seve.pousse-vivace", TORSION: "rune.seve.seve-montante", FRAPPE: "rune.seve.fouet-de-liane" });
    const rolls = (pid: string) => (s.log.find((e) => e.type === "DICE_ROLLED" && e.sourceId === pid)!.data.rolls as number[]).length;
    expect(rolls("p1")).toBe(3); // 1 rune d'Éther + 2 de Concentration
    expect(rolls("p2")).toBe(3); // 3 runes de Sève, pas de bonus
  });

  it("une rune instable est remplacée par la première rune compatible de la pioche", () => {
    let s = createTestGame(2);
    setHand(s, "p1", ["rune.instable"]);
    stackGrimoire(s, ["rune.seve.pousse-vivace", "rune.ether.rayon-astral"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: s.players.p1!.hand[0]!, slot: "FRAPPE" });
    s = act(s, "p1", { type: "LOCK_SPELL" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    const ev = s.log.find((e) => e.type === "RUNE_REPLACED")!;
    expect(ev.data.replacement).toBe("rune.ether.rayon-astral");
    expect(ev.data.flipped).toEqual(["rune.seve.pousse-vivace"]);
    assertCardConservation(s);
  });
});

describe("choix du joueur", () => {
  it("la résolution se suspend pour un choix de cible puis reprend", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.nuee-de-mites" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme" });
    expect(s.phase).toBe("AWAITING_CHOICE");
    const pc = s.pendingChoice!;
    expect(pc.playerId).toBe("p1");
    expect(pc.options.map((o) => o.id).sort()).toEqual(["p2", "p3"]);

    const wrong = dispatch(s, { playerId: "p2", action: { type: "CHOOSE", requestId: pc.requestId, optionIds: ["p3"] } });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe("NOT_YOUR_CHOICE");
    const invalid = dispatch(s, { playerId: "p1", action: { type: "CHOOSE", requestId: pc.requestId, optionIds: ["p1"] } });
    expect(invalid.ok).toBe(false);

    s = act(s, "p1", { type: "CHOOSE", requestId: pc.requestId, optionIds: ["p3"] });
    expect(s.phase).toBe("PLANNING");
    // Venin ×2 infligé en fin de tour.
    expect(hp(s, "p3")).toBe(18);
    expect(hp(s, "p2")).toBe(20);
  });

  it("un choix expiré est résolu automatiquement par le serveur", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { TORSION: "rune.ombre.nuee-de-mites" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme" });
    s = must(s, { system: { type: "TIMEOUT", timerId: s.pendingChoice!.timerId } });
    expect(s.phase).toBe("PLANNING");
    expect(s.log.find((e) => e.type === "CHOICE_MADE")!.data.auto).toBe(true);
    expect(hp(s, "p2") + hp(s, "p3")).toBe(38);
  });
});

describe("déclencheurs et garde-fous", () => {
  it("Épines renvoie les dégâts sans se renvoyer elles-mêmes", () => {
    let s = createTestGame(2);
    addStatus(s, "p1", "epines");
    addStatus(s, "p2", "epines");
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p2")).toBe(19);
    expect(hp(s, "p1")).toBe(19); // renvoi, mais pas de renvoi du renvoi
  });

  it("une boucle de déclencheurs A ↔ B est coupée par le garde-fou", () => {
    let s = createTestGame(2);
    addStatus(s, "p1", "test-miroir-infini");
    addStatus(s, "p2", "test-miroir-infini");
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(s.phase).toBe("PLANNING");
    expect(s.log.some((e) => e.type === "TRIGGER_SUPPRESSED")).toBe(true);
    expect(hp(s, "p2")).toBe(20 - 1 - 3);
    expect(hp(s, "p1")).toBe(20 - 3);
  });

  it("Brûlure agit deux fois puis expire", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { TORSION: "rune.braise.attise" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p2")).toBe(19);
    expect(hp(s, "p3")).toBe(19);
    for (const pid of ["p1", "p2", "p3"]) s = castSpell(s, pid, { AMORCE: "rune.ether.prisme" });
    expect(hp(s, "p2")).toBe(18);
    expect(s.players.p2!.statuses.some((x) => x.defId === "brulure")).toBe(false);
  });

  it("en duel, gauche et droite désignent le même adversaire (effet appliqué deux fois)", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { TORSION: "rune.braise.attise" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(s.players.p2!.statuses.find((x) => x.defId === "brulure")?.stacks).toBe(2);
    expect(hp(s, "p2")).toBe(18);
  });
});

describe("morts, manches, victoire", () => {
  it("un sorcier meurt, la manche s'arrête et le survivant gagne une Couronne", () => {
    let s = createTestGame(2);
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(s.players.p1!.crowns).toBe(1);
    expect(s.round).toBe(2);
    expect(s.phase).toBe("PLANNING");
    expect(s.players.p2!.alive).toBe(true);
    expect(s.players.p2!.hp).toBe(20);
    expect(s.log.some((e) => e.type === "GRUDGE_DRAWN" && e.targetId === "p2")).toBe(true);
    const died = s.log.find((e) => e.type === "PLAYER_DIED")!;
    expect(died.sourceId).toBe("p1");
    assertCardConservation(s);
  });

  it("le sort d'un sorcier mort avant son tour ne se résout pas", () => {
    let s = createTestGame(3);
    s.players.p2!.hp = 1;
    // p1 : 1 rune (plus rapide) tue p2 ; p2 : 2 runes, ne doit jamais résoudre.
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.seve.pousse-vivace", FRAPPE: "rune.ether.rayon-astral" });
    s = castSpell(s, "p3", { AMORCE: "rune.ether.prisme", TORSION: "rune.ether.dissipation" });
    // Dissipation demande une cible (p1 ou p2 selon qui est vivant) : un seul candidat possible → auto.
    expect(s.log.some((e) => e.type === "SPELL_FIZZLED" && e.sourceId === "p2")).toBe(true);
    expect(s.log.some((e) => e.type === "RUNE_RESOLVING" && e.sourceId === "p2")).toBe(false);
  });

  it("morts simultanées des derniers sorciers : manche nulle, aucune Couronne", () => {
    let s = createTestGame(2);
    s.players.p1!.hp = 1;
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", { FRAPPE: "rune.braise.cratere" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    const ended = s.log.find((e) => e.type === "ROUND_ENDED")!;
    expect(ended.data.winnerId).toBeNull();
    expect(s.players.p1!.crowns + s.players.p2!.crowns).toBe(0);
    expect(s.round).toBe(2);
  });

  it("deux Couronnes remportent la partie", () => {
    let s = createTestGame(2);
    s.players.p1!.crowns = 1;
    s.players.p2!.hp = 1;
    s = castSpell(s, "p1", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    expect(s.phase).toBe("GAME_OVER");
    expect(s.winnerId).toBe("p1");
    expect(s.endReason).toBe("CROWNS");
    const after = dispatch(s, { playerId: "p1", action: { type: "LOCK_SPELL" } });
    expect(after.ok).toBe(false);
  });
});

describe("validation des actions", () => {
  it("rejette les actions illégales sans modifier l'état", () => {
    const s = createTestGame(2);
    const snapshot = JSON.stringify(s);
    const opponentCard = s.players.p2!.hand[0]!;
    const cases: [Parameters<typeof dispatch>[1], string][] = [
      [{ playerId: "p1", action: { type: "PLACE_RUNE", cardId: opponentCard, slot: "AMORCE" } }, "CARD_NOT_IN_HAND"],
      [{ playerId: "p1", action: { type: "PLACE_RUNE", cardId: "c999999", slot: "AMORCE" } }, "CARD_NOT_IN_HAND"],
      [{ playerId: "p1", action: { type: "LOCK_SPELL" } }, "SPELL_EMPTY"],
      [{ playerId: "p1", action: { type: "START_GAME" } }, "WRONG_PHASE"],
      [{ playerId: "intrus", action: { type: "LOCK_SPELL" } }, "NOT_IN_GAME"],
      [{ playerId: "p1", action: { type: "CHOOSE", requestId: "req1", optionIds: ["p2"] } }, "WRONG_PHASE"],
      [{ system: { type: "TIMEOUT", timerId: "plan-0-0" } }, "STALE_TIMER"],
      [{ system: { type: "JOIN", playerId: "p9", name: "Tard" } }, "GAME_ALREADY_STARTED"],
      [{ playerId: "p1", action: { type: "REMOVE_RUNE", slot: "FRAPPE" } }, "INVALID_SLOT"],
    ];
    for (const [input, reason] of cases) {
      const r = dispatch(s, input);
      expect(r.ok, JSON.stringify(input)).toBe(false);
      if (!r.ok) expect(r.reason).toBe(reason);
    }
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("refuse une rune dans le mauvais emplacement et un double verrouillage", () => {
    let s = createTestGame(2);
    const [id] = setHand(s, "p1", ["rune.seve.pousse-vivace"]);
    const r = dispatch(s, { playerId: "p1", action: { type: "PLACE_RUNE", cardId: id!, slot: "FRAPPE" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_SLOT");
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: id!, slot: "AMORCE" });
    s = act(s, "p1", { type: "LOCK_SPELL" });
    const again = dispatch(s, { playerId: "p1", action: { type: "LOCK_SPELL" } });
    expect(again.ok).toBe(false);
  });

  it("lobby : limite de joueurs, pseudo invalide, hôte seul peut lancer", () => {
    let s = createLobby(2, "lobby", { maxPlayers: 3 });
    s = must(s, { system: { type: "JOIN", playerId: "p3", name: "Trois" } });
    const full = dispatch(s, { system: { type: "JOIN", playerId: "p4", name: "Quatre" } });
    expect(full.ok || full.reason).toBe("GAME_FULL");
    const bad = dispatch(createLobby(1), { system: { type: "JOIN", playerId: "x", name: "   " } });
    expect(bad.ok || bad.reason).toBe("INVALID_NAME");
    const notHost = dispatch(s, { playerId: "p2", action: { type: "START_GAME" } });
    expect(notHost.ok || notHost.reason).toBe("NOT_HOST");
    const notReady = dispatch(s, { playerId: "p1", action: { type: "START_GAME" } });
    expect(notReady.ok || notReady.reason).toBe("PLAYERS_NOT_READY");
  });
});

describe("informations cachées", () => {
  it("un joueur ne voit ni la main ni le sort non révélé des autres", () => {
    let s = createTestGame(2);
    const [id] = setHand(s, "p1", ["rune.braise.etincelle-tetue", "rune.ether.prisme", "rune.seve.ecorce"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: id!, slot: "AMORCE" });
    const v2 = viewFor(s, "p2");
    const p1pub = v2.public.players.find((p) => p.id === "p1")!;
    expect(p1pub.spell?.slots).toEqual(["AMORCE"]);
    expect(p1pub.spell?.runes).toBeUndefined();
    expect(p1pub.handCount).toBe(2);
    const json = JSON.stringify(v2);
    const secret = [...s.players.p1!.hand, id!];
    const visibleIds = new Set(json.match(/"c\d+"/g)?.map((x) => x.slice(1, -1)) ?? []);
    for (const cid of secret) expect(visibleIds.has(cid)).toBe(false);
    expect(json).not.toContain("rng");
    // Les événements privés ne fuient pas.
    const evs = eventsFor(s.log.filter((e) => e.type === "SPELL_UPDATED"), "p2");
    expect(JSON.stringify(evs)).not.toContain(id!);
    const own = eventsFor(s.log.filter((e) => e.type === "SPELL_UPDATED"), "p1");
    expect(JSON.stringify(own)).toContain(id!);
  });
});

describe("connexion", () => {
  it("déconnexion puis reconnexion : statut visible, état intact", () => {
    let s = createTestGame(2);
    const hand = [...s.players.p2!.hand];
    s = must(s, { system: { type: "CONNECTION", playerId: "p2", status: "DISCONNECTED" } });
    expect(viewFor(s, "p1").public.players.find((p) => p.id === "p2")!.connection).toBe("DISCONNECTED");
    s = must(s, { system: { type: "CONNECTION", playerId: "p2", status: "CONNECTED" } });
    expect(viewFor(s, "p2").private!.hand.map((c) => c.id)).toEqual(hand);
  });

  it("un abandon à deux joueurs termine la partie par forfait", () => {
    let s = createTestGame(2);
    s = castSpell(s, "p1", { AMORCE: "rune.ether.prisme" });
    s = must(s, { system: { type: "ABANDON", playerId: "p2" } });
    expect(s.phase).toBe("GAME_OVER");
    expect(s.winnerId).toBe("p1");
    expect(s.endReason).toBe("FORFEIT");
  });

  it("un abandon pendant la planification qui laisse un seul sorcier termine la manche aussitôt", () => {
    let s = createTestGame(2);
    const [id] = setHand(s, "p1", ["rune.seve.pousse-vivace", "rune.seve.ecorce"]);
    s = act(s, "p1", { type: "PLACE_RUNE", cardId: id!, slot: "AMORCE" }); // p1 n'a pas verrouillé
    s = must(s, { system: { type: "ABANDON", playerId: "p2" } });
    expect(s).toMatchObject({ phase: "GAME_OVER", winnerId: "p1", endReason: "FORFEIT" });
    expect(s.players.p1!.hand).toContain(id);
    assertCardConservation(s);
  });

  it("un abandon à trois joueurs laisse la partie continuer", () => {
    let s = createTestGame(3);
    s = castSpell(s, "p1", { AMORCE: "rune.ether.prisme" });
    s = castSpell(s, "p2", { AMORCE: "rune.ether.prisme" });
    s = must(s, { system: { type: "ABANDON", playerId: "p3" } });
    expect(s.phase).toBe("PLANNING");
    expect(s.turn).toBe(2);
    expect(s.players.p3!.alive).toBe(false);
  });
});
