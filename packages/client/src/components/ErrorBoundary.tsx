import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * Filet de sécurité : une erreur d'affichage ne doit JAMAIS laisser un écran blanc.
 * Affiche un message, le détail de l'erreur et deux issues (recharger / réinitialiser).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[baston] erreur d'affichage", error, info.componentStack);
  }

  private reset = (): void => {
    try {
      sessionStorage.removeItem("baston:session");
      localStorage.removeItem("baston:session");
    } catch {
      /* ignoré */
    }
    location.href = "/";
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1>💥 Le grimoire a pris feu…</h1>
        <p>L'affichage a rencontré une erreur. La partie continue sur le serveur : vous pouvez la reprendre.</p>
        <ul className="hint">
          <li>
            <strong>Recharger</strong> reprend votre partie en cours (la plupart des cas, notamment après une mise à jour du jeu).
          </li>
          <li>
            <strong>Réinitialiser</strong> oublie la session de cet onglet et revient à l'accueil.
          </li>
        </ul>
        <div className="row">
          <button type="button" className="btn btn-primary btn-big" onClick={() => location.reload()}>
            🔄 Recharger
          </button>
          <button type="button" className="btn btn-big" onClick={this.reset}>
            Réinitialiser
          </button>
        </div>
        <details>
          <summary>Détail technique</summary>
          <pre>{error.message}</pre>
        </details>
      </main>
    );
  }
}
