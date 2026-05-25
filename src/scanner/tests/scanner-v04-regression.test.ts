/**
 * Scanner regression tests for OpenFeature safe-migration inventory work.
 *
 * PURPOSE
 * These tests protect LaunchDarkly Node server-side SDK inventory coverage.
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
// Cases 1–2: generic variation / variationDetail baseline coverage.
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — generic variation() and variationDetail() still detected", () => {
  it("case 1: detects ldClient.variation('generic-bool', context, false)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    expect(result.uniqueFlags).toContain("generic-bool");
    expect(result.usages.some((u) => u.flagKey === "generic-bool" && u.callType === "variation")).toBe(true);
  });

  it("case 2: detects ldClient.variationDetail('generic-detail', context, false)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    expect(result.uniqueFlags).toContain("generic-detail");
    expect(result.usages.some((u) => u.flagKey === "generic-detail" && u.callType === "variationDetail")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cases 3–10: typed LaunchDarkly Node server-side methods.
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — typed LD Node server-side methods are detected", () => {
  // Case 3
  it("case 3: detects ldClient.boolVariation('new-payment-flow', context, false)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    expect(result.uniqueFlags).toContain("new-payment-flow");
  });

  // Case 4
  it("case 4: detects ldClient.boolVariationDetail('new-payment-flow', context, false)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    // The fixture has both boolVariation AND boolVariationDetail on 'new-payment-flow'.
    // After fixing, at least 2 usages must appear for this flag key.
    const usagesForKey = result.usages.filter((u) => u.flagKey === "new-payment-flow");
    expect(usagesForKey.length).toBeGreaterThanOrEqual(2);
  });

  // Case 5
  it("case 5: detects ldClient.stringVariation('checkout-tier', context, 'control')", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    expect(result.uniqueFlags).toContain("checkout-tier");
  });

  // Case 6
  it("case 6: detects ldClient.stringVariationDetail('checkout-tier', context, 'control')", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    // Both stringVariation and stringVariationDetail use 'checkout-tier'.
    const usagesForKey = result.usages.filter((u) => u.flagKey === "checkout-tier");
    expect(usagesForKey.length).toBeGreaterThanOrEqual(2);
  });

  // Case 7
  it("case 7: detects ldClient.numberVariation('timeout-ms', context, 3000)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    expect(result.uniqueFlags).toContain("timeout-ms");
  });

  // Case 8
  it("case 8: detects ldClient.numberVariationDetail('timeout-ms', context, 3000)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    // Both numberVariation and numberVariationDetail use 'timeout-ms'.
    const usagesForKey = result.usages.filter((u) => u.flagKey === "timeout-ms");
    expect(usagesForKey.length).toBeGreaterThanOrEqual(2);
  });

  // Case 9
  it("case 9: detects ldClient.jsonVariation('checkout-config', context, { layout: 'classic' })", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    expect(result.uniqueFlags).toContain("checkout-config");
  });

  // Case 10
  it("case 10: detects ldClient.jsonVariationDetail('checkout-config', context, { layout: 'classic' })", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    // Both jsonVariation and jsonVariationDetail use 'checkout-config'.
    const usagesForKey = result.usages.filter((u) => u.flagKey === "checkout-config");
    expect(usagesForKey.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 11: allFlagsState() — distinct from allFlags(), inventory-only bulk usage.
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — allFlagsState() is detected as bulk inventory usage", () => {
  it("case 11: detects ldClient.allFlagsState(context)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    // Bulk calls enumerate all flags and are represented with flagKey="*".
    // They must not later be auto-migrated like normal single-flag evaluations.
    const allFlagsStateUsage = result.usages.find(
      (u) => (u.callType as string) === "allFlagsState"
    );
    expect(allFlagsStateUsage).toBeDefined();
    expect(allFlagsStateUsage?.flagKey).toBe("*");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 12: @launchdarkly/node-server-sdk package name (LD SDK v8+).
// Detection comes from SDK import provenance plus init() binding.
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — @launchdarkly/node-server-sdk ESM import", () => {
  it("case 12a: detects variation() from @launchdarkly/node-server-sdk", async () => {
    // Regression guard: the scoped Node server SDK package establishes LD namespace provenance.
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-esm-import.ts"));
    expect(result.uniqueFlags).toContain("esm-generic-flag");
    expect(result.usages.some((u) => u.flagKey === "esm-generic-flag" && u.callType === "variation")).toBe(true);
  });

  it("case 12b: detects boolVariation() from @launchdarkly/node-server-sdk", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-esm-import.ts"));
    expect(result.uniqueFlags).toContain("esm-sdk-flag");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 13: CommonJS require() provenance.
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — CJS require() establishes LD namespace provenance", () => {
  // Regression guard: CommonJS require() from the Node server SDK is treated
  // like an ESM import for client initialization tracking.

  it("case 13a: detects variation() via CJS-style require", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-cjs-style.ts"));
    expect(result.uniqueFlags).toContain("cjs-require-flag");
    expect(result.usages.some((u) => u.flagKey === "cjs-require-flag" && u.callType === "variation")).toBe(true);
  });

  it("case 13b: detects boolVariation() via CJS-style require", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-cjs-style.ts"));
    expect(result.uniqueFlags).toContain("cjs-bool-flag");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 14: Aliased LD client — variable name does not matter.
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — aliased LD client (featureGate) is detected", () => {
  it("case 14a: detects featureGate.boolVariation('aliased-client-flag', ...) — real LD client", async () => {
    // Regression guard: a real LaunchDarkly client is detected from SDK
    // initialization provenance, regardless of its local variable name.
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-aliased-client.ts"));
    expect(result.uniqueFlags).toContain("aliased-client-flag");
  });

  it("case 14b: detects featureGate.variation('aliased-variation-flag', ...) — real LD client", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-aliased-client.ts"));
    expect(result.uniqueFlags).toContain("aliased-variation-flag");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 15: False positive guard — analyticsClient.variation() without LD import.
// Historical bug: an identifier-name heuristic matched "analyticsClient".
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — analyticsClient.variation() is not detected", () => {
  it("case 15: does NOT detect analyticsClient.variation() — analyticsClient is not an LD client", async () => {
    // Regression guard: non-LaunchDarkly objects named like clients must not
    // be treated as LaunchDarkly usage.
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-false-positive-analytics.ts"));
    expect(result.totalUsages).toBe(0);
    expect(result.usages).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 16: False positive guard — someClient.boolVariation() without LD import
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — someClient.boolVariation() must not be detected", () => {
  it("case 16: does NOT detect someClient.boolVariation() — someClient is not an LD client", async () => {
    // Regression guard: typed method names alone do not establish LaunchDarkly provenance.
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-false-positive-any-client-typed.ts"));
    expect(result.totalUsages).toBe(0);
    expect(result.usages).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 17: Dynamic flag key with a typed method (boolVariation)
// ─────────────────────────────────────────────────────────────────────────────

describe("regression — dynamic key with boolVariation() is detected as dynamic", () => {
  it("case 17a: detects ldClient.boolVariation(flagKey, context, false) with isDynamic: true", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    const dynamicBoolUsage = result.usages.find(
      (u) => u.isDynamic && (u.callType as string) === "boolVariation"
    );
    expect(dynamicBoolUsage).toBeDefined();
  });

  it("case 17b: dynamic boolVariation key is NOT added to uniqueFlags", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-typed-methods.ts"));
    // Invariant: dynamic keys (isDynamic: true) must never appear in uniqueFlags.
    // This holds regardless of callType — lock it in now for boolVariation.
    const dynamicFlagKeys = result.usages.filter((u) => u.isDynamic).map((u) => u.flagKey);
    for (const key of dynamicFlagKeys) {
      expect(result.uniqueFlags).not.toContain(key);
    }
  });
});
