---
title: OpenFeature Boundary
description: How FlagLint helps move application code behind OpenFeature while LaunchDarkly remains the provider.
lastUpdated: 2026-05-28
---

The migration goal is not to remove LaunchDarkly on day one. The goal is to move application-facing evaluation calls to OpenFeature.

## Provider Architecture Diagram

```text
Application code
  -> OpenFeature client
  -> LaunchDarkly OpenFeature provider
  -> LaunchDarkly
```

## Before

```ts
return ldClient.boolVariation("checkout-v2", ctx, false);
```

## After

```ts
return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

FlagLint preserves the original flag key, fallback, and context expression. Provider/bootstrap setup is separate and must be reviewed by the platform team.

## Why This Helps

Once application code evaluates through OpenFeature, teams can enforce a single boundary in CI and keep provider-specific setup centralized.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/concepts/openfeature-boundary.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Source-Level Debt Signals](/docs/concepts/source-level-debt-signals/)
