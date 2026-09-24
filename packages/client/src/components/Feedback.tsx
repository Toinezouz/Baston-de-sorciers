import type { ConnectionStatus, Toast } from "../net/store";

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss(id: number): void }) {
  return (
    <div className="toasts" role="status" aria-live="assertive">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast toast-${t.kind}`} onClick={() => onDismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  );
}

export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === "connected") return null;
  const text =
    status === "connecting" ? "Connexion au serveur…" : status === "reconnecting" ? "Connexion perdue — reconnexion en cours…" : "Hors ligne.";
  return (
    <div className={`conn-banner conn-${status}`} role="alert">
      <span className="spinner" aria-hidden /> {text}
    </div>
  );
}
