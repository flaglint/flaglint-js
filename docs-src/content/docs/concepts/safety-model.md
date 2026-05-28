---
title: Safety Model
description: How FlagLint avoids rewriting ambiguous or unsupported flag evaluations.
lastUpdated: 2026-05-28
---

FlagLint is conservative. It separates inventory, review, and source edits so teams can inspect migration work before applying it.

## Safety Model Diagram

```text
Source files
  -> local AST analysis
  -> inventory / diff / SARIF
  -> developer review
```

## What `--apply` Requires

`migrate --apply` rewrites a call site only when all of these are true:

- The LaunchDarkly client is proven from supported Node.js server SDK provenance.
- The call is a supported value evaluation method.
- The flag key is static.
- The fallback value and value type are known.
- The evaluation context expression is present.
- A local or configured imported OpenFeature client binding is proven.
- The git working tree is clean, unless `--allow-dirty` is explicitly used.

## What Is Never Auto-Rewritten

- Dynamic keys.
- Detail evaluations such as `variationDetail` and `boolVariationDetail`.
- Bulk calls such as `allFlags()` and `allFlagsState()`.
- Unknown fallback types.
- Configured wrappers.
- Ambiguous or unconfigured OpenFeature client bindings.
- Browser SDKs, React SDKs, non-Node SDKs, and non-LaunchDarkly providers.

## Required Review

Generated diffs are reviewable migration assistance, not proof of production safety. Run tests and review each diff before merging.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/concepts/safety-model.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [OpenFeature Boundary](/docs/concepts/openfeature-boundary/)
