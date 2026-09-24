import { RUNE_SLOTS, getCardDef, type CardView, type RuneSlot } from "@baston/engine";
import { powerPreview, SCHOOL_ICON, SCHOOL_LABEL, SLOT_HINT, SLOT_LABEL } from "../game/helpers";
import { RuneCard } from "./RuneCard";

interface Props {
  spell: Partial<Record<RuneSlot, CardView>>;
  editable: boolean;
  locked: boolean;
  /** Rune instable sélectionnée, en attente d'un emplacement. */
  pendingSlotPick: boolean;
  onSlotClick(slot: RuneSlot): void;
  onLock(): void;
  onUnlock(): void;
  waitingFor: number;
  /** Dés bonus de Concentration par taille de sort. */
  focusDice: readonly number[];
}

/** Les trois emplacements du sort en préparation, l'aperçu de puissance et le bouton de lancement. */
export function SpellBuilder({ spell, editable, locked, pendingSlotPick, onSlotClick, onLock, onUnlock, waitingFor, focusDice }: Props) {
  const defIds = RUNE_SLOTS.map((s) => spell[s]?.defId).filter((d): d is string => !!d);
  const preview = powerPreview(defIds, focusDice);
  const focus = focusDice[defIds.length - 1] ?? 0;
  const frappe = spell.FRAPPE ? getCardDef(spell.FRAPPE.defId).initiative ?? 0 : 0;
  return (
    <section className={`spell${locked ? " is-locked" : ""}`} aria-label="Mon sort">
      <div className="spell-slots">
        {RUNE_SLOTS.map((slot) => {
          const card = spell[slot];
          return (
            <div key={slot} className={`slot${card ? " is-filled" : ""}${pendingSlotPick && editable ? " is-target" : ""}`}>
              <span className="slot-label">
                {SLOT_LABEL[slot]} <small>{SLOT_HINT[slot]}</small>
              </span>
              {card ? (
                <RuneCard
                  defId={card.defId}
                  size="sm"
                  onClick={editable ? () => onSlotClick(slot) : undefined}
                  actionLabel="Retirer du sort"
                />
              ) : (
                <button
                  type="button"
                  className="slot-empty"
                  disabled={!editable || !pendingSlotPick}
                  onClick={() => onSlotClick(slot)}
                  aria-label={`Emplacement ${SLOT_LABEL[slot]} vide`}
                >
                  {pendingSlotPick && editable ? "Placer ici" : "—"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="spell-info">
        {defIds.length > 0 ? (
          <>
            <span title="Moins de runes = résolu plus tôt">
              {defIds.length} rune{defIds.length > 1 ? "s" : ""} · ⚡{frappe}
            </span>
            {focus > 0 && <span title="Concentration : dés bonus des sorts courts">🎯 +{focus} dé{focus > 1 ? "s" : ""}</span>}
            {preview.map((p) => (
              <span key={p.school} title={`Puissance de ${SCHOOL_LABEL[p.school]}`}>
                {SCHOOL_ICON[p.school]} {p.dice} dé{p.dice > 1 ? "s" : ""}
              </span>
            ))}
          </>
        ) : (
          <span>Choisis 1 à 3 runes dans ta main.</span>
        )}
      </div>
      <div className="spell-actions">
        {locked ? (
          <>
            <span className="waiting">
              ✔ Sort prêt{waitingFor > 0 ? ` — en attente de ${waitingFor} sorcier${waitingFor > 1 ? "s" : ""}` : ""}
            </span>
            {editable && (
              <button type="button" className="btn btn-ghost" onClick={onUnlock}>
                Modifier
              </button>
            )}
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-cast" disabled={!editable || defIds.length === 0} onClick={onLock}>
            🔮 Lancer le sort
          </button>
        )}
      </div>
    </section>
  );
}
