---
title: Migrate a Node Service
description: Preview and apply guarded OpenFeature call-site rewrites in a LaunchDarkly Node.js service.
lastUpdated: 2026-05-28
---

This tutorial uses the committed enterprise checkout demo. It migrates application call sites while keeping LaunchDarkly as the provider.

## 1. Build the Local CLI

```bash
npm run build
```

## 2. Inspect the Inventory

```bash
node ./dist/bin/flaglint.js scan \
  ./examples/enterprise-checkout-service/src \
  --config ./examples/enterprise-checkout-service/.flaglintrc \
  --format markdown
```

Generated summary:

```text
✓ 20 flag usages found across 11 unique flags (90ms)
ℹ  1 dynamic flag key(s) require manual review
```

## 3. Preview the Migration

```bash
node ./dist/bin/flaglint.js migrate \
  ./examples/enterprise-checkout-service/src \
  --config ./examples/enterprise-checkout-service/.flaglintrc \
  --dry-run
```

Generated summary:

```text
LaunchDarkly usages found: 19
Safely automatable: 10 · Manual review: 9
Reviewable diffs: 10
Diffs requiring provider setup: 0
Skipped usages: 9
```

## 4. Apply on a Clean Branch

`migrate --apply` requires a clean git working tree unless `--allow-dirty` is explicitly passed. Use it on a branch or a temporary copy first:

```bash
node ./dist/bin/flaglint.js migrate \
  ./examples/enterprise-checkout-service/src \
  --config ./examples/enterprise-checkout-service/.flaglintrc \
  --apply
```

FlagLint rewrites only supported call sites with a proven OpenFeature client binding. It does not rewrite dynamic keys, detail evaluations, bulk calls, or ambiguous patterns.

## 5. Validate the Completed Boundary

```bash
node ./dist/bin/flaglint.js validate \
  ./examples/enterprise-checkout-service/after-complete \
  --config ./examples/enterprise-checkout-service/.flaglintrc \
  --no-direct-launchdarkly
```

Generated output:

```text
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/tutorials/migrate-a-node-service.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Add OpenFeature Provider](/docs/tutorials/add-openfeature-provider/)
