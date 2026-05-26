/**
 * Explicit regression tests for @launchdarkly/node-server-sdk (scoped SDK v8+).
 *
 * PURPOSE
 * The scanner supports both `launchdarkly-node-server-sdk` (legacy) and
 * `@launchdarkly/node-server-sdk` (scoped, SDK v8+). These tests lock in
 * detection behavior for every call type on the scoped package so that any
 * future change that breaks scoped-package detection fails loudly.
 *
 * PACKAGE NAMES
 * - Legacy:  launchdarkly-node-server-sdk
 * - Scoped:  @launchdarkly/node-server-sdk  ← this file tests exclusively this one
 *
 * The ld-scoped-sdk.ts fixture imports from the scoped package and covers all
 * call types: variation, variationDetail, typed variants (bool/string/number/json),
 * detail variants, and allFlagsState.
 *
 * TYPE NOTE
 * CallType may lag newly inventoried LaunchDarkly SDK method names. Casts to
 * string keep these scanner assertions focused on inventory behavior.
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
// Scoped SDK: generic variation() and variationDetail()
// ─────────────────────────────────────────────────────────────────────────────

describe("scoped SDK — variation() and variationDetail() detected from @launchdarkly/node-server-sdk", () => {
  it("detects client.variation('scoped-bool-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-bool-flag");
    expect(
      result.usages.some((u) => u.flagKey === "scoped-bool-flag" && u.callType === "variation")
    ).toBe(true);
  });

  it("detects client.variationDetail('scoped-detail-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-detail-flag");
    expect(
      result.usages.some((u) => u.flagKey === "scoped-detail-flag" && u.callType === "variationDetail")
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped SDK: boolVariation() and boolVariationDetail()
// ─────────────────────────────────────────────────────────────────────────────

describe("scoped SDK — boolVariation() detected from @launchdarkly/node-server-sdk", () => {
  it("detects client.boolVariation('scoped-typed-bool-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-typed-bool-flag");
    expect(
      result.usages.some(
        (u) => u.flagKey === "scoped-typed-bool-flag" && (u.callType as string) === "boolVariation"
      )
    ).toBe(true);
  });

  it("detects client.boolVariationDetail('scoped-bool-detail-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-bool-detail-flag");
    expect(
      result.usages.some(
        (u) => u.flagKey === "scoped-bool-detail-flag" && (u.callType as string) === "boolVariationDetail"
      )
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped SDK: stringVariation() and stringVariationDetail()
// ─────────────────────────────────────────────────────────────────────────────

describe("scoped SDK — stringVariation() detected from @launchdarkly/node-server-sdk", () => {
  it("detects client.stringVariation('scoped-string-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-string-flag");
    expect(
      result.usages.some(
        (u) => u.flagKey === "scoped-string-flag" && (u.callType as string) === "stringVariation"
      )
    ).toBe(true);
  });

  it("detects client.stringVariationDetail('scoped-string-detail-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-string-detail-flag");
    expect(
      result.usages.some(
        (u) =>
          u.flagKey === "scoped-string-detail-flag" && (u.callType as string) === "stringVariationDetail"
      )
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped SDK: numberVariation() and numberVariationDetail()
// ─────────────────────────────────────────────────────────────────────────────

describe("scoped SDK — numberVariation() detected from @launchdarkly/node-server-sdk", () => {
  it("detects client.numberVariation('scoped-number-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-number-flag");
    expect(
      result.usages.some(
        (u) => u.flagKey === "scoped-number-flag" && (u.callType as string) === "numberVariation"
      )
    ).toBe(true);
  });

  it("detects client.numberVariationDetail('scoped-number-detail-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-number-detail-flag");
    expect(
      result.usages.some(
        (u) =>
          u.flagKey === "scoped-number-detail-flag" && (u.callType as string) === "numberVariationDetail"
      )
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped SDK: jsonVariation() and jsonVariationDetail()
// ─────────────────────────────────────────────────────────────────────────────

describe("scoped SDK — jsonVariation() detected from @launchdarkly/node-server-sdk", () => {
  it("detects client.jsonVariation('scoped-json-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-json-flag");
    expect(
      result.usages.some(
        (u) => u.flagKey === "scoped-json-flag" && (u.callType as string) === "jsonVariation"
      )
    ).toBe(true);
  });

  it("detects client.jsonVariationDetail('scoped-json-detail-flag') from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    expect(result.uniqueFlags).toContain("scoped-json-detail-flag");
    expect(
      result.usages.some(
        (u) =>
          u.flagKey === "scoped-json-detail-flag" && (u.callType as string) === "jsonVariationDetail"
      )
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped SDK: allFlagsState() — bulk inventory, no single flag key
// ─────────────────────────────────────────────────────────────────────────────

describe("scoped SDK — allFlagsState() detected from @launchdarkly/node-server-sdk", () => {
  it("detects client.allFlagsState(user) as bulk usage with flagKey='*'", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    // Bulk calls enumerate all flags and are represented with flagKey="*".
    // They must not later be auto-migrated like normal single-flag evaluations.
    const allFlagsStateUsage = result.usages.find(
      (u) => (u.callType as string) === "allFlagsState"
    );
    expect(allFlagsStateUsage).toBeDefined();
    expect(allFlagsStateUsage?.flagKey).toBe("*");
  });

  it("allFlagsState wildcard key '*' is NOT in uniqueFlags", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    // Invariant: wildcard key '*' from bulk calls must never appear in uniqueFlags.
    expect(result.uniqueFlags).not.toContain("*");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped SDK: total usages count — all 11 call sites detected
// ─────────────────────────────────────────────────────────────────────────────

describe("scoped SDK — all call sites in ld-scoped-sdk.ts are detected", () => {
  it("detects exactly 11 usages from @launchdarkly/node-server-sdk fixture", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    // The fixture has 11 call sites (s01–s11): 10 single-flag + 1 allFlagsState.
    expect(result.totalUsages).toBe(11);
  });

  it("detects exactly 10 unique flag keys (allFlagsState wildcard excluded)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-scoped-sdk.ts"));
    // 10 distinct static flag keys; '*' from allFlagsState is excluded from uniqueFlags.
    expect(result.uniqueFlags).toHaveLength(10);
  });
});
