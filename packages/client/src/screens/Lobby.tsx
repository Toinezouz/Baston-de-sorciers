import type { PlayerView } from "@baston/engine";
import type { BotLevelName } from "@baston/shared";
import { useState } from "react";
import { RulesDialog } from "../components/RulesDialog";
import { useGameClient } from "../hooks/useGame";

/** Salle d'attente : code et lien à partager, joueurs, prêt, lancement par l'hôte. */
export function Lobby({ view }: { view: PlayerView }) {
  const client = useGameClient();
  const [rules, setRules] = useState(false);
  const [botLevel, setBotLevel] = useState<BotLevelName>("normal");
  const pub = view.public;
  const myId = view.private?.playerId;
  const mine = pub.players.find((p) => p.id === myId);
  const isHost = pub.hostId === myId;
  const link = `${location.origin}/partie/${pub.id}`;
  const others = pub.players.filter((p) => p.id !== pub.hostId);
  const full = pub.players.length >= pub.config.maxPlayers;
  const canStart = isHost && pub.players.length >= pub.config.minPlayers && others.every((p) => p.ready);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      client.toast("Lien copié !", "info");
    } catch {
      client.toast(`Copie impossible : partage ce lien → ${link}`, "info");
    }
  };

  return (
    <main className="lobby">
      <section className="lobby-code">
        <p>Code de la partie</p>
        <strong className="code" aria-label={`Code ${pub.id.split("").join(" ")}`}>
          {pub.id}
        </strong>
        <div className="row">
          <button type="button" className="btn" onClick={() => void copy()}>
            🔗 Copier le lien d'invitation
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setRules(true)}>
            📜 Règles
          </button>
        </div>
        <p className="hint">
          {pub.config.crownsToWin === 1 ? "Mode rapide" : "Mode standard"} · {pub.config.startingHp} PV ·{" "}
          {pub.config.crownsToWin} Couronne{pub.config.crownsToWin > 1 ? "s" : ""} pour gagner
        </p>
      </section>

      <section className="lobby-players" aria-label="Sorciers présents">
        <h2>
          Sorciers ({pub.players.length}/{pub.config.maxPlayers})
        </h2>
        <ul>
          {pub.players.map((p) => (
            <li key={p.id} className={p.id === myId ? "is-me" : undefined}>
              <span className={`dot dot-${p.connection.toLowerCase()}`} aria-hidden />
              <span className="lobby-name">
                {p.isBot && <span aria-label="bot">🤖 </span>}
                {p.name}
                {p.id === myId && " (toi)"}
              </span>
              {p.isHost ? <span className="badge">hôte</span> : p.ready ? <span className="badge badge-ok">prêt ✔</span> : <span className="badge badge-wait">pas prêt</span>}
              {p.connection === "DISCONNECTED" && <span className="badge badge-wait">déconnecté</span>}
              {p.isBot && isHost && (
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => void client.removeBot(p.id)} aria-label={`Retirer ${p.name}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {isHost && (
          <div className="add-bot">
            <select value={botLevel} onChange={(e) => setBotLevel(e.target.value as BotLevelName)} aria-label="Niveau du bot">
              <option value="facile">Bot facile</option>
              <option value="normal">Bot normal</option>
              <option value="difficile">Bot difficile</option>
            </select>
            <button type="button" className="btn" disabled={full} onClick={() => void client.addBot(botLevel)}>
              🤖 Ajouter un bot
            </button>
          </div>
        )}
      </section>

      <section className="lobby-actions">
        {isHost ? (
          <>
            <button type="button" className="btn btn-primary btn-big" disabled={!canStart} onClick={() => void client.act({ type: "START_GAME" })}>
              ⚔ Lancer la baston
            </button>
            {!canStart && (
              <p className="hint">
                {pub.players.length < pub.config.minPlayers ? "En attente d'au moins un autre sorcier…" : "En attente que tout le monde soit prêt…"}
              </p>
            )}
          </>
        ) : (
          <button
            type="button"
            className={`btn btn-big ${mine?.ready ? "" : "btn-primary"}`}
            onClick={() => void client.act({ type: "SET_READY", ready: !mine?.ready })}
          >
            {mine?.ready ? "Je ne suis plus prêt" : "✔ Je suis prêt"}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => void client.leave()}>
          Quitter
        </button>
      </section>
      {rules && <RulesDialog onClose={() => setRules(false)} />}
    </main>
  );
}
