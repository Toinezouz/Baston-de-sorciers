/**
 * Registre des définitions (cartes, statuts, invocations).
 *
 * Le contenu par défaut est chargé au démarrage. `registerCard` / `registerStatus` /
 * `registerSummon` permettent d'ajouter du contenu (extensions, tests) ; chaque ajout
 * est validé.
 */
import { GUARDS } from "../constants";
import { EngineError } from "../errors";
import type {
  CardDefinition,
  Condition,
  EffectNode,
  PassiveDefinition,
  PileId,
  StatusDefinition,
  SummonDefinition,
  TargetSpec,
} from "../types";
import { GRUDGES } from "./grudges";
import { RELICS } from "./relics";
import { RUNES } from "./runes";
import { RUNES_ECHOS } from "./runes-echos";
import { STATUSES } from "./statuses";
import { SUMMONS } from "./summons";

const cards = new Map<string, CardDefinition>();
const statuses = new Map<string, StatusDefinition>();
const summons = new Map<string, SummonDefinition>();

export function getCardDef(id: string): CardDefinition {
  const def = cards.get(id);
  if (!def) throw new EngineError(`Unknown card definition: ${id}`);
  return def;
}
export function getStatusDef(id: string): StatusDefinition {
  const def = statuses.get(id);
  if (!def) throw new EngineError(`Unknown status definition: ${id}`);
  return def;
}
export function getSummonDef(id: string): SummonDefinition {
  const def = summons.get(id);
  if (!def) throw new EngineError(`Unknown summon definition: ${id}`);
  return def;
}
export function hasCardDef(id: string): boolean {
  return cards.has(id);
}

export function allCardDefs(): CardDefinition[] {
  return [...cards.values()];
}
export function allStatusDefs(): StatusDefinition[] {
  return [...statuses.values()];
}
export function allSummonDefs(): SummonDefinition[] {
  return [...summons.values()];
}

/** Pile d'origine d'une carte selon son type. */
export function pileForKind(kind: CardDefinition["kind"]): PileId {
  return kind === "RUNE" ? "GRIMOIRE" : kind === "RELIC" ? "COFFRE" : "OUTRE_TOMBE";
}

