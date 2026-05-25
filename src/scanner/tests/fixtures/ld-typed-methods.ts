// Fixture: typed LaunchDarkly Node.js server-side SDK methods.
// Cases 1–2   (variation, variationDetail)   — generic evaluation methods.
// Cases 3–10  (boolVariation, stringVariation, numberVariation, jsonVariation + Detail variants)
//              — typed Node server-side evaluation methods.
// Case 11     (allFlagsState) — bulk inventory usage represented with flagKey="*".
// Case 17     (dynamic key with boolVariation) — dynamic key inventory.
/* eslint-disable @typescript-eslint/no-explicit-any */
import LaunchDarkly from 'launchdarkly-node-server-sdk';

const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY ?? '');
declare const context: any;

// ── Case 1: generic variation ────────────────────────────────────────────────
export const r01 = ldClient.variation('generic-bool', context, false);

// ── Case 2: generic variationDetail ──────────────────────────────────────────
export const r02 = ldClient.variationDetail('generic-detail', context, false);

// ── Case 3: boolVariation ────────────────────────────────────────────────────
export const r03 = ldClient.boolVariation('new-payment-flow', context, false);

// ── Case 4: boolVariationDetail ──────────────────────────────────────────────
export const r04 = ldClient.boolVariationDetail('new-payment-flow', context, false);

// ── Case 5: stringVariation ──────────────────────────────────────────────────
export const r05 = ldClient.stringVariation('checkout-tier', context, 'control');

// ── Case 6: stringVariationDetail ────────────────────────────────────────────
export const r06 = ldClient.stringVariationDetail('checkout-tier', context, 'control');

// ── Case 7: numberVariation ──────────────────────────────────────────────────
export const r07 = ldClient.numberVariation('timeout-ms', context, 3000);

// ── Case 8: numberVariationDetail ────────────────────────────────────────────
export const r08 = ldClient.numberVariationDetail('timeout-ms', context, 3000);

// ── Case 9: jsonVariation ────────────────────────────────────────────────────
export const r09 = ldClient.jsonVariation('checkout-config', context, { layout: 'classic' });

// ── Case 10: jsonVariationDetail ─────────────────────────────────────────────
export const r10 = ldClient.jsonVariationDetail('checkout-config', context, { layout: 'classic' });

// ── Case 11: allFlagsState — bulk inventory usage, not a single-flag eval ───
export const r11 = ldClient.allFlagsState(context);

// ── Case 17: dynamic key via boolVariation ───────────────────────────────────
declare const flagKey: string;
export const r17 = ldClient.boolVariation(flagKey, context, false);
