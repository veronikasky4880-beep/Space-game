import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["shared/src/**/*.ts"],
      thresholds: {
        lines: 85,
        statements: 85,
      },
    },
    alias: {
      shared: path.resolve(__dirname, "./shared/src/index.ts"),
    },
  },
});