/** Cartes incluses dans une nouvelle partie. Les cartes `copies: 0` (tests) sont exclues. */
export function defaultDeckList(): CardDefinition[] {
  return allCardDefs().filter((c) => c.copies > 0);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateTarget(t: TargetSpec, where: string, allowChoice: boolean): string[] {
  if (t.sel === "CHOSEN" && !allowChoice) return [`${where}: CHOSEN target not allowed here`];
  return [];
}

function validateCondition(c: Condition, where: string): string[] {
  switch (c.c) {
    case "AND":
    case "OR":
      return c.of.flatMap((x) => validateCondition(x, where));
    case "NOT":
      return validateCondition(c.of, where);
    case "HP_AT_MOST":
    case "HP_AT_LEAST":
    case "HAS_STATUS":
    case "IS_DEAD":
    case "HAS_RELIC": {
      const errs = validateTarget(c.who, where, false);
      if (c.c === "HAS_STATUS" && !statuses.has(c.status)) errs.push(`${where}: unknown status ${c.status}`);
      return errs;
    }
    case "CHANCE":
      return c.percent < 0 || c.percent > 100 ? [`${where}: CHANCE percent out of range`] : [];
    default:
      return [];
  }
}

export function validateEffects(effects: EffectNode[], where: string): string[] {
  const errs: string[] = [];
  for (const e of effects) {
    switch (e.op) {
      case "DAMAGE":
      case "HEAL":
      case "DRAIN":
      case "LOSE_HP":
      case "DRAW":
      case "GAIN_RELIC":
      case "REMOVE_STATUS":
        errs.push(...validateTarget(e.target, where, true));
        break;
      case "DISCARD":
        errs.push(...validateTarget(e.target, where, true));
        break;
      case "APPLY_STATUS":
        errs.push(...validateTarget(e.target, where, true));
        if (!statuses.has(e.status)) errs.push(`${where}: unknown status ${e.status}`);
        if (typeof e.duration === "number" && (e.duration < 1 || e.duration > GUARDS.MAX_STATUS_DURATION))
          errs.push(`${where}: duration out of bounds`);
        break;
      case "STEAL_CARD":
      case "STEAL_RELIC":
        errs.push(...validateTarget(e.from, where, true));
        break;
      case "TRANSFER_STATUS":
        errs.push(...validateTarget(e.from, where, true), ...validateTarget(e.to, where, true));
        break;
      case "SUMMON":
        if (!summons.has(e.summon)) errs.push(`${where}: unknown summon ${e.summon}`);
        break;
      case "POWER_ROLL":
        if (e.tiers.length !== 3) errs.push(`${where}: POWER_ROLL needs 3 tiers`);
        e.tiers.forEach((t, i) => errs.push(...validateEffects(t, `${where}.tier${i + 1}`)));
        break;
      case "IF":
        errs.push(...validateCondition(e.cond, where));
        errs.push(...validateEffects(e.then, where), ...validateEffects(e.else ?? [], where));
        break;
      case "FOR_EACH":
        errs.push(...validateTarget(e.target, where, true));
        errs.push(...validateEffects(e.effects, where));
        break;
      case "CHOOSE_OPTION":
        if (e.options.length < 2) errs.push(`${where}: CHOOSE_OPTION needs ≥ 2 options`);
        e.options.forEach((o) => errs.push(...validateEffects(o.effects, where)));
        break;
      case "RANDOM":
        if (e.branches.length < 1) errs.push(`${where}: RANDOM needs branches`);
        e.branches.forEach((b) => errs.push(...validateEffects(b.effects, where)));
        break;
      case "REPEAT":
        if (typeof e.times === "number" && e.times > 10) errs.push(`${where}: REPEAT too large`);
        errs.push(...validateEffects(e.effects, where));
        break;
      case "ECHO":
        if (e.max < 1 || e.max > GUARDS.MAX_ECHO) errs.push(`${where}: ECHO.max must be in [1, ${GUARDS.MAX_ECHO}]`);
        errs.push(...validateCondition(e.while, where), ...validateEffects(e.effects, where));
        break;
      case "DELAY":
        errs.push(...validateEffects(e.effects, where));
        break;
    }
  }
  return errs;
}

function validatePassives(passives: PassiveDefinition[], where: string): string[] {
  const errs: string[] = [];
  passives.forEach((p, i) => {
    if (!p.trigger && !p.modifier) errs.push(`${where}.passive${i}: empty passive`);
    if (p.trigger) errs.push(...validateEffects(p.trigger.effects, `${where}.passive${i}`));
  });
  return errs;
}

export function validateCard(def: CardDefinition): string[] {
  const where = `card ${def.id}`;
  const errs: string[] = [];
  if (!def.name.trim()) errs.push(`${where}: empty name`);
  if (!def.text.trim()) errs.push(`${where}: empty text`);
  if (def.copies < 0) errs.push(`${where}: negative copies`);
  if (def.kind === "RUNE") {
    if (!def.unstable && !def.slot) errs.push(`${where}: rune without slot`);
    if (!def.unstable && def.schools.length === 0) errs.push(`${where}: rune without school`);
    if (def.schools.length > 2) errs.push(`${where}: too many schools`);
    if (def.slot === "FRAPPE" && typeof def.initiative !== "number") errs.push(`${where}: FRAPPE without initiative`);
  }
  if (def.kind === "RELIC" && !def.passives?.length) errs.push(`${where}: relic without passive`);
  errs.push(...validateEffects(def.effects, where));
  errs.push(...validatePassives(def.passives ?? [], where));
  return errs;
}

function assertValid(errs: string[]): void {
  if (errs.length) throw new EngineError(`Invalid content:\n${errs.join("\n")}`);
}

export function registerStatus(def: StatusDefinition): void {
  if (statuses.has(def.id)) throw new EngineError(`Duplicate status ${def.id}`);
  statuses.set(def.id, def);
  const errs = validatePassives(def.passives, `status ${def.id}`);
  if (def.maxStacks < 1) errs.push(`status ${def.id}: maxStacks < 1`);
  if (errs.length) {
    statuses.delete(def.id);
    assertValid(errs);
  }
}

export function registerSummon(def: SummonDefinition): void {
  if (summons.has(def.id)) throw new EngineError(`Duplicate summon ${def.id}`);
  summons.set(def.id, def);
  const errs = validatePassives(def.passives, `summon ${def.id}`);
  if (def.maxHp < 1) errs.push(`summon ${def.id}: maxHp < 1`);
  if (errs.length) {
    summons.delete(def.id);
    assertValid(errs);
  }
}

export function registerCard(def: CardDefinition): void {
  if (cards.has(def.id)) throw new EngineError(`Duplicate card ${def.id}`);
  assertValid(validateCard(def));
  cards.set(def.id, def);
}

/** Valide l'ensemble du catalogue (utilisé par les tests). */
export function validateCatalog(): string[] {
  const errs: string[] = [];
  for (const c of cards.values()) errs.push(...validateCard(c));
  for (const s of statuses.values()) errs.push(...validatePassives(s.passives, `status ${s.id}`));
  for (const s of summons.values()) errs.push(...validatePassives(s.passives, `summon ${s.id}`));
  return errs;
}

// Chargement du contenu par défaut : statuts et invocations d'abord (référencés par les cartes).
// Les statuts/invocations sont enregistrés sans validation croisée puis validés ensemble.
for (const s of STATUSES) statuses.set(s.id, s);
for (const s of SUMMONS) summons.set(s.id, s);
for (const c of [...RUNES, ...RUNES_ECHOS, ...RELICS, ...GRUDGES]) registerCard(c);
assertValid(validateCatalog());
