import { Modal } from "./Modal";

/** Règles résumées, accessibles depuis l'accueil et la table. */
export function RulesDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal title="Comment jouer" onClose={onClose} className="rules">
      <ol>
        <li>
          <strong>Prépare ton sort en secret.</strong> Choisis 1 à 3 runes dans ta main, une par emplacement :
          <em> Amorce</em> → <em>Torsion</em> → <em>Frappe</em>.
        </li>
        <li>
          <strong>Révélation.</strong> Quand tout le monde a verrouillé (ou que le temps est écoulé), les sorts sont révélés.
        </li>
        <li>
          <strong>Initiative.</strong> Les sorts les plus <em>courts</em> se résolvent en premier. À égalité, la plus haute
          initiative ⚡ de la Frappe passe devant.
        </li>
        <li>
          <strong>Puissance.</strong> Une rune « Puissance » lance 1 dé par rune de la même école dans ton sort :
          1–4, 5–9 ou 10+. Mélanger les écoles, c'est plus rapide ; les assortir, c'est plus fort.
        </li>
        <li>
          <strong>Dernier debout.</strong> Le dernier sorcier en vie gagne une 👑 Couronne et une relique. Les morts
          reviennent à la manche suivante avec une Rancune d'outre-tombe. Deux Couronnes remportent la baston.
        </li>
      </ol>
      <p className="hint">
        Écoles : 🔥 Braise (dégâts, brûlures) · 🌑 Ombre (vol de vie, venin) · 🌿 Sève (soins, protection) · ✨ Éther
        (pioche, dés, boucliers) · 🎭 Chimère (hasard, vols). Une rune ❓ instable devient la première rune compatible de la pioche.
      </p>
    </Modal>
  );
}
