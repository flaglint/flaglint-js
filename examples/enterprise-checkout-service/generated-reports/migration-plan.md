# FlagLint migrate --dry-run

The transformations below use proven OpenFeature client bindings already present in the affected files.
No files are modified by dry-run output.

Reviewable diffs: 10
Diffs requiring provider setup: 0
Skipped usages: 10

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
- flags-wrapper.ts:86:9 — `flagKey` via `variation`: dynamic key requires manual review
- product.ts:52:9 — `flagKey` via `boolVariation`: dynamic key requires manual review

