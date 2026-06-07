---
title: Express Guide
description: Apply FlagLint to an Express Node.js service — audit, migrate, and enforce the OpenFeature boundary.
lastUpdated: 2026-06-06
---

Express services typically scatter feature-flag evaluations across route handlers and service modules. This guide walks through a complete audit-to-enforce cycle on a standard Express project.

## Typical directory structure

```text
src/
  app.ts                        # Express app setup
  routes/
    checkout.ts                 # route handlers with LD calls
    pricing.ts
  services/
    discount.ts                 # business logic with LD calls
  platform/
    feature-flags.ts            # ← OpenFeature client lives here
```

## Step 1 — Audit flag debt

```bash
npx flaglint audit ./src
```

Expected output for a service with mixed flag usage:

```text
✓ Audit complete: 8 flags — 2 high risk, 6 medium risk

| Flag Key              | Risk   | Usages | Reasons                           |
|-----------------------|--------|--------|-----------------------------------|
| <dynamic key>         | High   | 3      | key cannot be resolved statically |
| checkout-experiment   | High   | 1      | detail evaluation                 |
| checkout-v2           | Medium | 1      | safely automatable                |
| payment-provider      | Medium | 2      | safely automatable                |
```

High-risk flags require manual review. Medium-risk flags are safe candidates for `migrate --apply`.

## Step 2 — Configure the OpenFeature client binding

Before migration, create or verify a central OpenFeature client in `src/platform/feature-flags.ts`:

```ts
import { OpenFeature } from "@openfeature/server-sdk";
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

await OpenFeature.setProviderAndWait(
  new LaunchDarklyProvider(process.env.LD_SDK_KEY!)
);

export const openFeatureClient = OpenFeature.getClient();
```

Then add the binding to `.flaglintrc`:

```json
{
  "openFeatureClientBindings": [
    {
      "importName": "openFeatureClient",
      "modulePatterns": ["**/platform/feature-flags"]
    }
  ]
}
```

## Step 3 — Preview safe migrations

```bash
npx flaglint migrate ./src --dry-run
```

Example diff for a route handler:

```diff
- const enabled = await ldClient.boolVariation("checkout-v2", ctx, false);
+ const enabled = await openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

Review every diff before applying. FlagLint preserves the flag key, fallback value, evaluation context, and `await` behavior.

## Step 4 — Apply on a branch

```bash
git checkout -b migrate/openfeature
npx flaglint migrate ./src --apply
```

Run your test suite immediately after apply. Dynamic keys, detail evaluations, and bulk calls are intentionally skipped — fix those manually.

## Step 5 — Enforce in CI

Add a validate step to your GitHub Actions workflow after migration is complete:

```yaml
- name: Enforce OpenFeature boundary
  run: npx flaglint validate ./src --no-direct-launchdarkly
```

`validate` exits `1` if any direct LaunchDarkly evaluation call is found, blocking new vendor-coupled code from entering the codebase.

## Common unsupported pattern

```ts
// Dynamic key — not automatable
const value = await ldClient.boolVariation(getFlagKey(user), ctx, false);
```

FlagLint reports this as high-risk and skips it. Replace with a static key or use a wrapper that evaluates per known key.

[Edit this page](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/guides/express.md) · [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml) · Next: [NestJS Guide](/docs/guides/nestjs/)
