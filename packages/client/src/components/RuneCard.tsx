import { getCardDef } from "@baston/engine";
import { CardArt } from "../art/CardArt";
import { SCHOOL_ICON, SCHOOL_LABEL, SLOT_LABEL } from "../game/helpers";

interface Props {
  defId: string;
  size?: "md" | "sm" | "xs";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Libellé accessible de l'action au clic. */
  actionLabel?: string;
  /** Raccourci clavier affiché sur la carte. */
  shortcut?: string;
}

/** Carte de rune : couleur d'école, emplacement, initiative, nom et texte de règles. */
export function RuneCard({ defId, size = "md", selected, disabled, onClick, actionLabel, shortcut }: Props) {
  const def = getCardDef(defId);
  const schools = def.schools;
  const special = def.kind === "RELIC" ? "#f4b942" : def.kind === "GRUDGE" ? "#7fe3d4" : null;
  const style = {
    "--c1": special ?? (schools[0] ? `var(--school-${schools[0].toLowerCase()})` : "var(--unstable)"),
    "--c2": special ?? (schools[1] ? `var(--school-${schools[1].toLowerCase()})` : schools[0] ? `var(--school-${schools[0].toLowerCase()})` : "var(--unstable-2)"),
  } as React.CSSProperties;
  const kindLabel =
    def.kind === "RELIC" ? (def.eternal ? "Relique éternelle" : "Relique") : def.kind === "GRUDGE" ? "Rancune" : def.unstable ? "Libre" : SLOT_LABEL[def.slot!];
  const content = (
    <>
      <span className="rune-top">
        <span className="rune-slot">{kindLabel}</span>
        {def.initiative !== undefined && (
          <span className="rune-init" title="Initiative">
            ⚡{def.initiative}
          </span>
        )}
      </span>
      {size !== "xs" && <CardArt defId={defId} className="rune-art" />}
      <span className="rune-name">{def.name}</span>
      {def.kind === "RUNE" && (
        <span className="rune-schools" aria-label={schools.map((s) => SCHOOL_LABEL[s]).join(" et ") || "Instable"}>
          {schools.length ? schools.map((s) => SCHOOL_ICON[s]).join("") : "❓"}
        </span>
      )}
      {size !== "xs" && <span className="rune-text">{def.text}</span>}
      {shortcut && (
        <kbd className="rune-key" aria-hidden>
          {shortcut}
        </kbd>
      )}
    </>
  );
  const cls = `rune rune-${size}${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}${def.unstable ? " is-unstable" : ""}`;
  if (!onClick) {
    return (
      <div className={cls} style={style} title={`${def.name} — ${def.text}`}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${actionLabel ? `${actionLabel} : ` : ""}${def.name}. ${def.text}`}
      title={`${def.name} — ${def.text}`}
    >
      {content}
    </button>
  );
}
