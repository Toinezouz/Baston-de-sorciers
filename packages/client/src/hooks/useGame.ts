import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { GameClient } from "../net/client";
import type { ClientState } from "../net/store";

export const GameClientContext = createContext<GameClient | null>(null);

export function useGameClient(): GameClient {
  const c = useContext(GameClientContext);
  if (!c) throw new Error("GameClientContext manquant");
  return c;
}

export function useClientState(): ClientState {
  const c = useGameClient();
  return useSyncExternalStore(c.subscribe, c.getSnapshot);
}

/** Horloge locale rafraîchie périodiquement (comptes à rebours). */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
