/**
 * after/pricing.ts — snapshot after `flaglint migrate --apply`
 *
 * This shows what flaglint migrate --apply produces for src/pricing.ts.
 *
 * Changes applied automatically:
 *   numberVariation("discount-percentage", ctx, 0)
 *     → openFeatureClient.getNumberValue("discount-percentage", 0, ctx)
 *
 *   numberVariation("max-discount-amount", ctx, 50)
 *     → openFeatureClient.getNumberValue("max-discount-amount", 50, ctx)
 *
 *   jsonVariation("discount-config", ctx, fallback)
 *     → openFeatureClient.getObjectValue("discount-config", fallback, ctx)
 *
 *   jsonVariation("pricing-tier-config", ctx, fallback)
 *     → openFeatureClient.getObjectValue("pricing-tier-config", fallback, ctx)
 *
 * LaunchDarkly remains the provider. Only the call-site API changes.
 * Flag key, fallback value, await, and evaluation context are preserved exactly.
 */

import LaunchDarkly from "launchdarkly-node-server-sdk";
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

export async function getDiscountPercentage(user: User): Promise<number> {
  const ctx = { targetingKey: user.id, plan: user.plan, region: user.region };
  return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);
}

export async function getMaxDiscountAmount(user: User): Promise<number> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getNumberValue("max-discount-amount", 50, ctx);
}

export async function getDiscountConfig(user: User): Promise<DiscountConfig> {
  const ctx = { targetingKey: user.id, plan: user.plan, region: user.region };
  const fallback: DiscountConfig = { percentage: 0, maxAmount: 0, applicablePlans: [] };
  return openFeatureClient.getObjectValue("discount-config", fallback, ctx) as Promise<DiscountConfig>;
}

export async function getPricingTier(user: User): Promise<PricingTier> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  const fallback: PricingTier = { name: "Free", monthlyPrice: 0, features: ["basic"] };
  return openFeatureClient.getObjectValue("pricing-tier-config", fallback, ctx) as Promise<PricingTier>;
}

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
