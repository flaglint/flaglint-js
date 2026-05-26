/**
 * after-complete/analytics.ts
 *
 * Analytics service — AFTER full OpenFeature migration (manual review items).
 *
 * These call sites required manual migration:
 *
 *   variationDetail    → getBooleanDetails  (reason shape differs: LDEvaluationDetail
 *                          vs OpenFeature ResolutionDetails — adapted below)
 *   boolVariationDetail → getBooleanDetails (same adaptation)
 *   allFlagsState      → per-flag evaluations (no OpenFeature bulk equivalent;
 *                          replaced with explicit calls for the flags this service needs)
 *
 * LaunchDarkly SDK import and ldClient removed.
 * openFeatureClient is imported from the shared platform bootstrap.
 *
 * `flaglint validate --no-direct-launchdarkly` passes on this file (0 violations).
 */

import { openFeatureClient } from "../platform/feature-flags.js";

interface User {
  id: string;
  plan: "free" | "pro" | "enterprise";
  cohort?: string;
}

interface ExperimentResult {
  flagKey: string;
  value: unknown;
  // variationIndex is not available in the OpenFeature ResolutionDetails shape.
  // Removed from the result type after migration.
  reason: string;
  userId: string;
}

/**
 * Evaluate a flag with full detail for A/B experiment tracking.
 * Manually migrated: variationDetail → getBooleanDetails.
 *
 * Shape difference after migration:
 *   Before: LDEvaluationDetail  { value, variationIndex, reason: { kind } }
 *   After:  ResolutionDetails   { value, reason: { code } }
 *
 * variationIndex is not available via the OpenFeature SDK. If your analytics pipeline
 * requires it, continue reading it from the LaunchDarkly provider-specific result.
 */
export async function evaluateExperimentFlag(
  user: User,
  flagKey: string,
  defaultValue: boolean
): Promise<ExperimentResult> {
  const ctx = { targetingKey: user.id, plan: user.plan, cohort: user.cohort };

  // OpenFeature detail resolution — getBooleanDetails instead of variationDetail.
  // ResolutionDetails: { value, reason: { code, errorCode?, errorMessage? } }
  const details = await openFeatureClient.getBooleanDetails(flagKey, defaultValue, ctx);

  return {
    flagKey,
    value: details.value,
    // OpenFeature reason code replaces LaunchDarkly reason.kind
    reason: details.reason ?? "UNKNOWN",
    userId: user.id,
  };
}

/**
 * Track checkout funnel experiment — evaluates with reason for analytics.
 * Manually migrated: boolVariationDetail → getBooleanDetails.
 */
export async function trackCheckoutExperiment(
  user: User
): Promise<{ enrolled: boolean; reason: string }> {
  const ctx = { targetingKey: user.id, plan: user.plan };

  // getBooleanDetails replaces boolVariationDetail.
  // variationIndex is not available in OpenFeature ResolutionDetails.
  const details = await openFeatureClient.getBooleanDetails("checkout-experiment", false, ctx);

  // Send reason to analytics pipeline
  console.log(
    `[analytics] checkout-experiment: user=${user.id} value=${details.value} reason=${details.reason}`
  );

  return {
    enrolled: details.value,
    reason: details.reason ?? "UNKNOWN",
    // variationIndex removed — not available via OpenFeature SDK
  };
}

/**
 * Get flag values needed by the analytics dashboard.
 * Manually migrated: allFlagsState replaced with per-flag evaluations.
 *
 * allFlagsState has no OpenFeature equivalent. The analytics service has been
 * updated to evaluate only the flags it actually needs (not all flags).
 */
export async function getAllFlagsForUser(
  user: User
): Promise<Record<string, unknown>> {
  const ctx = { targetingKey: user.id, plan: user.plan };

  // Explicit per-flag evaluations replace allFlagsState.
  // Add flags here as the analytics dashboard grows.
  const [checkoutV2, paymentProvider, discountPct, checkoutExperiment] = await Promise.all([
    openFeatureClient.getBooleanValue("checkout-v2", false, ctx),
    openFeatureClient.getStringValue("payment-provider", "stripe", ctx),
    openFeatureClient.getNumberValue("discount-percentage", 0, ctx),
    openFeatureClient.getBooleanValue("checkout-experiment", false, ctx),
  ]);

  return {
    "checkout-v2": checkoutV2,
    "payment-provider": paymentProvider,
    "discount-percentage": discountPct,
    "checkout-experiment": checkoutExperiment,
  };
}
