---
title: Enterprise Demo
description: Walk through a realistic LaunchDarkly-to-OpenFeature migration in a checkout service.
lastUpdated: 2026-05-28
---

The enterprise checkout-service demo shows a fictional mid-sized SaaS company standardizing several Node.js services on OpenFeature while keeping LaunchDarkly as the provider.

Source: [`examples/enterprise-checkout-service`](https://github.com/flaglint/flaglint/tree/main/examples/enterprise-checkout-service)

## What It Demonstrates

- `boolVariation`, `stringVariation`, `numberVariation`, and `jsonVariation`.
- Shared OpenFeature client imports.
- Dynamic keys requiring manual review.
- Detail evaluations requiring manual review.
- Provider/bootstrap files excluded from policy enforcement.
- Completed-state validation that scans real files and passes.

## Contributor-Mode Commands

From the repository root:

```bash
npm install
npm run build
```

Generate inventory:

```bash
node ./dist/bin/flaglint.js scan \
  ./examples/enterprise-checkout-service/src \
  --config ./examples/enterprise-checkout-service/.flaglintrc \
  --format html \
  --output report.html
```

Preview migration:

```bash
node ./dist/bin/flaglint.js migrate \
  ./examples/enterprise-checkout-service/src \
  --config ./examples/enterprise-checkout-service/.flaglintrc \
  --dry-run
```

Validate the completed state:

```bash
node ./dist/bin/flaglint.js validate \
  ./examples/enterprise-checkout-service/after-complete \
  --no-direct-launchdarkly \
  --config ./examples/enterprise-checkout-service/.flaglintrc
```

Expected output:

```text
- Scanning ./examples/enterprise-checkout-service/after-complete...
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

## Production Use

Use the published package after the release that contains the documented capability:

```bash
npx flaglint scan ./src
npx flaglint migrate ./src --dry-run
npx flaglint validate ./src --no-direct-launchdarkly
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/enterprise-demo.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Migrate a Node Service](/docs/tutorials/migrate-a-node-service/)
