/**
 * platform/feature-flags.ts
 *
 * This bootstrap module centralizes the LaunchDarkly OpenFeature provider
 * integration. Application service code evaluates flags through OpenFeature
 * rather than direct LaunchDarkly Node.js server SDK evaluation calls.
 *
 * LaunchDarkly remains the feature flag provider throughout migration.
 * Only the application-facing API changes — all service files import
 * `openFeatureClient` from this module and call `get*Value()` instead
 * of `ldClient.*Variation()`.
 *
 * This file is excluded from `flaglint validate --no-direct-launchdarkly`
 * via `--bootstrap-exclude "platform/feature-flags.ts"`. Direct
 * LaunchDarkly SDK usage here is intentional: it registers the
 * LaunchDarkly provider so every other service can evaluate flags
 * through OpenFeature without importing the LaunchDarkly SDK directly.
 */

import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";
import { OpenFeature } from "@openfeature/server-sdk";

if (!process.env.LD_SDK_KEY) {
  throw new Error(
    "LD_SDK_KEY environment variable is required for feature flag bootstrap"
  );
}

// Register LaunchDarkly as the OpenFeature provider.
// LaunchDarkly continues to serve feature flags.
// All application services call OpenFeature, not the LaunchDarkly SDK directly.
const ldProvider = new LaunchDarklyProvider(process.env.LD_SDK_KEY);
await OpenFeature.setProviderAndWait(ldProvider);

// Evaluation context: use `targetingKey` for OpenFeature compliance.
// LaunchDarkly also accepts `key` — both are forwarded by the provider.
export const openFeatureClient = OpenFeature.getClient("checkout-platform");

export type EvaluationContext = {
  targetingKey: string;
  [key: string]: unknown;
};
