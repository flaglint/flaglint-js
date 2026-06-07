---
title: NestJS Guide
description: Apply FlagLint to a NestJS application — audit flag debt, migrate to OpenFeature, and enforce the boundary.
lastUpdated: 2026-06-06
---

NestJS projects place evaluation logic inside injectable services. FlagLint scans TypeScript source directly — no Nest runtime metadata is required.

## Typical directory structure

```text
src/
  app.module.ts
  platform/
    feature-flags.module.ts       # ← OpenFeature setup lives here
    feature-flags.service.ts      # ← shared evaluation wrapper
  checkout/
    checkout.service.ts           # direct LD calls to migrate
    checkout.module.ts
  pricing/
    pricing.service.ts
```

## Step 1 — Audit, excluding tests

```bash
npx flaglint audit ./src --exclude-tests
```

```text
✓ Audit complete: 11 flags — 1 high risk, 10 medium risk
```

The `--exclude-tests` flag prevents test fixtures from inflating counts.

## Step 2 — Scan for detailed inventory

```bash
npx flaglint scan ./src --exclude-tests --format json --output flag-inventory.json
```

Use the JSON output to cross-reference flags with your NestJS module boundaries before migrating.

## Step 3 — Set up a shared OpenFeature service

Create `src/platform/feature-flags.service.ts`:

```ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import { OpenFeature, Client } from "@openfeature/server-sdk";
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  client!: Client;

  async onModuleInit() {
    await OpenFeature.setProviderAndWait(
      new LaunchDarklyProvider(process.env.LD_SDK_KEY!)
    );
    this.client = OpenFeature.getClient();
  }
}
```

Export it from `feature-flags.module.ts` and import it into any module that needs flag evaluation.

Add the binding to `.flaglintrc`:

```json
{
  "exclude": ["**/*.spec.ts", "**/*.test.ts"],
  "openFeatureClientBindings": [
    {
      "importName": "openFeatureClient",
      "modulePatterns": ["**/platform/feature-flags.service"]
    }
  ]
}
```

## Step 4 — Preview migration

```bash
npx flaglint migrate ./src --dry-run --exclude-tests
```

Example diff inside a NestJS service:

```diff
- const enabled = await this.ldClient.boolVariation("new-checkout", ctx, false);
+ const enabled = await this.featureFlagsService.client.getBooleanValue("new-checkout", false, ctx);
```

Review each diff. FlagLint will not rewrite calls where the client binding is ambiguous or injected through a dynamic reference.

## Step 5 — Apply on a branch

```bash
git checkout -b migrate/openfeature
npx flaglint migrate ./src --apply --exclude-tests
```

## Step 6 — Enforce in CI

```bash
npx flaglint validate ./src --no-direct-launchdarkly --exclude-tests
```

## Wrapper detection

If your team uses a shared evaluation wrapper that accepts dynamic flag keys, configure it so FlagLint surfaces those calls for manual review:

```json
{
  "wrappers": ["evaluateFlag", "getFeatureFlag"]
}
```

Wrappers are reported but never auto-rewritten.

[Edit this page](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/guides/nestjs.md) · [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml) · Next: [Monorepos](/docs/guides/monorepos/)
