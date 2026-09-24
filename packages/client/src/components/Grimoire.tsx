import { allCardDefs, SCHOOLS, type CardKind, type School } from "@baston/engine";
import { useMemo, useState } from "react";
import { SCHOOL_ICON, SCHOOL_LABEL, sortHand } from "../game/helpers";
import { Modal } from "./Modal";
import { RuneCard } from "./RuneCard";

const KINDS: { id: CardKind; label: string }[] = [
  { id: "RUNE", label: "Runes" },
  { id: "RELIC", label: "Reliques" },
  { id: "GRUDGE", label: "Rancunes" },
];

/** Grimoire : toutes les cartes du jeu, illustrées, filtrables par type et par école. */
export function Grimoire({ onClose }: { onClose(): void }) {
  const [kind, setKind] = useState<CardKind>("RUNE");
  const [school, setSchool] = useState<School | "ALL">("ALL");
  const cards = useMemo(() => allCardDefs().filter((c) => c.copies > 0), []);
  const shown = useMemo(() => {
    const list = cards.filter((c) => c.kind === kind && (kind !== "RUNE" || school === "ALL" || c.schools.includes(school)));
    return kind === "RUNE" ? sortHand(list.map((c) => ({ ...c, defId: c.id }))) : list.map((c) => ({ ...c, defId: c.id }));
  }, [cards, kind, school]);
  return (
    <Modal title={`Grimoire — ${cards.length} cartes`} onClose={onClose} className="grimoire">
      <div className="grimoire-filters" role="tablist">
        {KINDS.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={`btn ${kind === k.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setKind(k.id)}>
            {k.label} ({cards.filter((c) => c.kind === k.id).length})
          </button>
        ))}
      </div>
      {kind === "RUNE" && (
        <div className="grimoire-filters">
          <button type="button" className={`btn btn-icon ${school === "ALL" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSchool("ALL")}>
            Toutes
          </button>
          {SCHOOLS.map((s) => (
            <button key={s} type="button" className={`btn btn-icon ${school === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setSchool(s)} title={SCHOOL_LABEL[s]}>
              {SCHOOL_ICON[s]} {SCHOOL_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      <div className="grimoire-grid">
        {shown.map((c) => (
          <RuneCard key={c.id} defId={c.id} />
        ))}
      </div>
    </Modal>
  );
}
