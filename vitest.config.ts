import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // CLI integration tests spawn real subprocesses, which can exceed the
    // 5000ms default on slow Windows / Node 22 CI runners (the assertions
    // never run, so these timeouts are environmental, not logic bugs). The
    // slowest legitimate test is ~8.3s, so 30000ms is safe headroom.
    testTimeout: 30000,
    hookTimeout: 30000,
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
