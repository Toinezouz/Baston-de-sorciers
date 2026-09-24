/**
 * Intelligence des bots.
 *
 * Règle d'équité : un bot ne lit QUE ce qu'un joueur humain à sa place pourrait voir
 * (sa main, son sort, l'état public : PV, statuts, reliques…). Il ne consulte jamais la main
 * adverse, la pioche ni l'état du hasard. Il reçoit son propre générateur aléatoire (`rng`),
 * distinct de celui de la partie : ses décisions ne modifient pas le hasard du jeu.
 */
import { getCardDef } from "./cards/registry";
import { pick, pickN, randInt } from "./rng";
import {
  RUNE_SLOTS,
  SCHOOLS,
  type CardDefinition,
  type GameState,
  type PlayerAction,
  type PlayerId,
  type RngState,
  type RuneSlot,
} from "./types";

export type BotLevel = "facile" | "normal" | "difficile";
export const BOT_LEVELS: BotLevel[] = ["facile", "normal", "difficile"];

/** Stratégies de construction de sort (les niveaux en sont des combinaisons). */
export type SpellStrategy = "aleatoire" | "mono" | "duo" | "eclair" | "opportuniste" | "prudent";

export interface PlannedRune {
  cardId: string;
  slot: RuneSlot;
}

interface HandCard {
  id: string;
  def: CardDefinition;
}

/** La carte peut blesser son lanceur (perte de PV, dégâts sur « tous les sorciers », pari risqué). */
export function isSelfHarm(def: CardDefinition): boolean {
  const json = JSON.stringify(def.effects);
  return /"op":"LOSE_HP","target":\{"sel":"SELF"\}/.test(json) || json.includes('"sel":"ALL_PLAYERS"');
}

/** La carte soigne ou protège son lanceur. */
export function isDefensive(def: CardDefinition): boolean {
  const json = JSON.stringify(def.effects);
  return (
    /"op":"HEAL","target":\{"sel":"SELF"\}/.test(json) ||
    /"status":"(egide|carapace|intangible|regeneration)"/.test(json) ||
    json.includes('"polarity":"DEBUFF"')
  );
}

function handOf(state: GameState, pid: PlayerId): HandCard[] {
  return state.players[pid]!.hand.map((id) => ({ id, def: getCardDef(state.cards[id]!.defId) }));
}

/** Meilleure rune par emplacement parmi `cards`, en préférant `prefer` à égalité. */
function bySlot(cards: HandCard[], prefer?: (c: HandCard) => number): PlannedRune[] {
  const out: PlannedRune[] = [];
  for (const slot of RUNE_SLOTS) {
    const cands = cards.filter((c) => c.def.slot === slot);
    if (!cands.length) continue;
    const best = prefer ? [...cands].sort((a, b) => prefer(b) - prefer(a))[0]! : cands[0]!;
    out.push({ cardId: best.id, slot });
  }
  return out;
}

function monoSpell(cards: HandCard[], prefer?: (c: HandCard) => number): PlannedRune[] {
  let best: PlannedRune[] = [];
  for (const school of SCHOOLS) {
    const spell = bySlot(cards.filter((c) => c.def.schools.includes(school)), prefer);
    if (spell.length > best.length) best = spell;
  }
  return best;
}

