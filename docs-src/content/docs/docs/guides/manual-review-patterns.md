---
title: Manual Review Patterns
description: Patterns FlagLint reports but does not automatically rewrite.
lastUpdated: 2026-05-28
---

Manual-review patterns are detected where supported, but they are not automatically rewritten.

## Dynamic Keys

```ts
return ldClient.boolVariation(flagKey, ctx, false);
```

FlagLint cannot know all runtime key values from static source alone.

## Detail Evaluations

```ts
return ldClient.variationDetail(flagKey, ctx, false);
```

OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires review.

## Bulk Calls

```ts
return ldClient.allFlagsState(ctx);
```

Bulk inventory calls have no single-flag codemod.

## Unknown Fallback Types

Generic `variation(...)` calls are automatable only when the fallback literal proves the value type.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/guides/manual-review-patterns.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Troubleshooting](/docs/guides/troubleshooting/)
