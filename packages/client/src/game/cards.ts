/**
 * Accès TOLÉRANT au catalogue côté client.
 *
 * Si le serveur envoie une carte, un statut ou une invocation que ce client ne connaît pas
 * (client plus ancien que le serveur), on affiche un élément « inconnu » au lieu de planter
 * toute l'interface. Le contrôle de version (`game:hello`) invite alors à recharger.
 */
import {
  getCardDef,
  getStatusDef,
  getSummonDef,
  hasCardDef,
  type CardDefinition,
  type StatusDefinition,
  type SummonDefinition,
} from "@baston/engine";

const OUTDATED = "Élément d'une version plus récente du jeu : rechargez la page.";

export function cardDef(defId: string): CardDefinition {
  if (hasCardDef(defId)) return getCardDef(defId);
  return { id: defId, kind: "RUNE", name: "Carte inconnue", text: OUTDATED, schools: [], effects: [], copies: 0 };
}

export function isKnownCard(defId: string): boolean {
  return hasCardDef(defId);
}

export function statusDef(id: string): StatusDefinition {
  try {
    return getStatusDef(id);
  } catch {
    return { id, name: "Effet inconnu", text: OUTDATED, polarity: "BUFF", stacking: "IGNORE", maxStacks: 1, defaultDuration: 1, passives: [] };
  }
}

export function summonDef(id: string): SummonDefinition {
  try {
    return getSummonDef(id);
  } catch {
    return { id, name: "Invocation inconnue", text: OUTDATED, maxHp: 1, passives: [] };
  }
}
