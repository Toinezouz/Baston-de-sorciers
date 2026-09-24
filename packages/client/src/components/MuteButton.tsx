import { useSyncExternalStore } from "react";
import { isMuted, onMuteChange, setMuted } from "../audio";

export function MuteButton() {
  const muted = useSyncExternalStore(onMuteChange, isMuted);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Activer le son" : "Couper le son"}
      aria-pressed={muted}
      title={muted ? "Son coupé (M)" : "Son activé (M)"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
