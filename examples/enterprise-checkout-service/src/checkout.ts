/**
 * src/checkout.ts
 *
 * Checkout service — uses direct LaunchDarkly Node.js server SDK calls.
 *
 * BEFORE migration: boolVariation and stringVariation direct calls.
 * These are safely automatable by `flaglint migrate --apply` because:
 *   - flag keys are static string literals
 *   - fallback values are explicit
 *   - evaluation context is present
 *   - openFeatureClient is imported from platform/feature-flags
 *
 * Run `flaglint migrate --dry-run` to preview the transformation.
 * Run `flaglint migrate --apply` to apply it automatically.
 */

import LaunchDarkly from "launchdarkly-node-server-sdk";
import { openFeatureClient } from "../platform/feature-flags.js";

const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

interface User {
  id: string;
  email: string;
  plan: "free" | "pro" | "enterprise";
}

interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Determine whether the new v2 checkout flow is enabled for this user.
 * flaglint migrate --apply: boolVariation → openFeatureClient.getBooleanValue
 */
export async function isCheckoutV2Enabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, email: user.email, plan: user.plan };
  return ldClient.boolVariation("checkout-v2", ctx, false);
}

/**
 * Get the active payment provider for this user.
 * flaglint migrate --apply: stringVariation → openFeatureClient.getStringValue
 */
export async function getPaymentProvider(user: User): Promise<string> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return ldClient.stringVariation("payment-provider", ctx, "stripe");
}

/**
 * Check if one-click checkout is enabled for this user.
 * flaglint migrate --apply: boolVariation → openFeatureClient.getBooleanValue
 */
export async function isOneClickCheckoutEnabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return ldClient.boolVariation("one-click-checkout", ctx, false);
}

/**
 * Get the active currency for the checkout session.
 * flaglint migrate --apply: stringVariation → openFeatureClient.getStringValue
 */
export async function getCheckoutCurrency(user: User): Promise<string> {
  const ctx = { targetingKey: user.id };
  return ldClient.stringVariation("checkout-currency", ctx, "USD");
}

/**
 * Process a checkout order using the current feature flag values.
 */
export async function processCheckout(
  user: User,
  cart: CartItem[]
): Promise<{ orderId: string; provider: string; currency: string }> {
  const [useV2, provider, currency] = await Promise.all([
    isCheckoutV2Enabled(user),
    getPaymentProvider(user),
    getCheckoutCurrency(user),
  ]);

  const total = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  console.log(`Checkout [v${useV2 ? "2" : "1"}] — provider: ${provider}, currency: ${currency}, total: ${total}`);

  return {
    orderId: `ord_${Date.now()}`,
    provider,
    currency,
  };
}
