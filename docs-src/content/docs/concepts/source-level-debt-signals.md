---
title: Source-Level Debt Signals
description: What FlagLint review signals mean, and what they do not prove.
lastUpdated: 2026-05-28
---

FlagLint can surface local source-level review signals. It does not identify production-stale flags.

## What FlagLint Knows

- A flag key appears in source.
- A key is dynamic.
- A call is a detail evaluation.
- A call is a bulk flag-state call.
- A wrapper name was configured.
- A local source heuristic such as `minFileCount` was explicitly configured.

## What FlagLint Does Not Know

FlagLint does not query LaunchDarkly for flag age, owner, tags, environment configuration, evaluation history, or production usage. A source-level signal is a review hint, not proof that a production flag is stale or safe to delete.

## `minFileCount`

The default `minFileCount` is `0`, so a legitimate one-file flag is not marked stale by default. Teams may opt into `minFileCount: 1` if they want that local heuristic.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/concepts/source-level-debt-signals.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [scan CLI](/docs/cli/scan/)
