// Fixture: LaunchDarkly scoped package (@launchdarkly/node-server-sdk, SDK v8+)
// Tests detection of all call types from the new package name.
// Regression guard: scoped package provenance must be established the same way as
// the legacy package — LD.init() binding sets the namespace for all method calls.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as LD from "@launchdarkly/node-server-sdk";

const client = LD.init("sdk-key-123");
declare const user: LD.LDContext;

// ── variation() — generic boolean evaluation ─────────────────────────────────
export const s01 = client.variation("scoped-bool-flag", user, false);

// ── variationDetail() — generic evaluation with detail ───────────────────────
export const s02 = client.variationDetail("scoped-detail-flag", user, false);

// ── stringVariation() — typed string evaluation ──────────────────────────────
export const s03 = client.stringVariation("scoped-string-flag", user, "free");

// ── numberVariation() — typed number evaluation ──────────────────────────────
export const s04 = client.numberVariation("scoped-number-flag", user, 0);

// ── boolVariation() — typed boolean evaluation ───────────────────────────────
export const s05 = client.boolVariation("scoped-typed-bool-flag", user, false);

// ── boolVariationDetail() — typed boolean with detail ────────────────────────
export const s06 = client.boolVariationDetail("scoped-bool-detail-flag", user, false);

// ── stringVariationDetail() — typed string with detail ───────────────────────
export const s07 = client.stringVariationDetail("scoped-string-detail-flag", user, "");

// ── numberVariationDetail() — typed number with detail ───────────────────────
export const s08 = client.numberVariationDetail("scoped-number-detail-flag", user, 0);

// ── jsonVariation() — typed JSON/object evaluation ───────────────────────────
export const s09 = client.jsonVariation("scoped-json-flag", user, {});

// ── jsonVariationDetail() — typed JSON with detail ───────────────────────────
export const s10 = client.jsonVariationDetail("scoped-json-detail-flag", user, {});

// ── allFlagsState() — bulk inventory usage, represented with flagKey="*" ─────
export const s11 = client.allFlagsState(user);
