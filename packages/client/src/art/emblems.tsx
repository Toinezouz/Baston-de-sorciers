/**
 * Bibliothèque d'emblèmes vectoriels originaux (boîte 100 × 100).
 * Couleurs : `var(--e1)` (clair, remplissage), `var(--e2)` (vif, traits), `var(--e3)` (sombre, détails).
 */
import type { ReactElement } from "react";

const S = { stroke: "var(--e2)", strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const F = { fill: "var(--e1)" } as const;
const D = { fill: "var(--e3)" } as const;
const N = { fill: "none" } as const;

export const EMBLEMS = {
  flame: (
    <>
      <path {...F} {...S} d="M50 8 C62 28 80 38 76 62 C73 82 60 92 50 92 C38 92 24 82 24 62 C24 48 34 40 38 26 C44 36 46 42 50 44 C54 32 52 20 50 8Z" />
      <path {...D} d="M50 50 C58 60 62 68 60 76 C58 84 54 86 50 86 C44 86 40 82 40 74 C40 66 46 62 50 50Z" />
    </>
  ),
  spark: (
    <>
      <path {...F} {...S} d="M50 6 L58 42 L94 50 L58 58 L50 94 L42 58 L6 50 L42 42Z" />
      <path {...F} {...S} strokeWidth={3} d="M80 12 L83 22 L93 25 L83 28 L80 38 L77 28 L67 25 L77 22Z" />
      <circle {...D} cx="50" cy="50" r="7" />
    </>
  ),
  burst: (
    <>
      <path
        {...F}
        {...S}
        d="M50 4 L58 32 L84 14 L70 42 L96 50 L70 58 L84 86 L58 68 L50 96 L42 68 L16 86 L30 58 L4 50 L30 42 L16 14 L42 32Z"
      />
      <circle {...D} cx="50" cy="50" r="12" />
    </>
  ),
  embers: (
    <>
      <path {...F} {...S} d="M30 40 C38 52 44 58 42 70 C40 80 34 84 28 84 C20 84 16 78 16 70 C16 60 24 56 30 40Z" />
      <path {...F} {...S} d="M68 22 C78 38 86 48 84 64 C82 78 74 84 66 84 C56 84 50 76 50 66 C50 52 62 44 68 22Z" />
      <circle {...D} cx="48" cy="90" r="4" />
      <circle {...D} cx="84" cy="90" r="3" />
    </>
  ),
  anvil: (
    <>
      <path {...F} {...S} d="M12 30 L88 30 L88 40 C74 42 66 48 64 56 L64 64 L76 76 L24 76 L36 64 L36 56 C34 48 22 44 12 42Z" />
      <path {...S} {...N} d="M20 90 L80 90" />
      <path {...S} {...N} d="M56 10 L64 20 M70 8 L70 20 M84 12 L76 22" />
    </>
  ),
  rain: (
    <>
      <path {...F} {...S} d="M22 42 C12 42 10 28 20 24 C22 12 38 10 44 18 C50 8 70 10 72 24 C86 24 88 42 76 42Z" />
      {[26, 42, 58, 74].map((x, i) => (
        <path key={x} {...S} d={`M${x} ${54 + (i % 2) * 6} L${x - 6} ${72 + (i % 2) * 6}`} />
      ))}
      <circle {...D} cx="34" cy="90" r="4" />
      <circle {...D} cx="64" cy="92" r="4" />
    </>
  ),
  spear: (
    <>
      <path {...S} {...N} strokeWidth={6} d="M18 86 L70 26" />
      <path {...F} {...S} d="M70 26 L64 14 L90 8 L82 34Z" />
      <path {...S} {...N} d="M24 70 L34 80 M30 64 L40 74" />
    </>
  ),
  volcano: (
    <>
      <path {...F} {...S} d="M8 90 L38 40 L62 40 L92 90Z" />
      <path {...D} d="M38 40 C44 50 56 50 62 40Z" />
      <path {...S} {...N} d="M44 32 C42 22 48 14 44 6 M56 32 C60 22 54 16 60 8" />
    </>
  ),
  meteor: (
    <>
      <path {...S} {...N} strokeWidth={5} d="M10 12 L50 52 M28 8 L58 40 M8 30 L40 60" />
      <circle {...F} {...S} cx="64" cy="66" r="22" />
      <circle {...D} cx="58" cy="60" r="5" />
      <circle {...D} cx="72" cy="74" r="4" />
    </>
  ),
  comet: (
    <>
      <path {...F} opacity={0.5} d="M8 20 C30 30 50 44 60 56 L52 64 C40 52 26 34 8 20Z" />
      <path {...F} {...S} d="M66 50 L72 64 L86 66 L75 75 L78 90 L66 82 L54 90 L57 75 L46 66 L60 64Z" />
    </>
  ),
  wing: (
    <>
      <path {...F} {...S} d="M12 70 C20 40 44 18 88 12 C80 22 78 28 80 34 C70 36 64 40 64 46 C56 48 50 52 50 58 C40 60 26 66 12 70Z" />
      <path {...S} {...N} d="M22 64 C36 50 52 38 74 26" />
    </>
  ),
  moon: (
    <>
      <path {...F} {...S} d="M62 10 C36 14 20 34 20 54 C20 76 38 92 60 90 C44 82 36 68 36 52 C36 34 46 18 62 10Z" />
      <circle {...D} cx="70" cy="40" r="3" />
      <circle {...D} cx="80" cy="60" r="2.5" />
    </>
  ),
  sun: (
    <>
      <circle {...F} {...S} cx="50" cy="50" r="20" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return <path key={i} {...S} d={`M${50 + Math.cos(a) * 28} ${50 + Math.sin(a) * 28} L${50 + Math.cos(a) * 42} ${50 + Math.sin(a) * 42}`} />;
      })}
    </>
  ),
  star: (
    <>
      <path {...F} {...S} d="M50 6 L62 38 L96 38 L68 58 L78 92 L50 72 L22 92 L32 58 L4 38 L38 38Z" />
      <circle {...D} cx="50" cy="52" r="6" />
    </>
  ),
  ring: (
    <>
      <circle {...N} {...S} strokeWidth={9} cx="50" cy="56" r="28" />
      <circle {...N} stroke="var(--e1)" strokeWidth={4} cx="50" cy="56" r="28" />
      <path {...F} {...S} d="M50 10 L62 24 L50 36 L38 24Z" />
    </>
  ),
  tombstone: (
    <>
      <path {...F} {...S} d="M26 88 L26 40 C26 18 74 18 74 40 L74 88Z" />
      <path {...S} {...N} d="M50 34 L50 62 M40 44 L60 44" />
      <path {...S} {...N} d="M12 90 L88 90" />
    </>
  ),
  drop: (
    <>
      <path {...F} {...S} d="M50 8 C62 30 78 46 78 64 C78 80 66 92 50 92 C34 92 22 80 22 64 C22 46 38 30 50 8Z" />
      <path {...D} d="M38 62 C38 72 44 80 52 80 C46 76 42 70 42 62Z" />
    </>
  ),
  dagger: (
    <>
      <path {...F} {...S} d="M50 6 L58 20 L58 62 L42 62 L42 20Z" />
      <path {...S} {...N} strokeWidth={6} d="M28 64 L72 64" />
      <path {...D} {...S} d="M44 66 L56 66 L56 84 L44 84Z" />
      <circle {...F} {...S} cx="50" cy="90" r="5" />
    </>
  ),
  moth: (
    <>
      <path {...F} {...S} d="M50 34 C40 12 12 14 12 38 C12 52 30 56 46 52 C32 60 24 74 34 84 C42 90 50 74 50 62Z" />
      <path {...F} {...S} d="M50 34 C60 12 88 14 88 38 C88 52 70 56 54 52 C68 60 76 74 66 84 C58 90 50 74 50 62Z" />
      <path {...D} d="M46 30 L54 30 L54 70 L46 70Z" />
      <path {...S} {...N} d="M48 30 C44 20 40 16 36 14 M52 30 C56 20 60 16 64 14" />
    </>
  ),
  raven: (
    <>
      <path {...F} {...S} d="M16 64 C30 60 36 44 50 38 C58 26 72 24 80 30 L92 30 L82 38 C84 52 74 66 56 70 L40 86 L42 72 C32 74 22 72 16 64Z" />
      <circle {...D} cx="74" cy="32" r="3.5" />
    </>
  ),
  eye: (
    <>
      <path {...F} {...S} d="M6 50 C22 24 78 24 94 50 C78 76 22 76 6 50Z" />
      <circle {...D} cx="50" cy="50" r="16" />
      <circle fill="var(--e2)" cx="50" cy="50" r="7" />
      <circle fill="#fff" cx="45" cy="45" r="3" />
    </>
  ),
  scythe: (
    <>
      <path {...S} {...N} strokeWidth={6} d="M30 92 L62 12" />
      <path {...F} {...S} d="M58 22 C40 10 16 14 8 32 C24 24 40 26 54 34Z" />
    </>
  ),
  claw: (
    <>
      <path {...F} {...S} d="M30 92 L30 60 C30 50 70 50 70 60 L70 92Z" />
      <path {...F} {...S} d="M30 60 C22 40 20 26 26 10 C32 28 38 42 40 56Z" />
      <path {...F} {...S} d="M46 54 C44 36 46 20 52 6 C56 22 56 38 54 54Z" />
      <path {...F} {...S} d="M60 56 C64 40 72 28 82 16 C80 32 74 46 70 60Z" />
    </>
  ),
  snowflake: (
    <>
      {[0, 60, 120].map((r) => (
        <g key={r} transform={`rotate(${r} 50 50)`}>
          <path {...S} strokeWidth={5} d="M50 8 L50 92" />
          <path {...S} d="M50 22 L40 12 M50 22 L60 12 M50 78 L40 88 M50 78 L60 88" />
        </g>
      ))}
      <circle {...F} {...S} cx="50" cy="50" r="8" />
    </>
  ),
  scream: (
    <>
      <path {...F} {...S} d="M36 28 C36 14 64 14 64 28 L64 50 C64 64 36 64 36 50Z" />
      <ellipse {...D} cx="50" cy="48" rx="6" ry="9" />
      <circle {...D} cx="44" cy="30" r="3" />
      <circle {...D} cx="56" cy="30" r="3" />
      <path {...S} {...N} d="M24 66 C34 78 66 78 76 66 M14 76 C30 94 70 94 86 76" />
    </>
  ),
  target: (
    <>
      <circle {...F} {...S} cx="50" cy="50" r="36" />
      <circle {...N} {...S} cx="50" cy="50" r="22" />
      <circle fill="var(--e2)" cx="50" cy="50" r="8" />
      <path {...S} d="M50 4 L50 20 M50 80 L50 96 M4 50 L20 50 M80 50 L96 50" />
    </>
  ),
  fang: (
    <>
      <path {...S} {...N} d="M8 26 C30 40 70 40 92 26" />
      {[22, 38, 54, 70].map((x, i) => (
        <path key={x} {...F} {...S} d={`M${x} ${34 + (i === 1 || i === 2 ? 4 : 0)} L${x + 8} ${i === 1 || i === 2 ? 86 : 70} L${x + 16} ${34 + (i === 1 || i === 2 ? 4 : 0)}Z`} />
      ))}
    </>
  ),
  skull: (
    <>
      <path {...F} {...S} d="M20 48 C20 22 36 10 50 10 C64 10 80 22 80 48 C80 58 74 64 70 66 L70 82 L30 82 L30 66 C26 64 20 58 20 48Z" />
      <circle {...D} cx="37" cy="48" r="9" />
      <circle {...D} cx="63" cy="48" r="9" />
      <path {...D} d="M50 58 L44 68 L56 68Z" />
      <path {...S} {...N} d="M40 82 L40 74 M50 82 L50 74 M60 82 L60 74" />
    </>
  ),
  bone: (
    <>
      <path {...F} {...S} transform="rotate(-35 50 50)" d="M26 44 L74 44 C74 34 90 32 90 42 C98 44 98 56 90 58 C90 68 74 66 74 56 L26 56 C26 66 10 68 10 58 C2 56 2 44 10 42 C10 32 26 34 26 44Z" />
    </>
  ),
  ghost: (
    <>
      <path {...F} {...S} d="M22 90 L22 44 C22 20 36 10 50 10 C64 10 78 20 78 44 L78 90 L68 80 L58 90 L50 80 L42 90 L32 80Z" />
      <ellipse {...D} cx="40" cy="42" rx="5" ry="8" />
      <ellipse {...D} cx="60" cy="42" rx="5" ry="8" />
      <ellipse {...D} cx="50" cy="62" rx="5" ry="6" />
    </>
  ),
  cloud: (
    <>
      <path {...F} {...S} d="M20 70 C6 70 6 50 20 48 C20 30 42 24 50 36 C58 20 84 26 80 46 C94 48 94 70 80 70Z" />
      <path {...S} {...N} d="M22 82 L78 82 M34 92 L66 92" />
    </>
  ),
  vial: (
    <>
      <path {...F} {...S} d="M40 10 L60 10 L60 34 C76 42 82 56 78 70 C74 86 26 86 22 70 C18 56 24 42 40 34Z" />
      <path {...D} d="M26 62 C40 56 60 68 74 62 C74 76 66 82 50 82 C34 82 26 76 26 62Z" />
      <path {...S} {...N} d="M36 10 L64 10" />
    </>
  ),
  sprout: (
    <>
      <path {...S} {...N} strokeWidth={5} d="M50 92 C50 70 50 56 50 44" />
      <path {...F} {...S} d="M50 50 C30 50 14 38 12 18 C32 18 48 30 50 50Z" />
      <path {...F} {...S} d="M50 44 C58 26 72 16 90 16 C88 34 72 46 50 44Z" />
      <path {...D} d="M30 92 C36 84 64 84 70 92Z" />
    </>
  ),
  leaf: (
    <>
      <path {...F} {...S} d="M14 86 C12 46 42 14 88 12 C88 58 58 88 14 86Z" />
      <path {...S} {...N} d="M14 86 C40 60 60 40 80 20 M40 60 L38 42 M54 46 L70 46" />
    </>
  ),
  thorn: (
    <>
      <path {...S} {...N} strokeWidth={6} d="M10 80 C30 60 40 70 54 50 C66 32 80 38 92 16" />
      {[
        [26, 66, 18, 52],
        [42, 62, 48, 76],
        [56, 46, 48, 34],
        [72, 34, 82, 44],
        [84, 26, 76, 14],
      ].map(([x1, y1, x2, y2], i) => (
        <path key={i} {...F} {...S} strokeWidth={3} d={`M${x1! - 4} ${y1} L${x2} ${y2} L${x1! + 4} ${y1! + 2}Z`} />
      ))}
    </>
  ),
  root: (
    <>
      <path {...S} {...N} strokeWidth={7} d="M50 44 C50 60 52 74 50 92 M50 56 C40 64 28 70 12 72 M50 60 C62 68 74 76 86 88 M50 70 C44 80 34 86 24 92" />
      <path {...F} {...S} d="M38 8 L62 8 L60 48 L40 48Z" />
      <path {...S} {...N} d="M44 18 L56 22 M44 32 L56 36" />
    </>
  ),
  flower: (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <ellipse key={i} {...F} {...S} cx="50" cy="26" rx="12" ry="20" transform={`rotate(${i * 60} 50 50)`} />
      ))}
      <circle fill="var(--e2)" cx="50" cy="50" r="12" />
      <circle {...D} cx="50" cy="50" r="5" />
    </>
  ),
  mushroom: (
    <>
      <path {...F} {...S} d="M8 52 C8 26 30 10 50 10 C70 10 92 26 92 52Z" />
      <path {...D} {...S} d="M38 52 L36 88 C44 92 56 92 64 88 L62 52Z" />
      <circle fill="var(--e2)" cx="32" cy="32" r="6" />
      <circle fill="var(--e2)" cx="62" cy="26" r="5" />
      <circle fill="var(--e2)" cx="74" cy="42" r="4" />
    </>
  ),
  tree: (
    <>
      <path {...D} {...S} d="M44 92 L44 62 L56 62 L56 92Z" />
      <path {...F} {...S} d="M50 8 C74 8 90 26 86 44 C84 58 70 66 50 66 C30 66 16 58 14 44 C10 26 26 8 50 8Z" />
      <path {...S} {...N} d="M50 66 L50 44 M50 52 L38 40 M50 48 L62 36" />
    </>
  ),
  boulder: (
    <>
      <path {...F} {...S} d="M18 84 L10 56 L24 26 L50 14 L78 24 L92 52 L84 84Z" />
      <path {...D} d="M30 44 L44 44 L44 52 L30 52Z" />
      <path {...D} d="M58 44 L72 44 L72 52 L58 52Z" />
      <path {...S} {...N} d="M36 70 L64 70 M24 26 L36 36 M78 24 L68 34" />
    </>
  ),
  shield: (
    <>
      <path {...F} {...S} d="M50 8 L86 20 C86 56 72 80 50 92 C28 80 14 56 14 20Z" />
      <path {...S} {...N} d="M50 20 L50 80 M28 36 L72 36" />
    </>
  ),
  armor: (
    <>
      <path {...F} {...S} d="M30 12 L42 20 L58 20 L70 12 L90 24 L82 44 L74 40 L74 88 L26 88 L26 40 L18 44 L10 24Z" />
      <path {...S} {...N} d="M50 30 L50 80 M36 50 L64 50 M36 66 L64 66" />
    </>
  ),
  heart: (
    <>
      <path {...F} {...S} d="M50 88 C20 66 8 50 8 32 C8 18 20 10 32 10 C40 10 46 14 50 22 C54 14 60 10 68 10 C80 10 92 18 92 32 C92 50 80 66 50 88Z" />
      <path fill="#fff" opacity={0.5} d="M24 26 C26 20 32 18 36 20 C32 22 28 26 26 32Z" />
    </>
  ),
  book: (
    <>
      <path {...F} {...S} d="M50 22 C38 14 20 14 8 18 L8 84 C20 80 38 80 50 88 C62 80 80 80 92 84 L92 18 C80 14 62 14 50 22Z" />
      <path {...S} {...N} d="M50 22 L50 88 M18 34 L40 34 M18 46 L40 46 M60 34 L82 34 M60 46 L82 46" />
    </>
  ),
  prism: (
    <>
      <path {...F} {...S} d="M50 10 L88 80 L12 80Z" />
      <path {...S} {...N} d="M50 10 L50 80 M50 80 L30 44" />
      <path stroke="var(--e2)" strokeWidth={3} fill="none" d="M92 46 L70 54 M94 58 L72 60 M92 70 L74 66" />
    </>
  ),
  crystal: (
    <>
      <path {...F} {...S} d="M50 6 L74 28 L66 90 L34 90 L26 28Z" />
      <path {...S} {...N} d="M26 28 L74 28 M50 6 L42 28 L50 90 M50 6 L58 28" />
      <path {...F} {...S} strokeWidth={3} d="M82 46 L90 56 L86 84 L76 84 L72 56Z" />
    </>
  ),
  orb: (
    <>
      <circle {...F} {...S} cx="50" cy="46" r="32" />
      <path {...D} d="M26 56 C36 70 64 70 74 56 C66 74 34 74 26 56Z" />
      <path fill="#fff" opacity={0.55} d="M32 34 C36 24 46 20 54 22 C46 26 40 30 36 40Z" />
      <path {...D} {...S} d="M30 80 L70 80 L64 92 L36 92Z" />
    </>
  ),
  spiral: (
    <path
      {...S}
      {...N}
      strokeWidth={6}
      d="M50 50 C50 44 58 44 58 50 C58 60 44 62 42 50 C40 36 60 32 66 46 C72 62 56 74 42 70 C24 64 24 38 40 30 C58 20 82 34 80 56 C78 80 50 90 32 80"
    />
  ),
  hand: (
    <>
      <path
        {...F}
        {...S}
        d="M30 90 C22 76 16 62 18 50 L20 36 C22 30 30 32 30 38 L30 20 C30 12 40 12 40 20 L40 16 C40 8 50 8 50 16 L50 18 C50 10 60 10 60 18 L60 26 C60 18 70 18 70 26 L70 60 C70 76 64 84 60 90Z"
      />
      <circle {...D} cx="50" cy="56" r="6" />
    </>
  ),
  key: (
    <>
      <circle {...F} {...S} cx="30" cy="30" r="18" />
      <circle {...D} cx="30" cy="30" r="7" />
      <path {...S} {...N} strokeWidth={7} d="M42 42 L86 86" />
      <path {...S} {...N} strokeWidth={6} d="M72 72 L62 82 M80 80 L72 88" />
    </>
  ),
  hourglass: (
    <>
      <path {...S} strokeWidth={6} d="M20 10 L80 10 M20 90 L80 90" />
      <path {...F} {...S} d="M26 12 L74 12 C74 34 56 44 54 50 C56 56 74 66 74 88 L26 88 C26 66 44 56 46 50 C44 44 26 34 26 12Z" />
      <path {...D} d="M36 88 C40 74 60 74 64 88Z M40 26 L60 26 C58 34 52 40 50 44 C48 40 42 34 40 26Z" />
    </>
  ),
  mirror: (
    <>
      <ellipse {...F} {...S} cx="50" cy="40" rx="30" ry="34" />
      <path stroke="var(--e3)" strokeWidth={3} fill="none" d="M34 22 L46 40 L38 58 M46 40 L66 34" />
      <path {...D} {...S} d="M44 74 L56 74 L58 94 L42 94Z" />
    </>
  ),
  dice: (
    <>
      <rect {...F} {...S} x="12" y="30" width="46" height="46" rx="8" transform="rotate(-14 35 53)" />
      <rect {...F} {...S} x="46" y="16" width="42" height="42" rx="8" transform="rotate(12 67 37)" />
      <circle {...D} cx="24" cy="46" r="4" />
      <circle {...D} cx="36" cy="54" r="4" />
      <circle {...D} cx="46" cy="62" r="4" />
      <circle {...D} cx="60" cy="28" r="4" />
      <circle {...D} cx="76" cy="46" r="4" />
      <circle {...D} cx="74" cy="28" r="4" />
      <circle {...D} cx="62" cy="46" r="4" />
    </>
  ),
  card: (
    <>
      <rect {...D} {...S} x="18" y="16" width="44" height="64" rx="6" transform="rotate(-12 40 48)" />
      <rect {...F} {...S} x="38" y="18" width="44" height="64" rx="6" transform="rotate(8 60 50)" />
      <path fill="var(--e2)" d="M60 36 L68 50 L60 64 L52 50Z" />
    </>
  ),
  mask: (
    <>
      <path {...F} {...S} d="M10 24 C30 16 70 16 90 24 C92 56 76 84 50 88 C24 84 8 56 10 24Z" />
      <path {...D} d="M24 40 C28 34 38 34 42 42 C36 46 30 46 24 40Z M58 42 C62 34 72 34 76 40 C70 46 64 46 58 42Z" />
      <path {...S} {...N} d="M34 66 C42 74 58 74 66 66" />
    </>
  ),
  butterfly: (
    <>
      <path {...F} {...S} d="M48 46 C36 14 6 14 10 38 C12 52 32 54 46 50 C28 60 22 80 36 86 C46 90 50 70 50 58Z" />
      <path {...F} {...S} d="M52 46 C64 14 94 14 90 38 C88 52 68 54 54 50 C72 60 78 80 64 86 C54 90 50 70 50 58Z" />
      <circle fill="var(--e2)" cx="26" cy="34" r="6" />
      <circle fill="var(--e2)" cx="74" cy="34" r="6" />
      <path {...D} d="M47 34 L53 34 L53 78 L47 78Z" />
    </>
  ),
  bag: (
    <>
      <path {...F} {...S} d="M36 24 L64 24 L60 32 C80 40 90 60 84 76 C80 88 20 88 16 76 C10 60 20 40 40 32Z" />
      <path {...S} {...N} d="M36 24 C40 14 60 14 64 24 M36 32 L64 32" />
      <circle {...D} cx="50" cy="60" r="10" />
    </>
  ),
  swap: (
    <>
      <path {...F} {...S} d="M12 34 L64 34 L64 22 L88 42 L64 62 L64 50 L12 50Z" />
      <path {...D} {...S} d="M88 66 L36 66 L36 54 L12 74 L36 94 L36 82 L88 82Z" />
    </>
  ),
  question: (
    <>
      <path {...S} {...N} strokeWidth={10} d="M30 32 C30 14 70 12 70 32 C70 46 50 48 50 62" />
      <circle fill="var(--e2)" cx="50" cy="82" r="7" />
      <path stroke="var(--e1)" strokeWidth={4} fill="none" d="M30 32 C30 14 70 12 70 32 C70 46 50 48 50 62" />
    </>
  ),
  crown: (
    <>
      <path {...F} {...S} d="M12 74 L8 28 L30 48 L50 18 L70 48 L92 28 L88 74Z" />
      <path {...D} {...S} d="M12 74 L88 74 L86 86 L14 86Z" />
      <circle fill="var(--e2)" cx="50" cy="60" r="6" />
    </>
  ),
  feather: (
    <>
      <path {...F} {...S} d="M84 10 C50 14 24 40 20 76 L28 70 C34 60 46 56 56 54 C48 52 44 48 46 44 C58 44 66 40 70 32 C64 32 60 30 60 26 C72 24 80 18 84 10Z" />
      <path {...S} {...N} d="M14 92 L30 68 C44 48 62 30 84 10" />
    </>
  ),
  bell: (
    <>
      <path {...F} {...S} d="M50 10 C70 10 76 28 76 46 C76 60 82 68 90 74 L10 74 C18 68 24 60 24 46 C24 28 30 10 50 10Z" />
      <circle fill="var(--e2)" cx="50" cy="84" r="8" />
      <path {...S} {...N} d="M50 4 L50 10" />
    </>
  ),
  lantern: (
    <>
      <path {...S} {...N} d="M40 12 C40 2 60 2 60 12" />
      <path {...D} {...S} d="M34 14 L66 14 L70 24 L30 24Z" />
      <path {...F} {...S} d="M32 24 L68 24 L64 80 L36 80Z" />
      <path fill="var(--e2)" d="M50 38 C56 48 58 56 50 66 C42 56 44 48 50 38Z" />
      <path {...D} {...S} d="M32 80 L68 80 L64 90 L36 90Z" />
    </>
  ),
  egg: (
    <>
      <path {...F} {...S} d="M50 8 C72 8 84 44 84 60 C84 80 70 92 50 92 C30 92 16 80 16 60 C16 44 28 8 50 8Z" />
      <path stroke="var(--e3)" strokeWidth={3} fill="none" d="M20 56 L34 48 L42 60 L54 48 L64 60 L80 52" />
      <circle fill="var(--e2)" cx="38" cy="74" r="4" />
      <circle fill="var(--e2)" cx="62" cy="30" r="3" />
    </>
  ),
  lens: (
    <>
      <circle {...F} {...S} cx="40" cy="40" r="26" />
      <path fill="#fff" opacity={0.5} d="M26 30 C30 22 40 18 48 20 C40 24 34 28 30 36Z" />
      <path {...S} {...N} strokeWidth={9} d="M60 60 L88 88" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type EmblemName = keyof typeof EMBLEMS;
