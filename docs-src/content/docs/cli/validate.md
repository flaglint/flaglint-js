---
title: flaglint validate
description: Enforce no-direct-LaunchDarkly policy and emit SARIF findings.
lastUpdated: 2026-05-28
---

`flaglint validate` checks whether source files comply with migration policy.

## Blocking Policy Command

```bash
npx flaglint validate ./src --no-direct-launchdarkly
```

Fail output from the enterprise demo migration-in-progress state:

```text
✗ validate --no-direct-launchdarkly: 20 direct LaunchDarkly evaluation call(s) found.

  checkout.ts:40:9 — boolVariation("checkout-v2")
  pricing.ts:46:9 — numberVariation("discount-percentage")

These files must migrate to OpenFeature before this rule passes.
Run `flaglint migrate --dry-run` to review the migration plan.
```

Pass output from the completed demo state:

```text
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

## SARIF

```bash
npx flaglint validate ./src \
  --no-direct-launchdarkly \
  --format sarif \
  --output flaglint-validation.sarif
```

SARIF findings use rule id `flaglint.direct-launchdarkly`.

## Bootstrap Exclusions

Use `--bootstrap-exclude` for files that are allowed to wire the provider:

```bash
npx flaglint validate ./src \
  --no-direct-launchdarkly \
  --bootstrap-exclude "src/provider/setup.ts"
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/validate.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Configuration](/docs/cli/configuration/)
