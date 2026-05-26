import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/.claude/**",
      "**/.git/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/tests/fixtures/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
      },
    },
  },
});
