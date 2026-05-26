/**
 * src/analytics.ts
 *
 * Analytics service — uses variationDetail for reason tracking.
 *
 * BEFORE migration: variationDetail calls (manual review required).
 * These cannot be automatically migrated because:
 *   - variationDetail returns an EvaluationDetail with { value, variationIndex, reason }
 *   - OpenFeature detail resolution returns ResolutionDetails with a different shape
 *   - The `reason` field format differs between LaunchDarkly and OpenFeature
 *   - Manual review is needed to adapt the reason handling code
 *
 * `flaglint migrate --dry-run` will report these as "manual review required".
 * `flaglint migrate --apply` will NOT touch these call sites.
 *
 * See migration-plan.md in generated-reports/ for guidance on manual migration.
 */

import LaunchDarkly, { LDEvaluationDetail } from "@launchdarkly/node-server-sdk";

const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

interface User {
  id: string;
  plan: "free" | "pro" | "enterprise";
  cohort?: string;
}

interface ExperimentResult {
  flagKey: string;
  value: unknown;
  variationIndex: number | undefined;
  reason: string;
  userId: string;
}

/**
 * Evaluate a flag with full detail for A/B experiment tracking.
 * variationDetail → manual review: reason shapes differ between LD and OpenFeature.
 */
export async function evaluateExperimentFlag(
  user: User,
  flagKey: string,
  defaultValue: boolean
): Promise<ExperimentResult> {
  const ctx = { targetingKey: user.id, plan: user.plan, cohort: user.cohort };

  // variationDetail returns LDEvaluationDetail with { value, variationIndex, reason }
  // Manual review required: OpenFeature getStringDetails/getBooleanDetails return
  // ResolutionDetails with { value, reason: { kind, ... } } — different shape.
  const detail: LDEvaluationDetail = await ldClient.variationDetail(
    flagKey,
    ctx,
    defaultValue
  );

  return {
    flagKey,
    value: detail.value,
    variationIndex: detail.variationIndex,
    reason: detail.reason?.kind ?? "UNKNOWN",
    userId: user.id,
  };
}

/**
 * Track checkout funnel experiment — evaluates with reason for analytics.
 * boolVariationDetail → manual review: detail result shape requires manual adaptation.
 */
export async function trackCheckoutExperiment(
  user: User
): Promise<{ enrolled: boolean; reason: string; variationIndex: number | undefined }> {
  const ctx = { targetingKey: user.id, plan: user.plan };

  // boolVariationDetail — manual review required (not auto-migrated)
  const detail = await ldClient.boolVariationDetail(
    "checkout-experiment",
    ctx,
    false
  );

  // Send reason to analytics pipeline
  console.log(
    `[analytics] checkout-experiment: user=${user.id} value=${detail.value} reason=${detail.reason?.kind}`
  );

  return {
    enrolled: detail.value,
    reason: detail.reason?.kind ?? "UNKNOWN",
    variationIndex: detail.variationIndex,
  };
}

/**
 * Bulk evaluation for analytics dashboard — allFlagsState is not auto-migrated.
 * Manual review required: no OpenFeature equivalent for bulk flag-state calls.
 */
export async function getAllFlagsForUser(
  user: User
): Promise<Record<string, unknown>> {
  const ctx = { targetingKey: user.id, plan: user.plan };

  // allFlagsState — manual review: no single OpenFeature equivalent
  const state = await ldClient.allFlagsState(ctx);
  return state.toJSON() as Record<string, unknown>;
}
