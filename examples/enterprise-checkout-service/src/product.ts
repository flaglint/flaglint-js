/**
 * src/product.ts
 *
 * Product catalog service — uses a dynamic flag key (manual review required).
 *
 * BEFORE migration: dynamic flag key computed at runtime.
 * This cannot be automatically migrated because:
 *   - The flag key is not a static string literal
 *   - It is computed from `product.category` at runtime
 *   - FlagLint cannot statically resolve the key or verify its type
 *   - Dynamic keys are reported as warnings in the flag scan report
 *
 * `flaglint scan` will report: "1 dynamic flag key(s) require manual review"
 * `flaglint migrate --apply` will NOT touch this call site.
 *
 * Recommended manual migration:
 *   Option A: enumerate the known categories and use static keys per branch
 *   Option B: use openFeatureClient.getBooleanValue(computedKey, ...) directly
 *             after verifying all possible key values are defined in LaunchDarkly
 */

import LaunchDarkly from "launchdarkly-node-server-sdk";
import { openFeatureClient } from "../platform/feature-flags.js";

const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

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
 * Dynamic key: `category-feature-${product.category}` cannot be statically resolved.
 * FlagLint reports this as a dynamic flag — manual review required.
 */
export async function isCategoryFeatureEnabled(
  user: User,
  product: Product
): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan, category: product.category };

  // Dynamic key — manual review required (not auto-migrated by flaglint migrate --apply)
  const flagKey = `category-feature-${product.category}`;
  return ldClient.boolVariation(flagKey, ctx, false);
}

/**
 * Get recommendations experiment variant for a product.
 * Static key — safely automatable by `flaglint migrate --apply`.
 */
export async function getRecommendationsVariant(user: User): Promise<string> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return ldClient.stringVariation("recommendations-variant", ctx, "control");
}

/**
 * Check if bulk purchase discounts are enabled.
 * Static key — safely automatable by `flaglint migrate --apply`.
 */
export async function isBulkDiscountEnabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return ldClient.boolVariation("bulk-discount-enabled", ctx, false);
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
