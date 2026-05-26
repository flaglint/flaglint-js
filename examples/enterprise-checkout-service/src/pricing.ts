/**
 * src/pricing.ts
 *
 * Pricing service — uses direct LaunchDarkly Node.js server SDK calls.
 *
 * BEFORE migration: numberVariation and jsonVariation direct calls.
 * These are safely automatable by `flaglint migrate --apply` because:
 *   - flag keys are static string literals
 *   - fallback values are explicit and typed
 *   - evaluation context is present
 *   - openFeatureClient is imported from platform/feature-flags
 *
 * Run `flaglint migrate --dry-run` to preview the transformation.
 * Run `flaglint migrate --apply` to apply it automatically.
 */

import LaunchDarkly from "@launchdarkly/node-server-sdk";
import { openFeatureClient } from "../platform/feature-flags.js";

const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

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
 * flaglint migrate --apply: numberVariation → openFeatureClient.getNumberValue
 */
export async function getDiscountPercentage(user: User): Promise<number> {
  const ctx = { targetingKey: user.id, plan: user.plan, region: user.region };
  return ldClient.numberVariation("discount-percentage", ctx, 0);
}

/**
 * Get the maximum allowed cart discount amount.
 * flaglint migrate --apply: numberVariation → openFeatureClient.getNumberValue
 */
export async function getMaxDiscountAmount(user: User): Promise<number> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return ldClient.numberVariation("max-discount-amount", ctx, 50);
}

/**
 * Get the active discount configuration for a user.
 * flaglint migrate --apply: jsonVariation → openFeatureClient.getObjectValue
 */
export async function getDiscountConfig(user: User): Promise<DiscountConfig> {
  const ctx = { targetingKey: user.id, plan: user.plan, region: user.region };
  const fallback: DiscountConfig = {
    percentage: 0,
    maxAmount: 0,
    applicablePlans: [],
  };
  return ldClient.jsonVariation("discount-config", ctx, fallback) as Promise<DiscountConfig>;
}

/**
 * Get the pricing tier configuration for a user's plan.
 * flaglint migrate --apply: jsonVariation → openFeatureClient.getObjectValue
 */
export async function getPricingTier(user: User): Promise<PricingTier> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  const fallback: PricingTier = {
    name: "Free",
    monthlyPrice: 0,
    features: ["basic"],
  };
  return ldClient.jsonVariation("pricing-tier-config", ctx, fallback) as Promise<PricingTier>;
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
