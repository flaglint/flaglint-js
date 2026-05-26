/**
 * after-complete/checkout.ts
 *
 * Checkout service — AFTER full OpenFeature migration.
 *
 * Automatically migrated by `flaglint migrate --apply`:
 *   boolVariation  → openFeatureClient.getBooleanValue
 *   stringVariation → openFeatureClient.getStringValue
 *
 * LaunchDarkly SDK import and ldClient removed.
 * openFeatureClient is imported from the shared platform bootstrap.
 *
 * `flaglint validate --no-direct-launchdarkly` passes on this file (0 violations).
 */

import { openFeatureClient } from "../platform/feature-flags.js";

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
 * Migrated: boolVariation → openFeatureClient.getBooleanValue
 */
export async function isCheckoutV2Enabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, email: user.email, plan: user.plan };
  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
}

/**
 * Get the active payment provider for this user.
 * Migrated: stringVariation → openFeatureClient.getStringValue
 */
export async function getPaymentProvider(user: User): Promise<string> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);
}

/**
 * Check if one-click checkout is enabled for this user.
 * Migrated: boolVariation → openFeatureClient.getBooleanValue
 */
export async function isOneClickCheckoutEnabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getBooleanValue("one-click-checkout", false, ctx);
}

/**
 * Get the active currency for the checkout session.
 * Migrated: stringVariation → openFeatureClient.getStringValue
 */
export async function getCheckoutCurrency(user: User): Promise<string> {
  const ctx = { targetingKey: user.id };
  return openFeatureClient.getStringValue("checkout-currency", "USD", ctx);
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
