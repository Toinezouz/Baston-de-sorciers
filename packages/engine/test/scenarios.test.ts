/**
 * Scénarios complets, dont les 15 critères d'acceptation du cahier des charges
 * vérifiés au niveau du moteur (le serveur ne fera que transporter ces actions).
 */
import { describe, expect, it } from "vitest";
import { botActions } from "../src/bot";
import { createGame } from "../src/state/create";
import { dispatch } from "../src/dispatch";
import { describeEvent } from "../src/format";
import { seedFromString } from "../src/rng";
import { eventsFor, viewFor } from "../src/views";
import type { DispatchInput, GameState } from "../src/types";
import { assertCardConservation, castSpell, must } from "./helpers";

describe("critères d'acceptation (moteur)", () => {
  it("scénarios 1 à 15", () => {
    // 1. Le joueur A crée une partie.
    let s = createGame({ id: "KRAB42", seed: "acceptance" });
    s = must(s, { system: { type: "JOIN", playerId: "A", name: "Alex" } });
    expect(s.hostId).toBe("A");
    // 2. Le joueur B rejoint.
    s = must(s, { system: { type: "JOIN", playerId: "B", name: "Marie" } });
    expect(viewFor(s, "A").public.players.map((p) => p.name)).toEqual(["Alex", "Marie"]);
    // 3. La partie démarre.
    s = must(s, { playerId: "B", action: { type: "SET_READY", ready: true } });
    s = must(s, { playerId: "A", action: { type: "START_GAME" } });
    expect(s.phase).toBe("PLANNING");
    // 4. Les joueurs reçoivent leurs cartes.
    expect(viewFor(s, "A").private!.hand).toHaveLength(8);
    expect(viewFor(s, "B").private!.hand).toHaveLength(8);
    // 5–6. Un joueur joue une carte ; le serveur valide (et refuse une carte qui n'est pas à lui).
    const stolen = dispatch(s, { playerId: "A", action: { type: "PLACE_RUNE", cardId: s.players.B!.hand[0]!, slot: "AMORCE" } });
    expect(stolen.ok).toBe(false);
    s.players.B!.hp = 3;
    s = castSpell(s, "A", { AMORCE: "rune.braise.etincelle-tetue", FRAPPE: "rune.braise.lance-incandescente" });
    // Tant que B n'a pas joué, B ne voit que le nombre de runes de A.
    const bView = viewFor(s, "B").public.players.find((p) => p.id === "A")!;
    expect(bView.spell).toMatchObject({ slots: ["AMORCE", "FRAPPE"], locked: true });
    expect(bView.spell!.runes).toBeUndefined();
    const before = s.log.length;
    s = castSpell(s, "B", { AMORCE: "rune.ether.prisme" });
    // 7. L'effet est résolu.
    const turnEvents = s.log.slice(before);
    expect(turnEvents.some((e) => e.type === "RUNE_RESOLVING" && e.sourceId === "A")).toBe(true);
    // 8. L'autre joueur voit immédiatement le résultat (événements filtrés pour B).
    const forB = eventsFor(turnEvents, "B");
    expect(forB.some((e) => e.type === "DAMAGE" && e.targetId === "B")).toBe(true);
    // 9. Les effets secondaires sont déclenchés (jet de Puissance puis dégâts du palier).
    expect(turnEvents.some((e) => e.type === "DICE_ROLLED" && e.sourceId === "A")).toBe(true);
    // 10. Un joueur meurt.
    expect(turnEvents.some((e) => e.type === "PLAYER_DIED" && e.targetId === "B")).toBe(true);
    // 11. Les conditions de victoire sont vérifiées : Couronne, nouvelle manche.
    expect(s.players.A!.crowns).toBe(1);
    expect(s.round).toBe(2);
    // 13. Un joueur se déconnecte : son siège reste, les autres le voient.
    s = must(s, { system: { type: "CONNECTION", playerId: "B", status: "DISCONNECTED" } });
    expect(viewFor(s, "A").public.players.find((p) => p.id === "B")!.connection).toBe("DISCONNECTED");
    const handBefore = viewFor(s, "B").private!.hand;
    // La partie continue sans lui : son temps expire.
    s = castSpell(s, "A", { AMORCE: "rune.ether.prisme" });
    s = must(s, { system: { type: "TIMEOUT", timerId: Object.keys(s.timers)[0]! } });
    expect(s.turn).toBe(2);
    // 14–15. Il se reconnecte et retrouve son état privé.
    s = must(s, { system: { type: "CONNECTION", playerId: "B", status: "CONNECTED" } });
    const vB = viewFor(s, "B");
    expect(vB.private!.hand).toHaveLength(8);
    expect(vB.public.players.find((p) => p.id === "B")!.connection).toBe("CONNECTED");
    expect(handBefore.length).toBe(8);
    // 12. La partie se termine proprement (seconde Couronne).
    s.players.B!.hp = 1;
    s.players.B!.statuses = []; // neutralise une éventuelle Rancune protectrice tirée au hasard
    s = castSpell(s, "A", { AMORCE: "rune.braise.etincelle-tetue" });
    s = castSpell(s, "B", { AMORCE: "rune.ether.prisme" });
    expect(s.phase).toBe("GAME_OVER");
    expect(s.winnerId).toBe("A");
    expect(s.log.at(-1)!.type).toBe("GAME_OVER");
    assertCardConservation(s);
    // Le journal est lisible de bout en bout.
    const names = (id: string | null | undefined) => (id ? s.players[id]?.name ?? id : "?");
    const lines = s.log.map((e) => describeEvent(e, names)).filter(Boolean);
    expect(lines).toContain("Alex remporte la baston !");
  });
});

