/**
 * Illustration de chaque carte : un emblème principal (et parfois secondaire) choisi pour la carte.
 * La scène complète (fond, motif, cadre) est composée par `CardArt.tsx`.
 */
import type { EmblemName } from "./emblems";

type Art = [EmblemName, EmblemName?];

export const CARD_ART: Record<string, Art> = {
  // --- Braise
  "rune.braise.etincelle-tetue": ["spark"],
  "rune.braise.soufflet-de-forge": ["anvil", "flame"],
  "rune.braise.cendres-chaudes": ["embers"],
  "rune.braise.attise": ["flame", "wing"],
  "rune.braise.combustion": ["burst", "flame"],
  "rune.braise.braise-vorace": ["flame", "fang"],
  "rune.braise.pluie-de-cendres": ["rain"],
  "rune.braise.lance-incandescente": ["spear", "flame"],
  "rune.braise.cratere": ["volcano"],
  "rune.braise.braises-dormantes": ["embers", "moon"],
  "rune.braise.aura-ardente": ["sun", "flame"],
  "rune.braise.embrasement": ["burst"],
  "rune.braise.forge-vive": ["anvil", "spark"],
  "rune.braise.meteore": ["meteor"],
  "rune.braise.souffle-du-dragon": ["wing", "flame"],
  // --- Ombre
  "rune.ombre.murmure-du-caveau": ["tombstone", "drop"],
  "rune.ombre.pacte-sanglant": ["dagger", "drop"],
  "rune.ombre.ombre-portee": ["moon", "hand"],
  "rune.ombre.nuee-de-mites": ["moth"],
  "rune.ombre.deuil": ["raven", "tombstone"],
  "rune.ombre.malediction": ["eye"],
  "rune.ombre.faux-spectrale": ["scythe"],
  "rune.ombre.etreinte-glacee": ["claw", "snowflake"],
  "rune.ombre.hurlement-du-neant": ["scream"],
  "rune.ombre.marque-du-fossoyeur": ["target", "tombstone"],
  "rune.ombre.sangsue": ["drop", "fang"],
  "rune.ombre.peste-noire": ["skull", "moth"],
  "rune.ombre.transfert-des-maux": ["swap", "skull"],
  "rune.ombre.moisson-des-ames": ["scythe", "ghost"],
  "rune.ombre.sentence-du-venin": ["vial", "skull"],
  // --- Sève
  "rune.seve.pousse-vivace": ["sprout"],
  "rune.seve.ecorce": ["shield", "leaf"],
  "rune.seve.graine-de-ronce": ["thorn"],
  "rune.seve.seve-montante": ["leaf", "drop"],
  "rune.seve.appel-du-bosquet": ["boulder", "leaf"],
  "rune.seve.pollen-engourdissant": ["flower"],
  "rune.seve.fouet-de-liane": ["thorn", "hand"],
  "rune.seve.ruee-des-racines": ["root"],
  "rune.seve.floraison": ["flower", "sun"],
  "rune.seve.racines-profondes": ["root", "shield"],
  "rune.seve.rosee-du-matin": ["drop", "leaf"],
  "rune.seve.symbiose": ["heart", "leaf"],
  "rune.seve.coeur-de-chene": ["tree", "heart"],
  "rune.seve.charge-du-bosquet": ["boulder", "spear"],
  "rune.seve.colere-de-la-foret": ["tree", "burst"],
  // --- Éther
  "rune.ether.lecture-des-astres": ["book", "star"],
  "rune.ether.prisme": ["prism"],
  "rune.ether.voile-chatoyant": ["orb", "shield"],
  "rune.ether.echo-arcanique": ["spiral", "spark"],
  "rune.ether.dissipation": ["hand", "spark"],
  "rune.ether.sceau-inverse": ["key"],
  "rune.ether.rayon-astral": ["star"],
  "rune.ether.belier-de-lumiere": ["shield", "star"],
  "rune.ether.paradoxe": ["hourglass"],
  "rune.ether.hate-astrale": ["wing", "star"],
  "rune.ether.meditation": ["orb", "book"],
  "rune.ether.stase": ["snowflake"],
  "rune.ether.invocation-cristalline": ["crystal"],
  "rune.ether.comete": ["comet"],
  "rune.ether.savoir-interdit": ["book", "eye"],
  // --- Chimère
  "rune.chimere.pickpocket-fantome": ["hand", "ghost"],
  "rune.chimere.mirage": ["mirror"],
  "rune.chimere.des-fous": ["dice"],
  "rune.chimere.confusion": ["spiral", "question"],
  "rune.chimere.kaleidoscope": ["butterfly"],
  "rune.chimere.sosie-a-plumes": ["raven", "mirror"],
  "rune.chimere.tourbillon": ["spiral"],
  "rune.chimere.farce-cruelle": ["mask"],
  "rune.chimere.grand-illusionniste": ["mask", "card"],
  "rune.chimere.tour-de-passe-passe": ["card", "hand"],
  "rune.chimere.jeu-de-dupes": ["card", "dice"],
  "rune.chimere.reflet-trompeur": ["mirror", "ghost"],
  "rune.chimere.pari-du-fou": ["dice", "skull"],
  "rune.chimere.loterie-infernale": ["dice", "crown"],
  "rune.chimere.grand-chapardage": ["bag", "hand"],
  // --- Bi-écoles
  "rune.duo.tison-d-ombre": ["flame", "moon"],
  "rune.duo.epine-astrale": ["thorn", "star"],
  "rune.duo.chaos-flamboyant": ["burst", "mask"],
  "rune.duo.frappe-crepusculaire": ["moon", "star"],
  "rune.duo.cendres-fertiles": ["sprout", "embers"],
  "rune.duo.prisme-incandescent": ["prism", "flame"],
  "rune.duo.racines-putrides": ["root", "skull"],
  "rune.duo.spores-hallucinogenes": ["mushroom"],
  "rune.duo.cauchemar": ["eye", "moth"],
  "rune.duo.paradoxe-temporel": ["hourglass", "spiral"],
  "rune.duo.brasier-funebre": ["flame", "skull"],
  "rune.duo.aurore": ["sun", "leaf"],
  "rune.instable": ["question"],
  // --- Reliques
  "relic.anneau-de-braises": ["ring", "flame"],
  "relic.crane-bavard": ["skull"],
  "relic.de-pipe": ["dice"],
  "relic.miroir-fele": ["mirror"],
  "relic.gourde-de-seve": ["vial", "leaf"],
  "relic.plastron-runique": ["armor"],
  "relic.sablier-voleur": ["hourglass", "hand"],
  "relic.sacoche-sans-fond": ["bag"],
  "relic.coeur-de-golem": ["heart", "boulder"],
  "relic.couronne-de-ronces": ["crown", "thorn"],
  "relic.sac-a-malices": ["bag", "card"],
  "relic.lanterne-des-morts": ["lantern"],
  "relic.oeuf-de-salamandre": ["egg", "flame"],
  "relic.fiole-de-venin": ["vial", "skull"],
  "relic.dague-du-filou": ["dagger"],
  "relic.graine-eternelle": ["sprout", "star"],
  "relic.lentille-astrale": ["lens", "star"],
  "relic.collier-de-crocs": ["fang"],
  "relic.masque-du-bouffon": ["mask"],
  "relic.talisman-de-seve": ["leaf", "ring"],
  "relic.cloche-funebre": ["bell"],
  "relic.plume-de-phenix": ["feather", "flame"],
  // --- Rancunes
  "grudge.revanche": ["dagger", "ghost"],
  "grudge.linceul": ["ghost", "shield"],
  "grudge.os-a-ronger": ["bone"],
  "grudge.chuchotements": ["ghost", "book"],
  "grudge.vigueur-spectrale": ["heart", "ghost"],
  "grudge.malediction-posthume": ["eye", "skull"],
  "grudge.feu-follet": ["flame", "ghost"],
  "grudge.rancoeur": ["burst", "ghost"],
  "grudge.spectre-vengeur": ["ghost", "scythe"],
  "grudge.hantise": ["target", "ghost"],
  "grudge.elan-d-outre-tombe": ["wing", "ghost"],
  "grudge.brume-d-outre-tombe": ["cloud", "ghost"],
};

/** Emblème par défaut pour une carte ajoutée sans illustration dédiée. */
export function artFor(defId: string, kind: string): Art {
  return CARD_ART[defId] ?? (kind === "RELIC" ? ["ring"] : kind === "GRUDGE" ? ["ghost"] : ["star"]);
}

/** Hachage FNV-1a : graine stable par carte pour la composition du décor. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
