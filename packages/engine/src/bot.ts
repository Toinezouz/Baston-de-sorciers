/**
 * Bot aléatoire « raisonnable » : utilisé pour les simulations, les tests de robustesse
 * et, plus tard, pour remplir une table. Il n'utilise que des actions légales publiques.
 */
import { cardDef } from "./state/helpers";
import { pick, randInt, shuffleInPlace } from "./rng";
import { RUNE_SLOTS, type GameState, type PlayerAction, type PlayerId, type RngState, type RuneSlot } from "./types";

/** Actions que le bot souhaite effectuer maintenant (à envoyer dans l'ordre). */
export function botActions(state: GameState, playerId: PlayerId, rng: RngState): PlayerAction[] {
  const p = state.players[playerId];
  if (!p) return [];

  if (state.phase === "AWAITING_CHOICE" && state.pendingChoice?.playerId === playerId) {
    const pc = state.pendingChoice;
    const ids = shuffleInPlace(rng, pc.options.map((o) => o.id)).slice(0, pc.min);
    return [{ type: "CHOOSE", requestId: pc.requestId, optionIds: ids }];
  }

  if (state.phase === "PLANNING" && p.alive && p.spell && !p.spell.locked) {
    const actions: PlayerAction[] = [];
    const hand = [...p.hand];
    const used = new Set<string>();
    for (const slot of RUNE_SLOTS) {
      if (randInt(rng, 100) >= 70) continue;
      const candidates = hand.filter((id) => !used.has(id) && (cardDef(state, id).slot === slot || cardDef(state, id).unstable));
      if (!candidates.length) continue;
      const cardId = pick(rng, candidates);
      used.add(cardId);
      actions.push({ type: "PLACE_RUNE", cardId, slot });
    }
    if (actions.length === 0 && hand.length > 0) {
      const cardId = pick(rng, hand);
      const def = cardDef(state, cardId);
      const slot: RuneSlot = def.slot ?? "AMORCE";
      actions.push({ type: "PLACE_RUNE", cardId, slot });
    }
    if (actions.length > 0) actions.push({ type: "LOCK_SPELL" });
    return actions;
  }
  return [];
}
