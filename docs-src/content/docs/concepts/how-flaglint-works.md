---
title: How FlagLint Works
description: The source-analysis model behind inventory, migration previews, and validation.
lastUpdated: 2026-05-28
---

FlagLint performs local static analysis. It parses JavaScript and TypeScript source files, tracks LaunchDarkly client provenance from supported Node.js server SDK imports, and records evaluation call sites.

## Analysis Pipeline

```text
Source files
  -> local AST analysis
  -> LaunchDarkly client provenance
  -> evaluation inventory
  -> migration inventory
  -> report / diff / SARIF
```

FlagLint does not execute application code and does not call LaunchDarkly APIs.

## Provenance Rules

Supported LaunchDarkly clients come from `@launchdarkly/node-server-sdk` or legacy `launchdarkly-node-server-sdk` imports and require initialization through supported SDK patterns.

Unrelated identifiers named `client`, `flag`, `feature`, `gate`, `init`, or `ldInit` are not treated as LaunchDarkly clients unless import provenance is proven.

## Output Types

- Inventory reports from `scan`.
- Reviewable migration diffs from `migrate --dry-run`.
- Guarded source edits from `migrate --apply`.
- Policy reports and SARIF from `validate`.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/concepts/how-flaglint-works.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Safety Model](/docs/concepts/safety-model/)
