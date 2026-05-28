---
title: Quickstart
description: Run your first FlagLint scan and understand the first migration outputs.
lastUpdated: 2026-05-28
---

## Requirements

- Node.js 20 or newer.
- A JavaScript or TypeScript project using the LaunchDarkly Node.js server-side SDK:
  - `@launchdarkly/node-server-sdk`
  - legacy `launchdarkly-node-server-sdk`

Browser SDKs, React SDKs, non-Node SDKs, and non-LaunchDarkly providers are outside current detection coverage and do not appear in reports.

## Run a Scan

```bash
npx flaglint scan ./src
```

Example output:

```text
✓ 15 flag usages found across 6 unique flags (48ms)
ℹ  1 dynamic flag key(s) require manual review
```

Write a report:

```bash
npx flaglint scan ./src --format html --output flaglint-inventory.html
```

## Preview a Migration

```bash
npx flaglint migrate ./src --dry-run
```

Example output:

```diff
- return await ldClient.boolVariation("checkout-v2", ctx, false);
+ return await openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

Dry-run output may use a proven local or imported OpenFeature client binding. If no binding is proven, the preview is marked as requiring provider/client setup and `--apply` will skip that call site.

## Enforce the Boundary

```bash
npx flaglint validate ./src --no-direct-launchdarkly
```

Pass output:

```text
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 42 file(s).
```

Fail output:

```text
✗ validate --no-direct-launchdarkly: 2 direct LaunchDarkly evaluation call(s) found.

  src/services/checkout.ts:42:8 — boolVariation("checkout-v2")
  src/services/pricing.ts:17:4 — boolVariation(dynamic key — manual review required)
```

## Next Steps

- Read the [supported scope](/docs/reference/supported-scope/).
- Configure [OpenFeature provider setup](/docs/integrations/openfeature-provider/).
- Try the [enterprise demo](/docs/enterprise-demo/).
