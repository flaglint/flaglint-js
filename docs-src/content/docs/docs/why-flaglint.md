---
title: Why FlagLint
description: Why platform teams use FlagLint when standardizing feature-flag access.
lastUpdated: 2026-05-28
---

FlagLint is for teams that already have LaunchDarkly Node.js server-side evaluation calls in application code and want to standardize new application code on OpenFeature without changing providers on day one.

## The Problem

Direct SDK evaluation calls spread vendor-specific access patterns across services:

```ts
return ldClient.boolVariation("checkout-v2", ctx, false);
```

That makes standardization hard because each service needs an inventory, a reviewed migration plan, a guarded rewrite path, and CI enforcement so direct SDK usage does not return.

## What FlagLint Provides

- AST-based inventory of supported LaunchDarkly Node.js server SDK evaluations.
- Migration plans that separate proven rewrites from manual-review cases.
- Guarded `migrate --apply` for call sites with static keys, known fallback types, context, and a proven OpenFeature client binding.
- `validate --no-direct-launchdarkly` for CI policy enforcement and SARIF annotations.

## What FlagLint Does Not Claim

FlagLint does not identify production-stale flags. It does not query LaunchDarkly for age, ownership, evaluation history, environment configuration, or production usage. Local review signals are source-level hints, not proof that a production flag is stale.

FlagLint also does not detect browser SDKs, React SDKs, non-Node SDKs, or non-LaunchDarkly providers.

## Provider Architecture

```text
Application code
  -> OpenFeature client
  -> LaunchDarkly OpenFeature provider
  -> LaunchDarkly
```

LaunchDarkly remains the provider. OpenFeature becomes the application-facing evaluation API.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/why-flaglint.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Enterprise Demo](/docs/enterprise-demo/)
