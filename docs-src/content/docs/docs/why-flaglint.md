---
title: Why FlagLint
description: Why platform teams choose FlagLint to audit LaunchDarkly SDK usage and standardize on OpenFeature.
lastUpdated: 2026-06-20
---

Most teams that decide to adopt OpenFeature hit the same wall: they don't know how many
direct LaunchDarkly SDK calls are in their codebase, which ones are safe to migrate,
or what order to tackle them in. They reach for grep, get a number, and lose confidence
almost immediately — because grep finds references, it does not understand them.

FlagLint answers the three questions you need before touching a line of code:

1. **Where are all the direct LaunchDarkly calls?** — AST-based detection across every
   TypeScript and JavaScript file, with import tracing so aliases and re-exports are caught.
2. **Which ones are safe to migrate automatically?** — Only calls with a static flag key,
   a known fallback type, a proven evaluation context, and a verified OpenFeature client
   binding in scope qualify for automated rewriting.
3. **What will break if migrated naively?** — Dynamic keys, detail evaluations, bulk state
   calls, and unknown fallback types are surfaced for manual review. Nothing ambiguous is
   silently rewritten.

## Why Not Just Use Grep or Find-and-Replace?

Grep finds text. It does not understand argument order, variable binding, or import scope.

The most common production bug in LaunchDarkly → OpenFeature migrations is a silent
argument-order swap. LaunchDarkly is `(key, context, fallback)`. OpenFeature is
`(key, fallback, context)`. A find-and-replace migration transposes `context` and
`fallback` at every call site — producing valid TypeScript that evaluates flags
against the wrong value. Tests pass because the types match. Production breaks
because the values don't.

FlagLint catches this because it parses the AST. It knows which argument is which,
which binding is the LaunchDarkly client, and whether the OpenFeature client is
available in scope before generating any rewrite.

See [Why LaunchDarkly → OpenFeature migrations break in production](/blog/launchdarkly-openfeature-argument-order-bug/)
for a walkthrough of the exact bug.

## Why Not Use LaunchDarkly's Own `ld-find-code-refs`?

[`ld-find-code-refs`](https://github.com/launchdarkly/ld-find-code-refs) is a
flag *reference cataloger* — it finds flag keys in your code and uploads them to
your LaunchDarkly account. It requires an API key and syncs to LaunchDarkly servers.

FlagLint is a *migration tool*. It runs entirely locally with no API key and no
source upload. Its goal is the opposite of `ld-find-code-refs`: not to catalog
flag usage for LaunchDarkly, but to help you remove the direct LaunchDarkly SDK
dependency by migrating call sites to OpenFeature and enforcing the boundary in CI.

## What FlagLint Provides

| Capability | FlagLint | grep/sed | ld-find-code-refs |
|---|---|---|---|
| AST-based detection | ✓ | ✗ | ✗ |
| Import-traced client binding | ✓ | ✗ | ✗ |
| Argument-order-safe rewrites | ✓ | ✗ | ✗ |
| Risk classification | ✓ | ✗ | ✗ |
| Readiness score | ✓ | ✗ | ✗ |
| CI gate (SARIF) | ✓ | ✗ | ✗ |
| No API key required | ✓ | ✓ | ✗ |
| No source upload | ✓ | ✓ | ✗ |
| Runs locally | ✓ | ✓ | ✗ |

## What FlagLint Does Not Do

FlagLint is intentionally narrow:

- It does not replace LaunchDarkly. LaunchDarkly remains the provider.
- It does not generate provider or bootstrap files.
- It does not identify production-stale flags. Source-level signals (keyword matches,
  low usage count) are hints — not proof a production flag is safe to remove.
- It does not detect browser SDKs, React SDKs, non-Node SDKs, or non-LaunchDarkly providers.
- It does not query LaunchDarkly APIs or require any credentials.

## Provider Architecture After Migration

```text
Application code
  → OpenFeature client (vendor-neutral)
  → LaunchDarkly OpenFeature provider
  → LaunchDarkly (unchanged)
```

Your flag configuration, targeting rules, and LaunchDarkly account are untouched.
Only the call-site evaluation API changes — from the LaunchDarkly SDK method to the
matching OpenFeature method.

Ready? Run your first audit in under 2 minutes: [Quickstart →](/docs/quickstart/)

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/why-flaglint.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Enterprise Demo](/docs/enterprise-demo/)
