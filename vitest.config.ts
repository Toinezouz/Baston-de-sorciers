import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/engine/src/**/*.ts", "packages/server/src/**/*.ts", "packages/shared/src/**/*.ts", "packages/client/src/net/store.ts", "packages/client/src/game/**/*.ts"],
      exclude: ["packages/*/src/index.ts", "packages/engine/src/types.ts"],
      reporter: ["text-summary", "text"],
    },
  },
});
