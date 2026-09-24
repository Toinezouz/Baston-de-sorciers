import { defineConfig } from "vitest/config";

/** Tests de bout en bout (navigateur réel). Nécessitent `npm run build`. */
export default defineConfig({
  test: {
    include: ["packages/client/e2e/**/*.e2e.ts"],
    environment: "node",
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
