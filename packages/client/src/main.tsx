import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { GameClientContext } from "./hooks/useGame";
import { unlockAudio } from "./audio";
import { GameClient } from "./net/client";
import "./styles/app.css";

const client = new GameClient();
unlockAudio();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameClientContext.Provider value={client}>
      <App />
    </GameClientContext.Provider>
  </StrictMode>,
);
