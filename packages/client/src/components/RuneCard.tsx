import { getCardDef } from "@baston/engine";
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
  const style = {
    "--c1": schools[0] ? `var(--school-${schools[0].toLowerCase()})` : "var(--unstable)",
    "--c2": schools[1] ? `var(--school-${schools[1].toLowerCase()})` : schools[0] ? `var(--school-${schools[0].toLowerCase()})` : "var(--unstable-2)",
  } as React.CSSProperties;
  const content = (
    <>
      <span className="rune-top">
        <span className="rune-slot">{def.unstable ? "Libre" : SLOT_LABEL[def.slot!]}</span>
        {def.initiative !== undefined && (
          <span className="rune-init" title="Initiative">
            ⚡{def.initiative}
          </span>
        )}
      </span>
      <span className="rune-name">{def.name}</span>
      <span className="rune-schools" aria-label={schools.map((s) => SCHOOL_LABEL[s]).join(" et ") || "Instable"}>
        {schools.length ? schools.map((s) => SCHOOL_ICON[s]).join("") : "❓"}
      </span>
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
