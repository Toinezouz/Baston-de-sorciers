import { NAME_MAX_LENGTH } from "@baston/engine";
import type { GameMode } from "@baston/shared";
import { useState } from "react";
import { RulesDialog } from "../components/RulesDialog";
import { useGameClient } from "../hooks/useGame";

const NAME_KEY = "baston:name";

function storedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Accueil : pseudo, créer une partie, rejoindre avec un code (pré-rempli par un lien d'invitation). */
export function Home({ inviteCode }: { inviteCode: string | null }) {
  const client = useGameClient();
  const [name, setName] = useState(storedName);
  const [code, setCode] = useState(inviteCode ?? "");
  const [mode, setMode] = useState<GameMode>("standard");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);

  const cleanName = name.trim();
  const remember = () => {
    try {
      localStorage.setItem(NAME_KEY, cleanName);
    } catch {
      /* ignoré */
    }
  };

  const run = async (fn: () => Promise<boolean>) => {
    if (!cleanName) return client.toast("Choisis d'abord un pseudo.");
    remember();
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <main className="home">
      <header className="home-hero">
        <h1>
          <span aria-hidden>✦</span> Baston de Sorciers <span aria-hidden>✦</span>
        </h1>
        <p>Assemble des sorts en secret. Frappe le premier. Sois le dernier debout.</p>
        <button type="button" className="btn btn-ghost" onClick={() => setRules(true)}>
          📜 Comment jouer
        </button>
      </header>

      <section className="home-card">
        <label className="field">
          <span>Ton pseudo de sorcier</span>
          <input
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Grimoald"
            autoComplete="nickname"
            autoFocus={!inviteCode}
          />
        </label>
      </section>

      <div className="home-grid">
        <section className="home-card" aria-labelledby="join-title">
          <h2 id="join-title">Rejoindre une partie</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => client.join(code.trim().toUpperCase(), cleanName));
            }}
          >
            <label className="field">
              <span>Code de la partie</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                autoCapitalize="characters"
                autoFocus={!!inviteCode}
                className="code-input"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>
              Rejoindre
            </button>
          </form>
        </section>

        <section className="home-card" aria-labelledby="create-title">
          <h2 id="create-title">Créer une partie</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => client.create({ name: cleanName, mode, maxPlayers }));
            }}
          >
            <fieldset className="field">
              <legend>Mode</legend>
              <label className="radio">
                <input type="radio" checked={mode === "standard"} onChange={() => setMode("standard")} /> Standard — 20 PV, 2 Couronnes
              </label>
              <label className="radio">
                <input type="radio" checked={mode === "quick"} onChange={() => setMode("quick")} /> Rapide — 12 PV, 1 Couronne
              </label>
            </fieldset>
            <label className="field">
              <span>Joueurs maximum</span>
              <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Créer la partie
            </button>
          </form>
        </section>
      </div>
      {rules && <RulesDialog onClose={() => setRules(false)} />}
    </main>
  );
}
