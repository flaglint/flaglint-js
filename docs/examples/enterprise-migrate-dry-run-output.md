# Generated enterprise dry-run output

Generated with:

```bash
node ./dist/bin/flaglint.js migrate ./examples/enterprise-checkout-service/src --config ./examples/enterprise-checkout-service/.flaglintrc --dry-run
```

```text
- Scanning ./examples/enterprise-checkout-service/src...
LaunchDarkly usages found: 19
Safely automatable: 10 · Manual review: 9
# FlagLint migrate --dry-run

The transformations below use proven OpenFeature client bindings already present in the affected files.
No files are modified by dry-run output.

Reviewable diffs: 10
Diffs requiring provider setup: 0
Skipped usages: 9
```

```diff
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);

-  return ldClient.stringVariation("payment-provider", ctx, "stripe");
+  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);
```
