import { useEffect } from "react";
import { ConnectionBanner, Toasts } from "./components/Feedback";
import { useClientState, useGameClient } from "./hooks/useGame";
import { Game } from "./screens/Game";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";

/** Code d'invitation dans l'URL : /partie/ABC123 */
function inviteFromUrl(): string | null {
  const m = /^\/partie\/([A-Za-z0-9]{4,8})\/?$/.exec(location.pathname);
  return m ? m[1]!.toUpperCase() : null;
}

export function App() {
  const client = useGameClient();
  const state = useClientState();
  const { session, game, status, toasts, kicked } = state;
  const view = game && session && game.gameId === session.gameId ? game.view : null;

  // L'URL reflète la partie en cours (un rafraîchissement reprend la session).
  useEffect(() => {
    const target = session ? `/partie/${session.gameId}` : inviteFromUrl() ? location.pathname : "/";
    if (location.pathname !== target) history.replaceState(null, "", target);
  }, [session]);

  useEffect(() => {
    if (kicked === "SESSION_REPLACED") client.toast("Cette partie a été ouverte sur un autre appareil ou onglet.", "info");
  }, [kicked, client]);

  let screen;
  if (!session) screen = <Home inviteCode={inviteFromUrl()} />;
  else if (!view) screen = <main className="loading">Chargement de la partie…</main>;
  else if (view.public.phase === "LOBBY") screen = <Lobby view={view} />;
  else screen = <Game view={view} />;

  return (
    <>
      <ConnectionBanner status={status} />
      {screen}
      <Toasts toasts={toasts} onDismiss={(id) => client.dismissToast(id)} />
    </>
  );
}
