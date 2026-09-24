import type { PrivatePlayerView } from "@baston/engine";
import { useState } from "react";
import { Modal } from "./Modal";
import { Timer } from "./Timer";

type Pending = NonNullable<PrivatePlayerView["pendingChoice"]>;

interface Props {
  choice: Pending;
  deadline: number | undefined;
  clockOffset: number;
  totalMs: number;
  describe(optionId: string): string | undefined;
  onChoose(ids: string[]): void;
}

/** Choix demandé en cours de résolution (cible, option, cartes à défausser). */
export function ChoiceDialog({ choice, deadline, clockOffset, totalMs, describe, onChoose }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const single = choice.max === 1 && choice.min === 1;
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < choice.max ? [...p, id] : p));
  return (
    <Modal title={choice.prompt} className="choice">
      {deadline !== undefined && <Timer deadline={deadline} clockOffset={clockOffset} totalMs={totalMs} label="Temps pour choisir" />}
      <div className="choice-options">
        {choice.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`btn choice-option${picked.includes(o.id) ? " is-picked" : ""}`}
            aria-pressed={single ? undefined : picked.includes(o.id)}
            onClick={() => (single ? onChoose([o.id]) : toggle(o.id))}
          >
            <strong>{o.label}</strong>
            {describe(o.id) && <small>{describe(o.id)}</small>}
          </button>
        ))}
      </div>
      {!single && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={picked.length < choice.min || picked.length > choice.max}
          onClick={() => onChoose(picked)}
        >
          Valider ({picked.length}/{choice.min})
        </button>
      )}
      <p className="hint">Sans réponse à temps, le serveur choisira au hasard.</p>
    </Modal>
  );
}