/** Construit un sort selon une stratégie. Retourne une liste vide si la main ne contient rien de jouable. */
export function planSpell(state: GameState, pid: PlayerId, strategy: SpellStrategy, rng: RngState): PlannedRune[] {
  const me = state.players[pid]!;
  const all = handOf(state, pid);
  const stable = all.filter((c) => !c.def.unstable);
  if (!stable.length) {
    const any = all[0];
    return any ? [{ cardId: any.id, slot: "AMORCE" }] : [];
  }
  const foes = state.seatOrder.filter((id) => id !== pid && state.players[id]!.alive);
  const fastestFrappe = () =>
    stable.filter((c) => c.def.slot === "FRAPPE" && !isSelfHarm(c.def)).sort((a, b) => (b.def.initiative ?? 0) - (a.def.initiative ?? 0))[0];

  switch (strategy) {
    case "aleatoire": {
      const out: PlannedRune[] = [];
      for (const slot of RUNE_SLOTS) {
        if (randInt(rng, 100) >= 60) continue;
        const cands = all.filter((c) => c.def.slot === slot || c.def.unstable);
        if (cands.length) {
          const c = pick(rng, cands);
          if (!out.some((o) => o.cardId === c.id)) out.push({ cardId: c.id, slot });
        }
      }
      return out.length ? out : [{ cardId: stable[0]!.id, slot: stable[0]!.def.slot! }];
    }
    case "mono":
      return monoSpell(stable);
    case "duo": {
      const safe = me.hp <= 4 ? stable.filter((c) => !isSelfHarm(c.def)) : stable;
      for (const school of SCHOOLS) {
        const spell = bySlot(safe.filter((c) => c.def.schools.includes(school)));
        if (spell.length >= 2) return spell.slice(-2);
      }
      const fallback = bySlot(safe.length ? safe : stable).slice(-2);
      return fallback;
    }
    case "eclair": {
      const c = fastestFrappe() ?? stable[0]!;
      return [{ cardId: c.id, slot: c.def.slot! }];
    }
    case "opportuniste": {
      const lowFoe = foes.some((id) => state.players[id]!.hp <= 4);
      const f = fastestFrappe();
      if (lowFoe && f) return [{ cardId: f.id, slot: "FRAPPE" }];
      return monoSpell(stable);
    }
    case "prudent": {
      // Réglé par simulation (docs/06-equilibrage.md) :
      // - en fin de manche (2 adversaires ou moins), achève d'une Frappe rapide un adversaire à 4 PV ou moins
      //   (plus tôt, achever profite surtout aux autres : seul le dernier debout gagne) ;
      // - sinon sort mono-école (le plus de dés) ;
      // - à 5 PV ou moins : évite l'automutilation et préfère les runes défensives.
      const f = fastestFrappe();
      if (f && foes.length <= 2 && foes.some((id) => state.players[id]!.hp <= 4)) return [{ cardId: f.id, slot: "FRAPPE" }];
      const danger = me.hp <= 5;
      const pool = danger ? stable.filter((c) => !isSelfHarm(c.def)) : stable;
      return monoSpell(pool.length ? pool : stable, danger ? (c) => (isDefensive(c.def) ? 1 : 0) : undefined);
    }
  }
}

/** Stratégie de sort associée à chaque niveau. */
const LEVEL_STRATEGY: Record<BotLevel, SpellStrategy> = { facile: "aleatoire", normal: "duo", difficile: "prudent" };

/**
 * Décision d'un bot pour l'état courant : actions à envoyer dans l'ordre, ou [] s'il n'a rien à faire.
 */
export function botDecide(state: GameState, pid: PlayerId, level: BotLevel, rng: RngState): PlayerAction[] {
  const me = state.players[pid];
  if (!me) return [];

  // Choix en attente.
  const pc = state.pendingChoice;
  if (state.phase === "AWAITING_CHOICE" && pc?.playerId === pid) {
    const ids = pc.options.map((o) => o.id);
    let chosen: string[];
    if (level === "facile") chosen = pickN(rng, ids, pc.min);
    else if (pc.kind === "TARGET") {
      // Cible : le sorcier adverse le plus affaibli (achever), sinon la première invocation.
      const players = ids.filter((id) => state.players[id]);
      const target = players.sort((a, b) => state.players[a]!.hp - state.players[b]!.hp)[0] ?? ids[0]!;
      chosen = [target];
    } else if (pc.kind === "OPTION") {
      // Option : se soigner si en danger (option qui contient « PV »), sinon la première (offensive).
      const healIdx = pc.options.findIndex((o) => /PV|soign|récup/i.test(o.label));
      chosen = [me.hp <= 8 && healIdx >= 0 ? pc.options[healIdx]!.id : ids[0]!];
    } else {
      // Défausse : les runes instables et les doublons d'abord.
      const sorted = [...ids].sort((a, b) => Number(getCardDef(state.cards[b]!.defId).unstable ?? 0) - Number(getCardDef(state.cards[a]!.defId).unstable ?? 0));
      chosen = sorted.slice(0, pc.min);
    }
    return [{ type: "CHOOSE", requestId: pc.requestId, optionIds: chosen }];
  }

  // Planification.
  if (state.phase === "PLANNING" && me.alive && me.spell && !me.spell.locked) {
    const placed = RUNE_SLOTS.filter((s) => me.spell!.runes[s]);
    if (placed.length) return [{ type: "LOCK_SPELL" }];
    const plan = planSpell(state, pid, LEVEL_STRATEGY[level], rng);
    if (!plan.length) return [];
    return [...plan.map((p): PlayerAction => ({ type: "PLACE_RUNE", cardId: p.cardId, slot: p.slot })), { type: "LOCK_SPELL" }];
  }
  return [];
}

/** Noms de sorciers pour les bots (originaux). */
export const BOT_NAMES = [
  "Grimoald",
  "Morgane la Tiède",
  "Balthazar",
  "Ysolde",
  "Pipistrelle",
  "Obscurio",
  "Fennec l'Ancien",
  "Mirabelle",
  "Zéphyrin",
  "Brunehaut",
  "Cornélius",
  "Sibylle",
];