describe("rejeu", () => {
  it("graine + liste d'actions ⇒ état final identique (replay)", () => {
    const record: DispatchInput[] = [];
    const seed = "replay-full";
    let s = createGame({ id: "R", seed });
    const apply = (input: DispatchInput) => {
      const r = dispatch(s, input);
      if (!r.ok) throw new Error(r.reason);
      record.push(input);
      s = r.state;
    };
    for (const pid of ["p1", "p2", "p3"]) apply({ system: { type: "JOIN", playerId: pid, name: pid } });
    apply({ playerId: "p2", action: { type: "SET_READY", ready: true } });
    apply({ playerId: "p3", action: { type: "SET_READY", ready: true } });
    apply({ playerId: "p1", action: { type: "START_GAME" } });
    const botRng = seedFromString("bots");
    let guard = 0;
    while (s.phase !== "GAME_OVER" && guard++ < 5000) {
      let acted = false;
      for (const pid of s.seatOrder) {
        for (const a of botActions(s, pid, botRng)) {
          apply({ playerId: pid, action: a });
          acted = true;
        }
        if (acted) break;
      }
      if (!acted) apply({ system: { type: "TIMEOUT", timerId: Object.keys(s.timers)[0]! } });
    }
    expect(s.phase).toBe("GAME_OVER");

    let replay = createGame({ id: "R", seed });
    for (const input of record) {
      const r = dispatch(replay, input);
      if (!r.ok) throw new Error(`replay diverged: ${r.reason}`);
      replay = r.state;
    }
    expect(JSON.stringify(replay)).toBe(JSON.stringify(s));
  });
});

describe("partie complète scriptée à 3 joueurs", () => {
  it("se joue jusqu'à la victoire avec des sorts variés", () => {
    let s: GameState = createGame({ id: "S3", seed: "scripted", config: { crownsToWin: 1 } });
    for (const pid of ["p1", "p2", "p3"]) s = must(s, { system: { type: "JOIN", playerId: pid, name: pid.toUpperCase() } });
    s = must(s, { playerId: "p2", action: { type: "SET_READY", ready: true } });
    s = must(s, { playerId: "p3", action: { type: "SET_READY", ready: true } });
    s = must(s, { playerId: "p1", action: { type: "START_GAME" } });

    // Tour 1 : p1 brûle ses voisins, p2 se protège, p3 invoque un golem.
    s = castSpell(s, "p1", { TORSION: "rune.braise.attise" });
    s = castSpell(s, "p2", { AMORCE: "rune.seve.ecorce" });
    s = castSpell(s, "p3", { TORSION: "rune.seve.appel-du-bosquet" });
    expect(Object.values(s.summons).map((x) => x.defId)).toEqual(["golem-de-mousse"]);
    // p3 subit sa Brûlure en fin de tour : le golem ne donne son Égide qu'après (même moment, siège suivant).
    expect(s.players.p3!.hp).toBe(19);

    // Tours suivants : p1 frappe fort jusqu'à ce qu'il ne reste qu'un sorcier.
    let turns = 0;
    while (s.phase !== "GAME_OVER" && turns++ < 30) {
      s = castSpell(s, "p1", { AMORCE: "rune.braise.soufflet-de-forge", FRAPPE: "rune.braise.pluie-de-cendres" });
      if (s.phase === "GAME_OVER") break;
      for (const pid of ["p2", "p3"]) {
        if (s.phase === "PLANNING" && s.players[pid]!.alive && !s.players[pid]!.spell?.locked)
          s = castSpell(s, pid, { AMORCE: "rune.ether.prisme" });
      }
      while (s.phase === "AWAITING_CHOICE") s = must(s, { system: { type: "TIMEOUT", timerId: s.pendingChoice!.timerId } });
    }
    expect(s.phase).toBe("GAME_OVER");
    expect(s.winnerId).toBe("p1");
    assertCardConservation(s);
  });
});
