import type { PlayerView } from "@baston/engine";
import { Modal } from "../components/Modal";

const REASON: Record<string, string> = {
  CROWNS: "par les Couronnes",
  MAX_ROUNDS: "au nombre de manches",
  FORFEIT: "par forfait",
  DRAW: "égalité parfaite",
  ENGINE_ERROR: "erreur",
};

/** Écran de fin : vainqueur et classement. */
export function GameOver({ view, onLeave }: { view: PlayerView; onLeave(): void }) {
  const pub = view.public;
  const winner = pub.players.find((p) => p.id === pub.winnerId);
  const iWon = winner && winner.id === view.private?.playerId;
  const ranking = [...pub.players].sort((a, b) => b.crowns - a.crowns || b.stats.damageDealt - a.stats.damageDealt);
  return (
    <Modal title={winner ? (iWon ? "🏆 Victoire !" : `${winner.name} remporte la baston !`) : "Pas de vainqueur"} className="gameover">
      <p className="hint">Fin de partie {REASON[pub.endReason ?? ""] ?? ""}.</p>
      <table className="ranking">
        <thead>
          <tr>
            <th>Sorcier</th>
            <th title="Couronnes">👑</th>
            <th title="Dégâts infligés">Dégâts</th>
            <th title="Éliminations">Élim.</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((p) => (
            <tr key={p.id} className={p.id === pub.winnerId ? "is-winner" : undefined}>
              <td>
                {p.name}
                {p.id === view.private?.playerId && " (toi)"}
              </td>
              <td>{p.crowns}</td>
              <td>{p.stats.damageDealt}</td>
              <td>{p.stats.kills}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-primary btn-big" onClick={onLeave}>
        Retour à l'accueil
      </button>
    </Modal>
  );
}
