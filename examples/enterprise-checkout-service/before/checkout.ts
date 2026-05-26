/**
 * before/checkout.ts — snapshot before `flaglint migrate --apply`
 *
 * This file is identical to src/checkout.ts before migration.
 * Direct LaunchDarkly Node.js server SDK calls are present.
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
  return ldClient.boolVariation("checkout-v2", ctx, false);
}

export async function getPaymentProvider(user: User): Promise<string> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return ldClient.stringVariation("payment-provider", ctx, "stripe");
}

export async function isOneClickCheckoutEnabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, plan: user.plan };
  return ldClient.boolVariation("one-click-checkout", ctx, false);
}

export async function getCheckoutCurrency(user: User): Promise<string> {
  const ctx = { targetingKey: user.id };
  return ldClient.stringVariation("checkout-currency", ctx, "USD");
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
