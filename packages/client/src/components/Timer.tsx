import { useNow } from "../hooks/useGame";
import { remainingMs } from "../net/store";

/** Compte à rebours basé sur l'échéance serveur (corrigée du décalage d'horloge). */
export function Timer({ deadline, clockOffset, totalMs, label }: { deadline: number; clockOffset: number; totalMs: number; label: string }) {
  const now = useNow(200);
  const left = remainingMs(deadline, clockOffset, now);
  const secs = Math.ceil(left / 1000);
  const ratio = Math.max(0, Math.min(1, left / Math.max(1, totalMs)));
  return (
    <div className={`timer${secs <= 10 ? " is-urgent" : ""}`} role="timer" aria-label={`${label} : ${secs} secondes`}>
      <span className="timer-label">{label}</span>
      <span className="timer-value">{secs}s</span>
      <span className="timer-bar" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}
