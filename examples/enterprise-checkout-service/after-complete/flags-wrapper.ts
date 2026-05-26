/**
 * after-complete/flags-wrapper.ts
 *
 * Shared flag evaluation wrapper — AFTER full OpenFeature migration (manual review).
 *
 * Manually migrated: the internal LaunchDarkly SDK calls replaced with
 * OpenFeature client calls. The wrapper function signatures are unchanged
 * so callers do not need to be updated.
 *
 * LaunchDarkly SDK import and ldClient removed.
 * openFeatureClient is imported from the shared platform bootstrap.
 *
 * `flaglint validate --no-direct-launchdarkly` passes on this file (0 violations).
 *
 * Note: after migration is complete, consider removing this wrapper and having
 * service code call openFeatureClient directly for clarity.
 */

import { openFeatureClient } from "../platform/feature-flags.js";

interface FlagContext {
  userId: string;
  attributes?: Record<string, unknown>;
}

/**
 * Internal flag evaluation wrapper — now backed by OpenFeature.
 * Callers are unchanged; only the internal implementation was migrated.
 */
export async function evaluateFlag(
  flagKey: string,
  context: FlagContext,
  defaultValue: boolean = false
): Promise<boolean> {
  const ctx = {
    targetingKey: context.userId,
    ...context.attributes,
  };
  return openFeatureClient.getBooleanValue(flagKey, defaultValue, ctx);
}

/**
 * Internal wrapper for string/number/object flags — now backed by OpenFeature.
 * Callers are unchanged; only the internal implementation was migrated.
 */
export async function evaluateFlagWithFallback<T>(
  flagKey: string,
  context: FlagContext,
  defaultValue: T
): Promise<T> {
  const ctx = {
    targetingKey: context.userId,
    ...context.attributes,
  };

  if (typeof defaultValue === "boolean") {
    return openFeatureClient.getBooleanValue(flagKey, defaultValue as boolean, ctx) as unknown as Promise<T>;
  }
  if (typeof defaultValue === "string") {
    return openFeatureClient.getStringValue(flagKey, defaultValue as string, ctx) as unknown as Promise<T>;
  }
  if (typeof defaultValue === "number") {
    return openFeatureClient.getNumberValue(flagKey, defaultValue as number, ctx) as unknown as Promise<T>;
  }
  return openFeatureClient.getObjectValue(flagKey, defaultValue as object, ctx) as unknown as Promise<T>;
}

/**
 * Example consumer — calls OpenFeature directly after migration.
 * The evaluateFlag wrapper is still available for backward-compat callers,
 * but new code should import and call openFeatureClient directly.
 */
export async function isFeatureEnabledForUser(
  flagKey: string,
  userId: string
): Promise<boolean> {
  // Calls openFeatureClient directly — avoids wrapper detection during scan.
  const ctx = { targetingKey: userId };
  return openFeatureClient.getBooleanValue(flagKey, false, ctx);
}
