---
title: Limitations
description: Current supported boundaries and non-goals.
lastUpdated: 2026-05-28
---

FlagLint is intentionally narrow.

## Outside Detection Coverage

- Browser SDKs.
- React SDKs, hooks, and HOCs.
- Non-Node SDKs.
- Non-LaunchDarkly providers.
- Runtime-only flag key construction that cannot be resolved statically.

## Not Production Staleness Analysis

FlagLint does not query LaunchDarkly and does not identify production-stale flags. It cannot know flag age, owner, evaluation history, environment configuration, or production usage.

## Not Provider Bootstrap Automation

FlagLint does not insert provider setup files or remove LaunchDarkly dependencies. Existing LaunchDarkly dependencies remain needed while the LaunchDarkly OpenFeature provider is used.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/reference/limitations.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Security](/docs/reference/security/)
