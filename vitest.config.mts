import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // tests/e2e is Playwright's territory (*.spec.ts), not Vitest's.
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
  },
});
