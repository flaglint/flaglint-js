---
title: flaglint migrate
description: Generate migration plans, preview diffs, and apply guarded OpenFeature rewrites.
lastUpdated: 2026-05-28
---

`flaglint migrate` analyzes supported LaunchDarkly Node.js server SDK evaluation calls and separates safe call-site rewrites from manual-review work.

## Commands

```bash
npx flaglint migrate ./src
```

```bash
npx flaglint migrate ./src --dry-run
```

```bash
npx flaglint migrate ./src --apply
```

## Options

| Option | Description |
| --- | --- |
| `--dry-run` | Print reviewable diffs without modifying files. |
| `--apply` | Apply only safely automatable rewrites. |
| `--allow-dirty` | Allow `--apply` on a dirty git working tree. |
| `--output <file>` | Write the default migration report to a file. |
| `--config <path>` | Use an explicit config file. |
| `--exclude-tests` | Exclude test/spec files and test directories. |

## Dry-Run Output

Generated from the enterprise demo:

```text
LaunchDarkly usages found: 19
Safely automatable: 10 · Manual review: 9
Reviewable diffs: 10
Diffs requiring provider setup: 0
Skipped usages: 9
```

```diff
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

## Apply Contract

`--apply` rewrites only when a proven OpenFeature client binding exists. That binding may be local:

```ts
const openFeatureClient = OpenFeature.getClient();
```

or imported through configured `openFeatureClientBindings`.

Provider/bootstrap setup is never inserted automatically.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/migrate.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [validate CLI](/docs/cli/validate/)
