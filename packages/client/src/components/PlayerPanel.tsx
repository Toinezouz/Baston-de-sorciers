import type { GameEvent, PublicPlayerView, Summon } from "@baston/engine";
import { useEffect, useState } from "react";
import { hpRatio, SLOT_LABEL } from "../game/helpers";
import { RelicChips, StatusChips, SummonChips } from "./Chips";
import { RuneCard } from "./RuneCard";

interface Props {
  player: PublicPlayerView;
  summons: Summon[];
  isMe?: boolean;
  isActive?: boolean;
  isChoosing?: boolean;
  /** Événements du dernier message (dégâts / soins à animer). */
  lastEvents: GameEvent[];
  version: number;
  compact?: boolean;
}

interface Floater {
  id: string;
  text: string;
  kind: "dmg" | "heal";
}

/** Fiche d'un sorcier : PV, Couronnes, effets, reliques, invocations, état de son sort. */
export function PlayerPanel({ player: p, summons, isMe, isActive, isChoosing, lastEvents, version, compact }: Props) {
  const [floaters, setFloaters] = useState<Floater[]>([]);

  // Animations de dégâts/soins : purement décoratives, l'état réel est déjà affiché.
  useEffect(() => {
    const items: Floater[] = [];
    lastEvents.forEach((e, i) => {
      if (e.targetId !== p.id || !e.amount) return;
      if (e.type === "DAMAGE" || e.type === "HP_LOST") items.push({ id: `${version}-${i}`, text: `−${e.amount}`, kind: "dmg" });
      if (e.type === "HEAL") items.push({ id: `${version}-${i}`, text: `+${e.amount}`, kind: "heal" });
    });
    if (!items.length) return;
    setFloaters((f) => [...f, ...items]);
    setTimeout(() => setFloaters((f) => f.filter((x) => !items.includes(x))), 1600);
  }, [version, lastEvents, p.id]);

  const hurt = floaters.some((f) => f.kind === "dmg");
  const spell = p.spell;
  const cls = [
    "player",
    isMe && "is-me",
    !p.alive && "is-dead",
    isActive && "is-active",
    hurt && "is-hurt",
    compact && "is-compact",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cls} aria-label={`${p.name}${isMe ? " (toi)" : ""}, ${p.alive ? `${p.hp} PV sur ${p.maxHp}` : "éliminé"}`}>
      <header className="player-head">
        <span className={`dot dot-${p.connection.toLowerCase()}`} title={p.connection === "CONNECTED" ? "Connecté" : p.connection === "DISCONNECTED" ? "Déconnecté" : "A abandonné"} />
        <strong className="player-name">
          {p.isBot && <span title="Bot">🤖 </span>}
          {p.name}
          {isMe && <em> (toi)</em>}
        </strong>
        {p.crowns > 0 && <span className="crowns" title={`${p.crowns} Couronne(s)`}>{"👑".repeat(p.crowns)}</span>}
        {isChoosing && <span className="badge badge-choice">choisit…</span>}
      </header>

      <div className="hp" role="meter" aria-valuemin={0} aria-valuemax={p.maxHp} aria-valuenow={Math.max(0, p.hp)} aria-label="Points de vie">
        <div className="hp-fill" style={{ width: `${hpRatio(p) * 100}%` }} />
        <span className="hp-text">{p.alive ? `${p.hp} / ${p.maxHp} PV` : "💀 Éliminé"}</span>
        {floaters.map((f) => (
          <span key={f.id} className={`floater floater-${f.kind}`} aria-hidden>
            {f.text}
          </span>
        ))}
      </div>

      <StatusChips statuses={p.statuses} />
      <RelicChips relics={p.relics} />
      <SummonChips summons={summons.filter((s) => s.controllerId === p.id)} />

      {!isMe && p.alive && spell && (
        <div className="spell-mini" aria-label="Sort">
          {spell.runes ? (
            (Object.entries(spell.runes) as [keyof typeof SLOT_LABEL, { defId: string }][]).map(([slot, c]) => (
              <RuneCard key={slot} defId={c.defId} size="xs" />
            ))
          ) : (
            <span className="spell-status">
              {spell.slots.length ? `${spell.slots.length} rune${spell.slots.length > 1 ? "s" : ""}` : "réfléchit…"}
              {spell.locked ? " · prêt ✔" : ""}
            </span>
          )}
        </div>
      )}
      {!isMe && <span className="hand-count" title="Runes en main">🂠 {p.handCount}</span>}
    </article>
  );
}
