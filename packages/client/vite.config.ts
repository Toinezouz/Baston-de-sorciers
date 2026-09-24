import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER = process.env.GAME_SERVER_URL ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // En développement, le client (5173) relaie l'API et le WebSocket vers le serveur de jeu (3001) :
    // une seule URL à ouvrir, pas de CORS.
    proxy: {
      "/socket.io": { target: SERVER, ws: true },
      "/api": { target: SERVER },
      "/health": { target: SERVER },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 800,
  },
});
