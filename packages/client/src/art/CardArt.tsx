import { cardDef } from "../game/cards";

import { memo, useId } from "react";
import { artFor, hashString } from "./cardArt";
import { EMBLEMS } from "./emblems";

/** Générateur pseudo-aléatoire local (décor uniquement, sans lien avec le hasard du jeu). */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES: Record<string, [string, string]> = {
  RELIC: ["#f4b942", "#b86f1c"],
  GRUDGE: ["#7fe3d4", "#6a4bc4"],
  UNSTABLE: ["#b8b0c8", "#f4b942"],
};

function schoolColor(s: string | undefined): string {
  return s ? `var(--school-${s.toLowerCase()})` : "var(--unstable)";
}

/**
 * Illustration originale d'une carte, composée en SVG :
 * fond aux couleurs de l'école, motif propre à la carte (graine), cadre selon l'emplacement,
 * emblème principal et emblème secondaire.
 */
export const CardArt = memo(function CardArt({ defId, className }: { defId: string; className?: string }) {
  const def = cardDef(defId);
  const uid = useId().replace(/:/g, "");
  const [main, second] = artFor(defId, def.kind);
  const rand = mulberry(hashString(defId));
  const palette =
    def.kind === "RELIC" ? PALETTES.RELIC! : def.kind === "GRUDGE" ? PALETTES.GRUDGE! : def.unstable ? PALETTES.UNSTABLE! : null;
  const c1 = palette?.[0] ?? schoolColor(def.schools[0]);
  const c2 = palette?.[1] ?? schoolColor(def.schools[1] ?? def.schools[0]);
  const pattern = Math.floor(rand() * 5);
  const tilt = Math.round((rand() - 0.5) * 16);

  // Motif de fond propre à la carte.
  const deco: JSX.Element[] = [];
  if (pattern === 0) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand() * 0.2;
      deco.push(<path key={i} d={`M80 50 L${80 + Math.cos(a) * 120} ${50 + Math.sin(a) * 120}`} stroke={c1} strokeOpacity={0.18} strokeWidth={4 + rand() * 6} />);
    }
  } else if (pattern === 1) {
    for (let i = 0; i < 4; i++)
      deco.push(<circle key={i} cx="80" cy="50" r={18 + i * 14} fill="none" stroke={c1} strokeOpacity={0.25} strokeWidth={1.5} strokeDasharray={`${2 + i * 2} ${4 + i}`} />);
  } else if (pattern === 2) {
    for (let i = 0; i < 18; i++) {
      const x = rand() * 160;
      const y = rand() * 100;
      const r = 1 + rand() * 2.5;
      deco.push(<path key={i} d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y} L${x} ${y + r * 2} L${x - r * 0.5} ${y}Z M${x - r * 2} ${y} L${x} ${y + r * 0.5} L${x + r * 2} ${y} L${x} ${y - r * 0.5}Z`} fill="#fff" fillOpacity={0.35 + rand() * 0.4} />);
    }
  } else if (pattern === 3) {
    for (let i = 0; i < 5; i++) {
      const y = 12 + i * 20 + rand() * 6;
      deco.push(<path key={i} d={`M0 ${y} Q40 ${y - 12} 80 ${y} T160 ${y}`} fill="none" stroke={c2} strokeOpacity={0.3} strokeWidth={2} />);
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = 80 + Math.cos(a) * 40;
      const y = 50 + Math.sin(a) * 40;
      deco.push(<path key={i} d={`M${x - 3} ${y - 4} L${x + 3} ${y - 4} L${x} ${y + 4}Z`} fill={c1} fillOpacity={0.35} transform={`rotate(${i * 36} ${x} ${y})`} />);
    }
    deco.push(<circle key="c" cx="80" cy="50" r="40" fill="none" stroke={c1} strokeOpacity={0.3} strokeWidth={1.5} />);
  }

  // Cadre selon l'emplacement / le type.
  let frame: JSX.Element;
  if (def.kind === "RELIC") frame = <path d="M80 12 L112 30 L112 70 L80 88 L48 70 L48 30Z" fill={c2} fillOpacity={0.25} stroke={c1} strokeOpacity={0.6} strokeWidth={2} />;
  else if (def.kind === "GRUDGE") frame = <path d="M52 92 L52 40 C52 6 108 6 108 40 L108 92Z" fill={c2} fillOpacity={0.25} stroke={c1} strokeOpacity={0.6} strokeWidth={2} />;
  else if (def.slot === "FRAPPE")
    frame = (
      <path
        d={Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 26 : 42;
          return `${i ? "L" : "M"}${80 + Math.cos(a) * r} ${50 + Math.sin(a) * r}`;
        }).join(" ") + "Z"}
        fill={c2}
        fillOpacity={0.25}
        stroke={c1}
        strokeOpacity={0.6}
        strokeWidth={2}
      />
    );
  else if (def.slot === "TORSION") frame = <rect x="52" y="22" width="56" height="56" rx="6" transform="rotate(45 80 50)" fill={c2} fillOpacity={0.25} stroke={c1} strokeOpacity={0.6} strokeWidth={2} />;
  else frame = <circle cx="80" cy="50" r="36" fill={c2} fillOpacity={0.25} stroke={c1} strokeOpacity={0.6} strokeWidth={2} strokeDasharray={def.unstable ? "6 5" : undefined} />;

  const vars = {
    "--e1": `color-mix(in srgb, ${c1} 35%, #fff8ee)`,
    "--e2": c1,
    "--e3": `color-mix(in srgb, ${c2} 55%, #140e1f)`,
  } as React.CSSProperties;

  return (
    <svg className={`card-art ${className ?? ""}`} viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Illustration : ${def.name}`} style={vars}>
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} stopOpacity={0.55} />
          <stop offset="1" stopColor={c2} stopOpacity={0.35} />
        </linearGradient>
        <radialGradient id={`gl${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`vg${uid}`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.55} />
        </radialGradient>
      </defs>
      <rect width="160" height="100" fill="#1c1529" />
      <rect width="160" height="100" fill={`url(#bg${uid})`} />
      {deco}
      <circle cx="80" cy="50" r="44" fill={`url(#gl${uid})`} />
      {frame}
      <g transform={`translate(80 50) rotate(${tilt}) scale(0.58) translate(-50 -50)`}>{EMBLEMS[main]}</g>
      {second && <g transform={`translate(128 72) rotate(${-tilt}) scale(0.3) translate(-50 -50)`}>{EMBLEMS[second]}</g>}
      <rect width="160" height="100" fill={`url(#vg${uid})`} />
    </svg>
  );
});
