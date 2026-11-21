import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@legacy-messages": fileURLToPath(
        new URL("../../packages/i18n/messages", import.meta.url)
      )
    }
  },
  test: {
    environment: "jsdom",
    environmentMatchGlobs: [["src/**/*.test.ts", "node"]],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    pool: "threads",
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: ["./src/test/setup.ts"]
  }
});
