import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/engine/src/**/*.ts"],
      exclude: ["packages/engine/src/index.ts", "packages/engine/src/types.ts"],
      reporter: ["text-summary", "text"],
    },
  },
});
