import type { PlayerView } from "@baston/engine";
import { useEffect } from "react";
import { play } from "../audio";
import { Modal } from "../components/Modal";

const REASON: Record<string, string> = {
  CROWNS: "par les Couronnes",
  MAX_ROUNDS: "au nombre de manches",
  FORFEIT: "par forfait",
  DRAW: "égalité parfaite",
  ENGINE_ERROR: "erreur",
};

/** Écran de fin : vainqueur et classement. */
export function GameOver({
  view,
  onLeave,
  onRematch,
  rematchBy,
}: {
  view: PlayerView;
  onLeave(): void;
  onRematch(): void;
  /** Nom du joueur ayant proposé une revanche, le cas échéant. */
  rematchBy: string | null;
}) {
  const pub = view.public;
  const winner = pub.players.find((p) => p.id === pub.winnerId);
  const iWon = winner && winner.id === view.private?.playerId;
  useEffect(() => {
    play(iWon ? "win" : "lose");
  }, [iWon]);
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
      <div className="row">
        <button type="button" className="btn btn-primary btn-big" onClick={onRematch}>
          {rematchBy ? `⚔ Rejoindre la revanche de ${rematchBy}` : "⚔ Revanche !"}
        </button>
        <button type="button" className="btn btn-big" onClick={onLeave}>
          Retour à l'accueil
        </button>
      </div>
    </Modal>
  );
}
