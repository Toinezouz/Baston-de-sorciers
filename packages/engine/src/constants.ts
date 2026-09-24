import type { GameConfig } from "./types";

export const DEFAULT_CONFIG: GameConfig = {
  minPlayers: 2,
  maxPlayers: 6,
  startingHp: 20,
  handSize: 8,
  crownsToWin: 2,
  planningMs: 60_000,
  choiceMs: 20_000,
  maxRounds: 15,
  suddenDeathTurn: 20,
  maxTurnsPerRound: 40,
};

/** Variante « partie rapide ». */
export const QUICK_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  startingHp: 12,
  handSize: 6,
  crownsToWin: 1,
  planningMs: 30_000,
  choiceMs: 15_000,
  suddenDeathTurn: 12,
  maxTurnsPerRound: 30,
};

/** Garde-fous du moteur (voir docs/01-analyse.md §7.1). */
export const GUARDS = {
  /** Profondeur maximale d'une chaîne d'effets (effet → sous-effet → déclencheur…). */
  MAX_DEPTH: 16,
  /** Nombre maximal de tâches traitées pendant un seul `dispatch`. */
  MAX_TASKS_PER_DISPATCH: 2_000,
  /** Activations maximales d'un même passif pendant un même sort. */
  MAX_TRIGGER_PER_SPELL: 3,
  /** Nombre maximal d'itérations d'un ECHO (validé au chargement du catalogue). */
  MAX_ECHO: 5,
  /** Durée maximale d'un statut (tours). */
  MAX_STATUS_DURATION: 5,
  /** Transitions de phase automatiques enchaînées dans un seul dispatch. */
  MAX_PHASE_TRANSITIONS: 500,
  /** Dés maximum pour un jet de Puissance. */
  MAX_DICE: 10,
  /** Cartes retournées au maximum pour remplacer une rune instable. */
  MAX_UNSTABLE_FLIPS: 10,
} as const;

/** Seuils de palier des jets de Puissance : 1–4 → palier 1, 5–9 → palier 2, 10+ → palier 3. */
export const POWER_TIERS = [5, 10] as const;

export const NAME_MAX_LENGTH = 20;
