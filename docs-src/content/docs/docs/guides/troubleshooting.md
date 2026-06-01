---
title: Troubleshooting
description: Common FlagLint setup and migration issues.
lastUpdated: 2026-05-28
---

## No LaunchDarkly Usage Detected

Confirm the code uses one of the supported Node.js server SDK packages:

- `@launchdarkly/node-server-sdk`
- `launchdarkly-node-server-sdk`

Browser SDKs, React SDKs, non-Node SDKs, and non-LaunchDarkly providers are outside current detection coverage.

## `--apply` Skips Files

`--apply` needs a proven OpenFeature client binding. Add a local `OpenFeature.getClient()` binding or configure imported shared clients with `openFeatureClientBindings`.

## Dirty Working Tree

`migrate --apply` refuses to edit a dirty git working tree by default. Commit, stash, use a temporary copy, or pass `--allow-dirty` only when you intentionally accept the risk.

## CI Validation Fails

Use `validate --no-direct-launchdarkly` only after the relevant source path has migrated. Provider/bootstrap files can be excluded with `--bootstrap-exclude`.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/guides/troubleshooting.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [OpenFeature Provider](/docs/integrations/openfeature-provider/)
