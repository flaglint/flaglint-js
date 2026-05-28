---
title: Quickstart
description: Run FlagLint in two minutes, read the output, and choose the next safe step.
lastUpdated: 2026-05-28
---

## Requirements

- Node.js 20 or newer. This is read from `package.json` through the package `engines.node` value.
- A JavaScript or TypeScript project using LaunchDarkly Node.js server-side SDK evaluation calls from:
  - `@launchdarkly/node-server-sdk`
  - legacy `launchdarkly-node-server-sdk`

Browser SDKs, React SDKs, non-Node SDKs, and non-LaunchDarkly providers are outside current detection coverage and do not appear in reports.

## 1. Scan Your Source

```bash
npx flaglint scan ./src
```

The enterprise checkout demo in this repository contains this real TypeScript call site:

```ts
import LaunchDarkly from "@launchdarkly/node-server-sdk";
import { openFeatureClient } from "../platform/feature-flags.js";

const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

export async function isCheckoutV2Enabled(user: User): Promise<boolean> {
  const ctx = { targetingKey: user.id, email: user.email, plan: user.plan };
  return ldClient.boolVariation("checkout-v2", ctx, false);
}
```

Generated from `examples/enterprise-checkout-service/src`:

```text
- Scanning ./examples/enterprise-checkout-service/src...
✓ 20 flag usages found across 11 unique flags (90ms)
ℹ  1 dynamic flag key(s) require manual review
```

The Markdown report inventory includes the detected static and manual-review calls:

```text
| checkout-v2 | 1 | 1 | boolVariation | ✓ Active |
| payment-provider | 1 | 1 | stringVariation | ✓ Active |
| discount-percentage | 1 | 1 | numberVariation | ✓ Active |
| discount-config | 1 | 1 | jsonVariation | ✓ Active |
| * | 1 | 1 | allFlagsState | ✓ Active |
```

## 2. Preview a Migration

```bash
npx flaglint migrate ./src --dry-run
```

Generated from the same demo:

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

Actual diff excerpt:

```diff
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);

-  return ldClient.stringVariation("payment-provider", ctx, "stripe");
+  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);

-  return ldClient.numberVariation("discount-percentage", ctx, 0);
+  return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);

-  return ldClient.jsonVariation("discount-config", ctx, fallback) as Promise<DiscountConfig>;
+  return openFeatureClient.getObjectValue("discount-config", fallback, ctx) as Promise<DiscountConfig>;
```

FlagLint preserves the flag key, fallback value, evaluation context, inferred value type, and existing `await` behavior. It changes the call-site evaluation API from the LaunchDarkly SDK method to the matching OpenFeature value method only when the required inputs and an OpenFeature client binding are proven.

## 3. Understand Manual Review

The same dry run reports skipped usages:

```text
- analytics.ts:51:43 — `flagKey` via `variationDetail`: detail methods skipped: OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires manual review
- analytics.ts:104:22 — `*` via `allFlagsState`: bulk inventory call has no single-flag codemod
- flags-wrapper.ts:48:9 — `flagKey` via `boolVariation`: dynamic key requires manual review
```

Dynamic keys, detail evaluations, bulk calls, unknown fallback types, configured wrappers, and ambiguous OpenFeature client bindings are reported for review and are not automatically rewritten.

## 4. Add Provider Setup

FlagLint does not generate provider/bootstrap files. LaunchDarkly remains the provider; OpenFeature becomes the application-facing evaluation API.

Next: [add the LaunchDarkly OpenFeature provider](/docs/tutorials/add-openfeature-provider/).

## 5. Enforce in CI

After migration, block new direct LaunchDarkly evaluation calls:

```bash
npx flaglint validate ./src --no-direct-launchdarkly
```

Completed-state demo output:

```text
- Scanning ./examples/enterprise-checkout-service/after-complete...
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

## Workflow Diagram

```text
Existing Node.js service
  -> flaglint scan
  -> migration inventory
  -> migrate --dry-run
  -> reviewed OpenFeature diff
  -> validate in CI
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/quickstart.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Why FlagLint](/docs/why-flaglint/)
