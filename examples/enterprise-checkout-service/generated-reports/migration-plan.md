# FlagLint migrate --dry-run

These diffs use the placeholder `openFeatureClient` and require OpenFeature provider/client setup before they can be applied.
No files are modified by dry-run output.

Reviewable diffs: 10
Diffs requiring provider setup: 0
Skipped usages: 9

## Provider Setup (Required Before Applying Diffs)

LaunchDarkly remains your feature flag provider.
OpenFeature becomes the evaluation API your application code calls.
You add one initialization step; **do not remove any LaunchDarkly packages** —
the OpenFeature provider depends on them at runtime.

### 1. Install packages

```sh
npm install @openfeature/server-sdk @launchdarkly/node-server-sdk @launchdarkly/openfeature-node-server
```

### 2. Initialize once at application startup

Add the following to your application bootstrap (do not apply automatically):

```typescript
import { OpenFeature } from "@openfeature/server-sdk";
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

const ldProvider = new LaunchDarklyProvider(process.env.LD_SDK_KEY!);
await OpenFeature.setProviderAndWait(ldProvider);

// Share this client across your application.
// Replace the `openFeatureClient` placeholder in the diffs below.
const openFeatureClient = OpenFeature.getClient();
```

### 3. Evaluation context — targeting key

LaunchDarkly requires a targeting key in every evaluation context. The
provider accepts either OpenFeature `targetingKey` or an existing
LaunchDarkly `key`.
Keep your existing LaunchDarkly `key` contexts, or use `targetingKey`
for new OpenFeature-native contexts:

```typescript
{ targetingKey: user.id } // or { key: user.id }
```

## Diffs
```diff
diff --git a/checkout.ts b/checkout.ts
--- a/checkout.ts
+++ b/checkout.ts
@@ -40,1 +40,1 @@
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
@@ -49,1 +49,1 @@
-  return ldClient.stringVariation("payment-provider", ctx, "stripe");
+  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);
@@ -58,1 +58,1 @@
-  return ldClient.boolVariation("one-click-checkout", ctx, false);
+  return openFeatureClient.getBooleanValue("one-click-checkout", false, ctx);
@@ -67,1 +67,1 @@
-  return ldClient.stringVariation("checkout-currency", ctx, "USD");
+  return openFeatureClient.getStringValue("checkout-currency", "USD", ctx);
diff --git a/pricing.ts b/pricing.ts
--- a/pricing.ts
+++ b/pricing.ts
@@ -46,1 +46,1 @@
-  return ldClient.numberVariation("discount-percentage", ctx, 0);
+  return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);
@@ -55,1 +55,1 @@
-  return ldClient.numberVariation("max-discount-amount", ctx, 50);
+  return openFeatureClient.getNumberValue("max-discount-amount", 50, ctx);
@@ -69,1 +69,1 @@
-  return ldClient.jsonVariation("discount-config", ctx, fallback) as Promise<DiscountConfig>;
+  return openFeatureClient.getObjectValue("discount-config", fallback, ctx) as Promise<DiscountConfig>;
@@ -83,1 +83,1 @@
-  return ldClient.jsonVariation("pricing-tier-config", ctx, fallback) as Promise<PricingTier>;
+  return openFeatureClient.getObjectValue("pricing-tier-config", fallback, ctx) as Promise<PricingTier>;
diff --git a/product.ts b/product.ts
--- a/product.ts
+++ b/product.ts
@@ -61,1 +61,1 @@
-  return ldClient.stringVariation("recommendations-variant", ctx, "control");
+  return openFeatureClient.getStringValue("recommendations-variant", "control", ctx);
@@ -70,1 +70,1 @@
-  return ldClient.boolVariation("bulk-discount-enabled", ctx, false);
+  return openFeatureClient.getBooleanValue("bulk-discount-enabled", false, ctx);
```

## Skipped Usages
- analytics.ts:51:43 — `flagKey` via `variationDetail`: detail methods skipped: OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires manual review
- analytics.ts:76:23 — `checkout-experiment` via `boolVariationDetail`: detail methods skipped: OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires manual review
- analytics.ts:104:22 — `*` via `allFlagsState`: bulk inventory call has no single-flag codemod
- flags-wrapper.ts:48:9 — `flagKey` via `boolVariation`: dynamic key requires manual review
- flags-wrapper.ts:67:11 — `flagKey` via `boolVariation`: dynamic key requires manual review
- flags-wrapper.ts:70:11 — `flagKey` via `stringVariation`: dynamic key requires manual review
- flags-wrapper.ts:73:11 — `flagKey` via `numberVariation`: dynamic key requires manual review
- flags-wrapper.ts:75:9 — `flagKey` via `jsonVariation`: dynamic key requires manual review
- product.ts:52:9 — `flagKey` via `boolVariation`: dynamic key requires manual review
