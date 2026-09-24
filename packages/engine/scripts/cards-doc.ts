/**
 * Génère docs/02-cartes.md à partir du catalogue (source unique de vérité).
 *   npm run cards:doc
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { allCardDefs, allStatusDefs, allSummonDefs } from "../src/cards/registry";
import type { CardDefinition, Condition, EffectNode, TargetSpec } from "../src/types";

const TARGET_LABEL: Record<string, string> = {
  SELF: "soi", CONTROLLER: "maître", HOLDER: "porteur", LEFT: "gauche", RIGHT: "droite", ALL_FOES: "tous les adversaires",
  ALL_PLAYERS: "tous les sorciers", STRONGEST_FOE: "adversaire le plus robuste", WEAKEST_FOE: "adversaire le plus affaibli",
  RANDOM_FOE: "adversaire aléatoire", ALL_FOE_SUMMONS: "invocations adverses", MY_KILLER: "ton meurtrier",
  EVENT_SOURCE: "source de l'événement", EVENT_TARGET: "cible de l'événement", IT: "(itération)", CHOSEN: "au choix",
};

function targetsOf(effects: EffectNode[], acc = new Set<string>()): Set<string> {
  const t = (spec: TargetSpec) => spec.sel !== "IT" && acc.add(TARGET_LABEL[spec.sel] ?? spec.sel);
  for (const e of effects) {
    if ("target" in e) t(e.target);
    if ("from" in e && typeof e.from === "object") t(e.from);
    if (e.op === "POWER_ROLL") e.tiers.forEach((x) => targetsOf(x, acc));
    if (e.op === "IF") { targetsOf(e.then, acc); targetsOf(e.else ?? [], acc); }
    if (e.op === "FOR_EACH" || e.op === "REPEAT" || e.op === "ECHO" || e.op === "DELAY") targetsOf(e.effects, acc);
    if (e.op === "CHOOSE_OPTION") e.options.forEach((o) => targetsOf(o.effects, acc));
    if (e.op === "RANDOM") e.branches.forEach((b) => targetsOf(b.effects, acc));
    if (e.op === "SUMMON") acc.add("invocation");
  }
  return acc;
}

function opsOf(effects: EffectNode[], acc = new Set<string>()): Set<string> {
  for (const e of effects) {
    acc.add(e.op);
    if (e.op === "POWER_ROLL") e.tiers.forEach((x) => opsOf(x, acc));
    if (e.op === "IF") { opsOf(e.then, acc); opsOf(e.else ?? [], acc); }
    if (e.op === "FOR_EACH" || e.op === "REPEAT" || e.op === "ECHO" || e.op === "DELAY") opsOf(e.effects, acc);
    if (e.op === "CHOOSE_OPTION") e.options.forEach((o) => opsOf(o.effects, acc));
    if (e.op === "RANDOM") e.branches.forEach((b) => opsOf(b.effects, acc));
  }
  return acc;
}

function condsOf(effects: EffectNode[], acc: string[] = []): string[] {
  const c = (x: Condition): string => (x.c === "AND" || x.c === "OR" ? x.of.map(c).join(` ${x.c} `) : x.c === "NOT" ? `NOT ${c(x.of)}` : x.c);
  for (const e of effects) {
    if (e.op === "IF") { acc.push(c(e.cond)); condsOf(e.then, acc); condsOf(e.else ?? [], acc); }
    if (e.op === "ECHO") acc.push(`écho tant que ${c(e.while)} (max ${e.max})`);
    if (e.op === "POWER_ROLL") { acc.push(e.dice ? `${e.dice} dés fixes` : "jet de Puissance"); e.tiers.forEach((x) => condsOf(x, acc)); }
    if (e.op === "FOR_EACH" || e.op === "REPEAT") condsOf(e.effects, acc);
  }
  return acc;
}

function interactions(def: CardDefinition): string {
  const notes: string[] = [];
  const ops = opsOf(def.effects);
  if (ops.has("DAMAGE") || ops.has("DRAIN")) notes.push("modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir");
  if (ops.has("HEAL") || ops.has("DRAIN")) notes.push("bloquée par Maudit");
  if (ops.has("POWER_ROLL")) notes.push("+1 dé avec Clairvoyance / Dé pipé");
  if (def.schools.length === 2) notes.push("compte pour deux écoles");
  if (def.unstable) notes.push("remplacée au dévoilement");
  return notes.join(" ; ") || "—";
}

const esc = (s: string) => s.replace(/\|/g, "\\|");
const kindLabel = { RUNE: "Rune", RELIC: "Relique", GRUDGE: "Rancune" } as const;

let md = `# Catalogue des cartes\n\n> Fichier généré par \`npm run cards:doc\` à partir de \`packages/engine/src/cards/\`. Ne pas éditer à la main.\n\n`;
md += `**Coût** : aucune carte n'a de coût en ressource. Le coût d'une rune est son **emplacement** (1 rune par emplacement et par sort) et la **carte de main** consommée. Plus un sort compte de runes, plus il est puissant (dés) mais plus il résout tard.\n\n`;

const defs = allCardDefs().filter((c) => c.copies > 0);
for (const kind of ["RUNE", "RELIC", "GRUDGE"] as const) {
  const list = defs.filter((d) => d.kind === kind);
  md += `## ${kindLabel[kind]}s (${list.length} cartes, ${list.reduce((a, d) => a + d.copies, 0)} exemplaires)\n\n`;
  md += `| ID | Nom | Type | Coût | Description | Cible | Effets | Conditions | Interactions |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const d of list) {
    const type = kind === "RUNE"
      ? `${d.unstable ? "Instable" : d.slot}${d.schools.length ? ` · ${d.schools.join("+")}` : ""}${d.initiative !== undefined ? ` · init ${d.initiative}` : ""} ×${d.copies}`
      : `${kindLabel[kind]}${d.eternal ? " éternelle" : ""} ×${d.copies}`;
    const cost = kind === "RUNE" ? (d.unstable ? "1 emplacement (libre)" : `emplacement ${d.slot}`) : "—";
    const effects = d.passives?.length
      ? d.passives.map((p) => (p.trigger ? `déclencheur ${p.trigger.on}` : `modificateur ${p.modifier!.hook} ${p.modifier!.kind}`)).join(", ")
      : [...opsOf(d.effects)].join(", ") || "—";
    const targets = [...targetsOf([...d.effects, ...(d.passives ?? []).flatMap((p) => p.trigger?.effects ?? [])])].join(", ") || "—";
    const conds = condsOf(d.effects).join(" ; ") || "—";
    md += `| \`${d.id}\` | ${esc(d.name)} | ${type} | ${cost} | ${esc(d.text)} | ${targets} | ${effects} | ${esc(conds)} | ${esc(interactions(d))} |\n`;
  }
  md += `\n`;
}

md += `## Statuts\n\n| ID | Nom | Polarité | Cumul | Durée par défaut | Effet |\n|---|---|---|---|---|---|\n`;
for (const s of allStatusDefs().filter((s) => !s.id.startsWith("test-")))
  md += `| \`${s.id}\` | ${s.name} | ${s.polarity} | ${s.stacking} (max ${s.maxStacks}) | ${s.defaultDuration} | ${esc(s.text)} |\n`;
md += `\n## Invocations\n\n| ID | Nom | PV | Effet |\n|---|---|---|---|\n`;
for (const s of allSummonDefs()) md += `| \`${s.id}\` | ${s.name} | ${s.maxHp} | ${esc(s.text)} |\n`;

const out = join(import.meta.dirname, "../../../docs/02-cartes.md");
writeFileSync(out, md);
console.log(`Écrit ${out} (${defs.length} cartes)`);
