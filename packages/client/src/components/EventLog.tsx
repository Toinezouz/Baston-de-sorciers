import { describeEvent, type GameEvent } from "@baston/engine";
import { useEffect, useMemo, useRef } from "react";

const IMPORTANT = new Set(["PLAYER_DIED", "ROUND_ENDED", "CROWN_AWARDED", "GAME_OVER", "ROUND_STARTED", "SPELL_CAST"]);

/** Journal de partie lisible, annoncé aux lecteurs d'écran. */
export function EventLog({ log, name }: { log: GameEvent[]; name: (id: string | null | undefined) => string }) {
  const lines = useMemo(
    () =>
      log
        .map((e) => ({ e, text: describeEvent(e, name) }))
        .filter((x): x is { e: GameEvent; text: string } => !!x.text && x.e.type !== "PHASE_CHANGED"),
    [log, name],
  );
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);
  return (
    <section className="log" aria-label="Journal de la partie">
      <h2 className="log-title">Journal</h2>
      <ol className="log-list" aria-live="polite" aria-relevant="additions">
        {lines.map(({ e, text }) => (
          <li
            key={e.seq}
            className={`log-line depth-${Math.min(e.depth, 3)}${IMPORTANT.has(e.type) ? " is-important" : ""} ev-${e.type.toLowerCase()}`}
          >
            {text}
          </li>
        ))}
        <li ref={endRef} aria-hidden className="log-end" />
      </ol>
    </section>
  );
}
