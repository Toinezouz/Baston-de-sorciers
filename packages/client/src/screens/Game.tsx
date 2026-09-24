import { getCardDef, type CardView, type PlayerView, type RuneSlot } from "@baston/engine";
import { useCallback, useMemo, useState } from "react";
import { ChoiceDialog } from "../components/ChoiceDialog";
import { EventLog } from "../components/EventLog";
import { Hand } from "../components/Hand";
import { PlayerPanel } from "../components/PlayerPanel";
import { RuneCard } from "../components/RuneCard";
import { RulesDialog } from "../components/RulesDialog";
import { SpellBuilder } from "../components/SpellBuilder";
import { Timer } from "../components/Timer";
import { lastRevealedSpells, me as meOf, nameResolver, opponents } from "../game/helpers";
import { useClientState, useGameClient } from "../hooks/useGame";
import { GameOver } from "./GameOver";

/** Table de jeu. */
export function Game({ view }: { view: PlayerView }) {
  const client = useGameClient();
  const { game, log, lastEvents, clockOffset } = useClientState();
  const [unstablePick, setUnstablePick] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [rules, setRules] = useState(false);

  const pub = view.public;
  const priv = view.private!;
  const self = meOf(view);
  const others = opponents(view);
  const name = useMemo(() => nameResolver(view, log), [view, log]);
  const deadlines = game?.deadlines ?? {};
  const planningTimer = pub.timers.find((t) => t.kind === "PLANNING");
  const choiceTimer = pub.timers.find((t) => t.kind === "CHOICE");

  const planning = pub.phase === "PLANNING";
  const editable = planning && !!self?.alive && priv.legalActions.includes("PLACE_RUNE");
  const locked = !!self?.spell?.locked;
  const waitingFor = pub.players.filter((p) => p.alive && p.id !== self?.id && !p.spell?.locked).length;
  const chooserId = pub.pendingChoice?.playerId ?? null;
  const revealed = lastRevealedSpells(log);

  const play = useCallback(
    (card: CardView) => {
      const def = getCardDef(card.defId);
      if (def.unstable) {
        setUnstablePick((cur) => (cur === card.id ? null : card.id));
        return;
      }
      setUnstablePick(null);
      void client.act({ type: "PLACE_RUNE", cardId: card.id, slot: def.slot! });
    },
    [client],
  );

  const onSlot = useCallback(
    (slot: RuneSlot) => {
      if (unstablePick) {
        void client.act({ type: "PLACE_RUNE", cardId: unstablePick, slot });
        setUnstablePick(null);
      } else if (priv.spell[slot]) {
        void client.act({ type: "REMOVE_RUNE", slot });
      }
    },
    [client, unstablePick, priv.spell],
  );

  let banner: string;
  if (pub.phase === "GAME_OVER") banner = "Partie terminée";
  else if (pub.phase === "AWAITING_CHOICE") banner = chooserId === self?.id ? "À toi de choisir !" : `${name(chooserId)} fait un choix…`;
  else if (!self?.alive) banner = "Tu es éliminé pour cette manche — regarde la suite !";
  else if (planning && !locked) banner = "Prépare ton sort en secret !";
  else if (planning) banner = waitingFor ? `Sort prêt. En attente de ${waitingFor} sorcier${waitingFor > 1 ? "s" : ""}…` : "Révélation…";
  else banner = "Résolution…";

  const leave = () => {
    if (pub.phase === "GAME_OVER" || confirm("Quitter la partie ? Tu seras éliminé.")) void client.leave();
  };

  return (
    <div className="game">
      <header className="game-head">
        <div className="game-meta">
          <strong>Manche {pub.round}</strong> · Tour {pub.turn}
          <span className="hint"> · {pub.config.crownsToWin} 👑 pour gagner</span>
        </div>
        <p className="banner" aria-live="polite">
          {banner}
        </p>
        <div className="game-tools">
          {planningTimer && deadlines[planningTimer.id] !== undefined && (
            <Timer deadline={deadlines[planningTimer.id]!} clockOffset={clockOffset} totalMs={planningTimer.durationMs} label="Préparation" />
          )}
          {choiceTimer && deadlines[choiceTimer.id] !== undefined && (
            <Timer deadline={deadlines[choiceTimer.id]!} clockOffset={clockOffset} totalMs={choiceTimer.durationMs} label="Choix" />
          )}
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setRules(true)} aria-label="Règles">
            📜
          </button>
          <button type="button" className="btn btn-ghost btn-icon log-toggle" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen} aria-label="Journal">
            🗒
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={leave} aria-label="Quitter la partie">
            🚪
          </button>
        </div>
      </header>

      <section className="opponents" aria-label="Adversaires">
        {others.map((p) => (
          <PlayerPanel
            key={p.id}
            player={p}
            summons={pub.summons}
            isActive={pub.activeCasterId === p.id}
            isChoosing={chooserId === p.id}
            lastEvents={lastEvents}
            version={game?.version ?? 0}
          />
        ))}
      </section>

      <section className="table" aria-label="Zone de jeu">
        {revealed && revealed.spells.length > 0 ? (
          <>
            <h2 className="table-title">
              Sorts du tour {revealed.turn}
              {revealed.round !== pub.round ? ` (manche ${revealed.round})` : ""} — ordre de résolution
            </h2>
            <ol className="table-spells">
              {revealed.spells.map((s, i) => (
                <li key={s.playerId} className="table-spell">
                  <span className="table-order">{i + 1}</span>
                  <span className="table-caster">{name(s.playerId)}</span>
                  <span className="table-runes">
                    {(Object.values(s.runes) as string[]).map((d, j) => (
                      <RuneCard key={j} defId={d} size="xs" />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="table-empty">Les sorts révélés apparaîtront ici.</p>
        )}
      </section>

      {self && (
        <section className="me-zone" aria-label="Mon sorcier">
          <PlayerPanel player={self} summons={pub.summons} isMe lastEvents={lastEvents} version={game?.version ?? 0} compact />
          {self.alive && pub.phase !== "GAME_OVER" && (
            <SpellBuilder
              spell={priv.spell}
              editable={editable || (planning && locked && priv.legalActions.includes("UNLOCK_SPELL"))}
              locked={locked}
              pendingSlotPick={!!unstablePick}
              onSlotClick={onSlot}
              onLock={() => void client.act({ type: "LOCK_SPELL" })}
              onUnlock={() => void client.act({ type: "UNLOCK_SPELL" })}
              waitingFor={waitingFor}
            />
          )}
        </section>
      )}

      <Hand cards={priv.hand} playable={editable && !locked} selectedId={unstablePick} onPlay={play} />
      {unstablePick && <p className="hint hand-hint">Rune instable : choisis un emplacement dans ton sort.</p>}

      {logOpen && <div className="log-backdrop" onClick={() => setLogOpen(false)} aria-hidden />}
      <aside className={`log-panel${logOpen ? " is-open" : ""}`}>
        <EventLog log={log} name={name} />
        <button type="button" className="btn btn-ghost log-close" onClick={() => setLogOpen(false)}>
          Fermer le journal
        </button>
      </aside>

      {priv.pendingChoice && (
        <ChoiceDialog
          key={priv.pendingChoice.requestId}
          choice={priv.pendingChoice}
          deadline={deadlines[priv.pendingChoice.timerId]}
          clockOffset={clockOffset}
          totalMs={pub.config.choiceMs}
          describe={(id) => {
            const p = pub.players.find((x) => x.id === id);
            if (p) return `${p.hp} PV`;
            const s = pub.summons.find((x) => x.id === id);
            return s ? `${s.hp} PV · invocation` : undefined;
          }}
          onChoose={(ids) => void client.act({ type: "CHOOSE", requestId: priv.pendingChoice!.requestId, optionIds: ids })}
        />
      )}
      {pub.phase === "GAME_OVER" && <GameOver view={view} onLeave={() => void client.leave()} />}
      {rules && <RulesDialog onClose={() => setRules(false)} />}
    </div>
  );
}
