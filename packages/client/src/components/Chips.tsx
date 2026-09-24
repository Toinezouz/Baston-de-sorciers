import { cardDef, statusDef, summonDef } from "../game/cards";
import { type CardView, type StatusInstance, type Summon } from "@baston/engine";

export function StatusChips({ statuses }: { statuses: StatusInstance[] }) {
  if (!statuses.length) return null;
  return (
    <ul className="chips" aria-label="Effets actifs">
      {statuses.map((s) => {
        const def = statusDef(s.defId);
        const turns = s.remaining === "PERMANENT" ? "manche" : `${s.remaining} t.`;
        return (
          <li key={s.id} className={`chip chip-${def.polarity.toLowerCase()}`} title={`${def.name} : ${def.text} (${turns})`}>
            {def.name}
            {s.stacks > 1 && <b>×{s.stacks}</b>}
            <small>{turns}</small>
          </li>
        );
      })}
    </ul>
  );
}

export function RelicChips({ relics }: { relics: CardView[] }) {
  if (!relics.length) return null;
  return (
    <ul className="chips" aria-label="Reliques">
      {relics.map((r) => {
        const def = cardDef(r.defId);
        return (
          <li key={r.id} className={`chip chip-relic${def.eternal ? " chip-eternal" : ""}`} title={`${def.name} : ${def.text}`}>
            🏺 {def.name}
          </li>
        );
      })}
    </ul>
  );
}

export function SummonChips({ summons }: { summons: Summon[] }) {
  if (!summons.length) return null;
  return (
    <ul className="chips" aria-label="Invocations">
      {summons.map((s) => {
        const def = summonDef(s.defId);
        return (
          <li key={s.id} className="chip chip-summon" title={`${def.name} : ${def.text}`}>
            🐾 {def.name} <b>{s.hp}/{s.maxHp}</b>
          </li>
        );
      })}
    </ul>
  );
}
