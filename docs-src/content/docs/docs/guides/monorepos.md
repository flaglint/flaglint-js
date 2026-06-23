---
title: Monorepos
description: Run FlagLint across a monorepo — per-package configs, targeted migration, and workspace-level CI enforcement.
lastUpdated: 2026-06-06
---

Migrate one package at a time. FlagLint scans a single directory per invocation — use package-specific config files when import paths, wrapper names, or OpenFeature client bindings differ across packages.

## Typical workspace structure

```text
services/
  checkout/
    src/
      routes/checkout.ts
      platform/feature-flags.ts
    .flaglintrc                  # ← per-package config
    package.json
  pricing/
    src/
    .flaglintrc
packages/
  feature-flag-client/
    src/
      index.ts                   # shared OpenFeature wrapper
```

## Step 1 — Audit one service

```bash
npx flaglint audit ./services/checkout/src --config ./services/checkout/.flaglintrc
```

Run audit per package rather than at workspace root to avoid cross-package noise in reports.

## Step 2 — Per-package config

`services/checkout/.flaglintrc`:

```json
{
  "include": ["**/*.{ts,js}"],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  "openFeatureClientBindings": [
    {
      "importName": "openFeatureClient",
      "modulePatterns": ["**/platform/feature-flags"]
    }
  ]
}
```

If a shared client is exported from a workspace package, add the package pattern:

```json
{
  "openFeatureClientBindings": [
    {
      "importName": "featureFlagClient",
      "modulePatterns": ["**/feature-flag-client/src/index"]
    }
  ]
}
```

## Step 3 — Preview per package

```bash
npx flaglint migrate ./services/checkout/src \
  --config ./services/checkout/.flaglintrc \
  --dry-run
```

## Step 4 — Apply per package on a branch

```bash
git checkout -b migrate/checkout-openfeature
npx flaglint migrate ./services/checkout/src \
  --config ./services/checkout/.flaglintrc \
  --apply
```

Do not run `--apply` at workspace root. Keep migration branches scoped to one package.

## Step 5 — CI enforcement per package

Add a validate step per package in CI. Example GitHub Actions matrix:

```yaml
strategy:
  matrix:
    package: [checkout, pricing, inventory]
steps:
  - name: Enforce OpenFeature boundary — ${{ matrix.package }}
    run: |
      npx flaglint validate ./services/${{ matrix.package }}/src \
        --config ./services/${{ matrix.package }}/.flaglintrc \
        --no-direct-launchdarkly
```

## What is outside current scope

Browser SDKs, React SDKs, and non-Node packages in the monorepo are not detected. Run FlagLint only against Node.js server-side source directories. Non-Node packages will show zero results, not errors.

[Edit this page](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/guides/monorepos.md) · [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml) · Next: [Manual Review Patterns](/docs/guides/manual-review-patterns/)
