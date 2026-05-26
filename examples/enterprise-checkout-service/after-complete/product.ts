/**
 * after-complete/product.ts
 *
 * Product catalog service — AFTER full OpenFeature migration.
 *
 * Auto-migrated by `flaglint migrate --apply` (static keys):
 *   stringVariation("recommendations-variant") → openFeatureClient.getStringValue
 *   boolVariation("bulk-discount-enabled")     → openFeatureClient.getBooleanValue
 *
 * Manually migrated (dynamic key):
 *   boolVariation(flagKey, ...) where flagKey = `category-feature-${product.category}`
 *   → openFeatureClient.getBooleanValue(flagKey, ...) — dynamic key preserved.
 *     All possible category values are registered as flags in LaunchDarkly.
 *
 * LaunchDarkly SDK import and ldClient removed.
 * openFeatureClient is imported from the shared platform bootstrap.
 *
 * `flaglint validate --no-direct-launchdarkly` passes on this file (0 violations).
 */

import { openFeatureClient } from "../platform/feature-flags.js";

interface Product {
  id: string;
  category: string;
  name: string;
  price: number;
}

interface User {
  id: string;
  plan: "free" | "pro" | "enterprise";
}

/**
 * Check if a product category-specific feature is enabled.
 * Manually migrated: dynamic key passed directly to OpenFeature.
 * All possible `category-feature-*` keys are registered in LaunchDarkly.
 */
export async function isCategoryFeatureEnabled(
  user: User,
  product: Product
): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan, category: product.category };

  // Dynamic key — manually migrated. LaunchDarkly serves the flag value via the
  // OpenFeature provider. All known category variants are registered as LD flags.
  const flagKey = `category-feature-${product.category}`;
  return openFeatureClient.getBooleanValue(flagKey, false, ctx);
}

/**
 * Get recommendations experiment variant for a product.
 * Auto-migrated: stringVariation → openFeatureClient.getStringValue
 */
export async function getRecommendationsVariant(user: User): Promise<string> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getStringValue("recommendations-variant", "control", ctx);
}

/**
 * Check if bulk purchase discounts are enabled.
 * Auto-migrated: boolVariation → openFeatureClient.getBooleanValue
 */
export async function isBulkDiscountEnabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getBooleanValue("bulk-discount-enabled", false, ctx);
}

/**
 * Resolve product availability based on flags.
 */
export async function resolveProductAvailability(
  user: User,
  product: Product
): Promise<{ available: boolean; variant: string; bulkDiscount: boolean }> {
  const [categoryEnabled, variant, bulkDiscount] = await Promise.all([
    isCategoryFeatureEnabled(user, product),
    getRecommendationsVariant(user),
    isBulkDiscountEnabled(user),
  ]);

  return {
    available: categoryEnabled,
    variant,
    bulkDiscount,
  };
}
