/**
 * after-complete/pricing.ts
 *
 * Pricing service — AFTER full OpenFeature migration.
 *
 * Automatically migrated by `flaglint migrate --apply`:
 *   numberVariation → openFeatureClient.getNumberValue
 *   jsonVariation   → openFeatureClient.getObjectValue
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
  region: string;
}

interface DiscountConfig {
  percentage: number;
  maxAmount: number;
  applicablePlans: string[];
}

interface PricingTier {
  name: string;
  monthlyPrice: number;
  features: string[];
}

/**
 * Get the discount percentage for a user's plan.
 * Migrated: numberVariation → openFeatureClient.getNumberValue
 */
export async function getDiscountPercentage(user: User): Promise<number> {
  const ctx = { targetingKey: user.id, plan: user.plan, region: user.region };
  return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);
}

/**
 * Get the maximum allowed cart discount amount.
 * Migrated: numberVariation → openFeatureClient.getNumberValue
 */
export async function getMaxDiscountAmount(user: User): Promise<number> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getNumberValue("max-discount-amount", 50, ctx);
}

/**
 * Get the active discount configuration for a user.
 * Migrated: jsonVariation → openFeatureClient.getObjectValue
 */
export async function getDiscountConfig(user: User): Promise<DiscountConfig> {
  const ctx = { targetingKey: user.id, plan: user.plan, region: user.region };
  const fallback: DiscountConfig = {
    percentage: 0,
    maxAmount: 0,
    applicablePlans: [],
  };
  return openFeatureClient.getObjectValue("discount-config", fallback, ctx) as Promise<DiscountConfig>;
}

/**
 * Get the pricing tier configuration for a user's plan.
 * Migrated: jsonVariation → openFeatureClient.getObjectValue
 */
export async function getPricingTier(user: User): Promise<PricingTier> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  const fallback: PricingTier = {
    name: "Free",
    monthlyPrice: 0,
    features: ["basic"],
  };
  return openFeatureClient.getObjectValue("pricing-tier-config", fallback, ctx) as Promise<PricingTier>;
}

/**
 * Calculate the final price for a user after applying active discounts.
 */
export async function calculateFinalPrice(
  user: User,
  baseAmount: number
): Promise<{ finalAmount: number; discountApplied: number; tier: PricingTier }> {
  const [discountPct, maxDiscount, tier] = await Promise.all([
    getDiscountPercentage(user),
    getMaxDiscountAmount(user),
    getPricingTier(user),
  ]);

  const rawDiscount = (baseAmount * discountPct) / 100;
  const discountApplied = Math.min(rawDiscount, maxDiscount);
  const finalAmount = baseAmount - discountApplied;

  return { finalAmount, discountApplied, tier };
}
