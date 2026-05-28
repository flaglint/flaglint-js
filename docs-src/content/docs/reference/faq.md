---
title: FAQ
description: Common questions about FlagLint scope and migration behavior.
lastUpdated: 2026-05-28
---

## Does FlagLint replace LaunchDarkly?

No. LaunchDarkly remains the provider. FlagLint helps move application-facing evaluation calls to OpenFeature.

## Does FlagLint delete stale flags?

No. FlagLint performs local source analysis and does not prove production staleness or deletion safety.

## Does FlagLint support React?

No. React SDKs, hooks, HOCs, browser SDKs, and non-Node SDKs are outside current detection coverage.

## When can `--apply` rewrite a call?

Only when the LaunchDarkly client, static flag key, value type, fallback, context, and OpenFeature client binding are proven.

## Does FlagLint change evaluation context?

No. Migrated call sites preserve the existing context expression.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/reference/faq.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Changelog](/docs/reference/changelog/)
