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
      "**/tests/smoke/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 92,
        functions: 92,
        branches: 80,
        statements: 90,
      },
    },
  },
});
