import { describeEvent, type GameEvent, type RuneSlot } from "@baston/engine";
import { useEffect, useMemo, useState } from "react";
import { play, sfxForEvents } from "../audio";
import { SLOT_LABEL } from "../game/helpers";
import { stepDuration, type ReplayStep } from "../game/replay";
import { RuneCard } from "./RuneCard";

const DIE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

interface Props {
  steps: ReplayStep[];
  name(id: string | null | undefined): string;
  onDone(): void;
}

/**
 * Rejeu animé de la résolution d'un tour, étape par étape (sorts, runes, dés, effets).
 * Décoratif : l'état final est déjà affiché ; le joueur peut passer à tout moment.
 */
export function ResolutionReplay({ steps, name, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const step = steps[index];

  useEffect(() => {
    if (!step) {
      onDone();
      return;
    }
    const types = step.events.map((e) => e.type);
    if (step.kind === "reveal") play("reveal");
    else if (step.kind === "cast") play("cast");
    else if (types.includes("DICE_ROLLED")) play("dice");
    const sfx = sfxForEvents(types);
    const t1 = sfx ? setTimeout(() => play(sfx), 350) : undefined;
    const t2 = setTimeout(() => setIndex((i) => i + 1), stepDuration(step));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step, onDone]);

  const lines = useMemo(
    () =>
      (step?.events ?? [])
        .filter((e) => e.type !== "DICE_ROLLED" && e.type !== "CARDS_DRAWN")
        .map((e) => ({ e, text: describeEvent(e, name) }))
        .filter((x): x is { e: GameEvent; text: string } => !!x.text),
    [step, name],
  );
  if (!step) return null;
  const dice = step.events.find((e) => e.type === "DICE_ROLLED");

  return (
    <div className="replay" aria-live="polite">
      <div className="replay-head">
        <span className="replay-progress" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={i <= index ? "is-done" : undefined} />
          ))}
        </span>
        <button type="button" className="btn btn-ghost replay-skip" onClick={onDone}>
          Passer ⏭
        </button>
      </div>

      <div className="replay-step" key={index}>
        {step.kind === "reveal" && (
          <>
            <h3 className="replay-title">Révélation des sorts !</h3>
            <ul className="replay-reveal">
              {(step.header.data.spells as { playerId: string; runes: Partial<Record<RuneSlot, string>> }[])
                .filter((s) => Object.keys(s.runes).length)
                .map((s) => (
                  <li key={s.playerId}>
                    <strong>{name(s.playerId)}</strong>
                    <span className="table-runes">
                      {Object.values(s.runes).map((d, i) => (
                        <RuneCard key={i} defId={d!} size="xs" />
                      ))}
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
        {step.kind === "cast" && (
          <h3 className="replay-title replay-cast">
            ✨ {name(step.header.sourceId)} lance son sort ({(step.header.data.runes as string[]).length} rune
            {(step.header.data.runes as string[]).length > 1 ? "s" : ""})
          </h3>
        )}
        {step.kind === "rune" && (
          <div className="replay-rune">
            <div className="replay-card">
              <small>
                {name(step.header.sourceId)} · {SLOT_LABEL[step.header.data.slot as RuneSlot]}
              </small>
              <RuneCard defId={String(step.header.data.defId)} size="sm" />
            </div>
            {dice && (
              <div className="replay-dice" aria-label={`Dés : ${(dice.data.rolls as number[]).join(", ")}, total ${dice.data.total}`}>
                {(dice.data.rolls as number[]).map((r, i) => (
                  <span key={i} className="die" style={{ animationDelay: `${i * 80}ms` }}>
                    {DIE[r]}
                  </span>
                ))}
                <span className="dice-total">
                  = {String(dice.data.total)} <em>palier {String(dice.data.tier)}</em>
                </span>
              </div>
            )}
          </div>
        )}
        {step.kind === "turnEnd" && <h3 className="replay-title">Fin du tour</h3>}
        {step.kind === "roundEnd" && <h3 className="replay-title replay-cast">{describeEvent(step.header, name)}</h3>}

        <ul className="replay-lines">
          {lines.map(({ e, text }, i) => (
            <li key={e.seq} className={`depth-${Math.min(e.depth, 3)} ev-${e.type.toLowerCase()}`} style={{ animationDelay: `${250 + i * 260}ms` }}>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
