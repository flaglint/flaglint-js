/**
 * after/checkout.ts — snapshot after `flaglint migrate --apply`
 *
 * This shows what flaglint migrate --apply produces for src/checkout.ts.
 *
 * Changes applied automatically:
 *   boolVariation("checkout-v2", ctx, false)
 *     → openFeatureClient.getBooleanValue("checkout-v2", false, ctx)
 *
 *   stringVariation("payment-provider", ctx, "stripe")
 *     → openFeatureClient.getStringValue("payment-provider", "stripe", ctx)
 *
 *   boolVariation("one-click-checkout", ctx, false)
 *     → openFeatureClient.getBooleanValue("one-click-checkout", false, ctx)
 *
 *   stringVariation("checkout-currency", ctx, "USD")
 *     → openFeatureClient.getStringValue("checkout-currency", "USD", ctx)
 *
 * LaunchDarkly remains the provider. Only the call-site API changes.
 * Flag key, fallback value, await, and evaluation context are preserved exactly.
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

export async function isCheckoutV2Enabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, email: user.email, plan: user.plan };
  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
}

export async function getPaymentProvider(user: User): Promise<string> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);
}

export async function isOneClickCheckoutEnabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return openFeatureClient.getBooleanValue("one-click-checkout", false, ctx);
}

export async function getCheckoutCurrency(user: User): Promise<string> {
  const ctx = { targetingKey: user.id };
  return openFeatureClient.getStringValue("checkout-currency", "USD", ctx);
}

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

  return { orderId: `ord_${Date.now()}`, provider, currency };
}
