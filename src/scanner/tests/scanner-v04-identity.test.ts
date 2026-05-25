/**
 * Scanner client-identity regression tests.
 *
 * PURPOSE
 * These tests document that correct LaunchDarkly client detection requires
 * tracking SDK initialization bindings, not variable-name heuristics.
 *
 * BULK CALL CONSTRAINT
 * allFlagsState(context) is LaunchDarkly SDK usage, but it evaluates the
 * entire flag set, not a single flag key. It must stay represented as
 * flagKey="*" inventory-only usage and must not be auto-transformed as if it
 * carried a normal single flag key.
 */

import { describe, it, expect } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scan } from "../index.js";
import { LocalFileSource } from "../local-source.js";
import { FlagLintConfigSchema } from "../../config.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function cfg(filename: string) {
  return FlagLintConfigSchema.parse({ include: [filename], exclude: [] });
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 1: ld*-named object without LaunchDarkly initialization must NOT be detected
// Historical bug: the old identifier-name heuristic matched variables starting
// with "ld", even when they were not initialized from a LaunchDarkly SDK.
// ─────────────────────────────────────────────────────────────────────────────

describe("identity — ld*-prefixed non-LD object must not be detected", () => {
  it("does NOT detect ldAnalytics.variation() — ldAnalytics is not an LD client", async () => {
    // Regression guard: a non-LaunchDarkly object whose name starts with "ld"
    // must not be treated as a LaunchDarkly client.
    const result = await scan(
      new LocalFileSource(FIXTURES),
      cfg("ld-false-positive-ld-prefix.ts")
    );
    expect(result.totalUsages).toBe(0);
    expect(result.usages).toHaveLength(0);
    expect(result.uniqueFlags).not.toContain("not-a-launchdarkly-flag");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 2: real LaunchDarkly-initialized client with non-obvious name must be detected
// Variable: 'gatekeeper' — does not start with 'ld', does not contain 'client'.
// Uses variation() so failure cannot be blamed on missing typed-method support.
// ─────────────────────────────────────────────────────────────────────────────

describe("identity — real LD client with non-obvious name must be detected", () => {
  it("detects gatekeeper.variation('aliased-generic-flag', ...) — gatekeeper is a real LD client", async () => {
    // Regression guard: a real LaunchDarkly client is detected from SDK
    // initialization provenance, regardless of its local variable name.
    const result = await scan(
      new LocalFileSource(FIXTURES),
      cfg("ld-aliased-gatekeeper.ts")
    );
    expect(result.uniqueFlags).toContain("aliased-generic-flag");
    expect(result.usages.some((u) => u.flagKey === "aliased-generic-flag" && u.callType === "variation")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 3: unrelated client in the same file as a real LD client must NOT be detected
// Purpose: prevent file-level taint — a LD import must NOT cause every .variation()
// call in the file to be treated as an LD usage.
// ─────────────────────────────────────────────────────────────────────────────

describe("identity — mixed clients in same file: only real LD calls detected", () => {
  it("detects featureFlags.variation('real-launchdarkly-flag', ...) — featureFlags is a real LD client", async () => {
    // Regression guard: file-level LaunchDarkly imports must not be required to
    // use names like "ldClient" for the initialized client variable.
    const result = await scan(
      new LocalFileSource(FIXTURES),
      cfg("ld-mixed-clients.ts")
    );
    expect(result.uniqueFlags).toContain("real-launchdarkly-flag");
    expect(result.usages.some((u) => u.flagKey === "real-launchdarkly-flag")).toBe(true);
  });

  it("does NOT detect analyticsClient.variation('analytics-experiment', ...) — analyticsClient is not an LD client", async () => {
    // Regression guard: an unrelated object in a file that also has a real
    // LaunchDarkly client must not be treated as LaunchDarkly usage.
    const result = await scan(
      new LocalFileSource(FIXTURES),
      cfg("ld-mixed-clients.ts")
    );
    expect(result.uniqueFlags).not.toContain("analytics-experiment");
    expect(result.usages.some((u) => u.flagKey === "analytics-experiment")).toBe(false);
  });
});
