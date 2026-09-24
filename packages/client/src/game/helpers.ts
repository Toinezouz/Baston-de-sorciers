/** Sélecteurs et utilitaires d'affichage (purs). */
import {
  RUNE_SLOTS,
  SCHOOLS,
  getCardDef,
  getSummonDef,
  type GameEvent,
  type PlayerView,
  type PublicPlayerView,
  type RuneSlot,
  type School,
} from "@baston/engine";

export const SCHOOL_LABEL: Record<School, string> = {
  BRAISE: "Braise",
  OMBRE: "Ombre",
  SEVE: "Sève",
  ETHER: "Éther",
  CHIMERE: "Chimère",
};

export const SCHOOL_ICON: Record<School, string> = {
  BRAISE: "🔥",
  OMBRE: "🌑",
  SEVE: "🌿",
  ETHER: "✨",
  CHIMERE: "🎭",
};

export const SLOT_LABEL: Record<RuneSlot, string> = { AMORCE: "Amorce", TORSION: "Torsion", FRAPPE: "Frappe" };
export const SLOT_HINT: Record<RuneSlot, string> = {
  AMORCE: "résolue en 1er",
  TORSION: "résolue en 2e",
  FRAPPE: "résolue en 3e · initiative",
};

export function me(view: PlayerView): PublicPlayerView | undefined {
  return view.public.players.find((p) => p.id === view.private?.playerId);
}

/** Adversaires dans l'ordre de table, en commençant par le sorcier à ma gauche. */
export function opponents(view: PlayerView): PublicPlayerView[] {
  const players = view.public.players;
  const idx = players.findIndex((p) => p.id === view.private?.playerId);
  if (idx < 0) return players;
  return [...players.slice(idx + 1), ...players.slice(0, idx)];
}

/** Résolveur de noms pour le journal (sorciers + invocations, même disparues). */
export function nameResolver(view: PlayerView, log: GameEvent[]): (id: string | null | undefined) => string {
  const names = new Map<string, string>();
  for (const p of view.public.players) names.set(p.id, p.id === view.private?.playerId ? `${p.name} (toi)` : p.name);
  for (const e of log) {
    if (e.type === "SUMMON_ENTERED" && e.targetId) {
      const owner = view.public.players.find((p) => p.id === e.sourceId)?.name ?? "?";
      names.set(e.targetId, `${getSummonDef(String(e.data.defId)).name} de ${owner}`);
    }
  }
  return (id) => (id ? names.get(id) ?? "?" : "?");
}

export function cardSchools(defId: string): School[] {
  return getCardDef(defId).schools;
}

/** Tri de la main : par emplacement, puis école, puis nom. */
export function sortHand<T extends { defId: string }>(cards: T[]): T[] {
  const slotRank = (d: string) => {
    const def = getCardDef(d);
    return def.unstable ? 3 : RUNE_SLOTS.indexOf(def.slot!);
  };
  const schoolRank = (d: string) => SCHOOLS.indexOf(getCardDef(d).schools[0] ?? "BRAISE");
  return [...cards].sort(
    (a, b) => slotRank(a.defId) - slotRank(b.defId) || schoolRank(a.defId) - schoolRank(b.defId) || getCardDef(a.defId).name.localeCompare(getCardDef(b.defId).name),
  );
}

/** Nombre de dés de Puissance par école pour un sort en préparation. */
export function powerPreview(defIds: string[]): { school: School; dice: number }[] {
  const out: { school: School; dice: number }[] = [];
  for (const school of SCHOOLS) {
    const n = defIds.filter((d) => getCardDef(d).schools.includes(school)).length;
    if (n > 0) out.push({ school, dice: n });
  }
  return out;
}

/** Derniers sorts révélés (pour la zone de jeu), dans l'ordre de résolution. */
export function lastRevealedSpells(log: GameEvent[]): { round: number; turn: number; spells: { playerId: string; runes: Partial<Record<RuneSlot, string>> }[] } | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (e.type !== "SPELLS_REVEALED") continue;
    const spells = (e.data.spells as { playerId: string; runes: Partial<Record<RuneSlot, string>> }[]).filter((s) => Object.keys(s.runes).length);
    const order = log.slice(i).find((x) => x.type === "INITIATIVE_SET")?.data.order as { playerId: string }[] | undefined;
    if (order) spells.sort((a, b) => order.findIndex((o) => o.playerId === a.playerId) - order.findIndex((o) => o.playerId === b.playerId));
    return { round: e.round, turn: e.turn, spells };
  }
  return null;
}

export function hpRatio(p: Pick<PublicPlayerView, "hp" | "maxHp">): number {
  return Math.max(0, Math.min(1, p.hp / Math.max(1, p.maxHp)));
}
