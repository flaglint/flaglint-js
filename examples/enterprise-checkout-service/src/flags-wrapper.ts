/**
 * src/flags-wrapper.ts
 *
 * Shared internal LaunchDarkly wrapper — used across multiple services.
 *
 * BEFORE migration: imported wrapper functions (manual review required).
 * This file wraps LaunchDarkly SDK calls behind an internal abstraction.
 * FlagLint detects these as flag usages when the `wrappers` config key
 * lists `evaluateFlag` and `evaluateFlagWithFallback`.
 *
 * Why manual review is required:
 *   - The wrapper's call signature differs from the raw LD SDK
 *   - Multiple call sites across different services import from this file
 *   - Migrating requires updating both this wrapper and all its callers
 *   - The platform team should replace this wrapper with direct OpenFeature
 *     client calls after provider setup in platform/feature-flags.ts
 *
 * Recommended migration path:
 *   1. Add openFeatureClient import from platform/feature-flags
 *   2. Rewrite evaluateFlag() to use openFeatureClient.getBooleanValue()
 *   3. Update all callers to pass EvaluationContext with targetingKey
 *   4. Remove the LaunchDarkly SDK import from this file
 */

import LaunchDarkly from "@launchdarkly/node-server-sdk";

const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

interface FlagContext {
  userId: string;
  attributes?: Record<string, unknown>;
}

/**
 * Internal flag evaluation wrapper used across services.
 * Detected by FlagLint when wrappers: ["evaluateFlag"] is set in .flaglintrc.
 * Manual review required — wrapper abstracts flag key and default value.
 */
export async function evaluateFlag(
  flagKey: string,
  context: FlagContext,
  defaultValue: boolean = false
): Promise<boolean> {
  const ldContext = {
    targetingKey: context.userId,
    ...context.attributes,
  };
  return ldClient.boolVariation(flagKey, ldContext, defaultValue);
}

/**
 * Internal wrapper for string/number/json flags.
 * Detected by FlagLint when wrappers: ["evaluateFlagWithFallback"] is set in .flaglintrc.
 * Manual review required — generic type makes automated migration unsafe.
 */
export async function evaluateFlagWithFallback<T>(
  flagKey: string,
  context: FlagContext,
  defaultValue: T
): Promise<T> {
  const ldContext = {
    targetingKey: context.userId,
    ...context.attributes,
  };

  if (typeof defaultValue === "boolean") {
    return ldClient.boolVariation(flagKey, ldContext, defaultValue as boolean) as unknown as Promise<T>;
  }
  if (typeof defaultValue === "string") {
    return ldClient.stringVariation(flagKey, ldContext, defaultValue as string) as unknown as Promise<T>;
  }
  if (typeof defaultValue === "number") {
    return ldClient.numberVariation(flagKey, ldContext, defaultValue as number) as unknown as Promise<T>;
  }
  return ldClient.jsonVariation(flagKey, ldContext, defaultValue as object) as unknown as Promise<T>;
}

/**
 * Example consumer of the internal wrapper — shows how other services use it.
 * After migration, these callers will import openFeatureClient directly.
 */
export async function isFeatureEnabledForUser(
  flagKey: string,
  userId: string
): Promise<boolean> {
  return evaluateFlag(flagKey, { userId });
}
