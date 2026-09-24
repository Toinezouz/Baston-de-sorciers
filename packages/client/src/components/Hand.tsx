import { getCardDef, type CardView } from "@baston/engine";
import { sortHand } from "../game/helpers";
import { RuneCard } from "./RuneCard";

interface Props {
  cards: CardView[];
  playable: boolean;
  selectedId: string | null;
  onPlay(card: CardView): void;
}

/** Main du joueur : cliquer une rune la place dans son emplacement. */
export function Hand({ cards, playable, selectedId, onPlay }: Props) {
  return (
    <section className="hand" aria-label={`Ma main (${cards.length} runes)`}>
      {cards.length === 0 && <p className="hand-empty">Main vide.</p>}
      {sortHand(cards).map((c, i) => (
        <RuneCard
          key={c.id}
          {...(playable && i < 9 ? { shortcut: String(i + 1) } : {})}
          defId={c.defId}
          selected={selectedId === c.id}
          disabled={!playable}
          onClick={() => onPlay(c)}
          actionLabel={getCardDef(c.defId).unstable ? "Choisir un emplacement pour" : "Ajouter au sort"}
        />
      ))}
    </section>
  );
}
