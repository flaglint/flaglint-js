---
title: FAQ
description: Common questions about FlagLint scope, commands, and migration behavior.
lastUpdated: 2026-06-20
---

## What is the difference between `audit` and `scan`?

`flaglint audit` gives you a planning view: risk-ranked flags, a readiness score
(0–100), a progress bar, and an optional effort estimate. Use it before a migration
to understand scope and priority. Output is human-readable by default.

`flaglint scan` gives you a structured inventory: every flag usage by file and line,
with call type, flag key, and staleness signals. Use it when you need machine-readable
output for automation, dashboards, or deeper review. Output defaults to Markdown;
use `--format json` for structured data.

Neither command modifies any files.

## Will FlagLint modify my source files without asking?

No. Only `flaglint migrate --apply` writes files, and only after you have reviewed
the dry-run output with `--dry-run`. Every other command (`audit`, `scan`, `validate`)
is read-only.

## How is FlagLint different from `ld-find-code-refs`?

[`ld-find-code-refs`](https://github.com/launchdarkly/ld-find-code-refs) is LaunchDarkly's
official tool for finding flag references in source code and syncing them to your
LaunchDarkly account. It requires a LaunchDarkly API key and uploads your code references
to LaunchDarkly servers.

FlagLint runs entirely locally with no API key and no source upload. Its goal is
different: not to catalog flag usage for LaunchDarkly, but to help you *remove* the
direct LaunchDarkly SDK dependency by migrating call sites to OpenFeature.

## Does FlagLint support the JavaScript client SDK or React SDK?

Not yet. FlagLint currently detects `@launchdarkly/node-server-sdk` and the legacy
`launchdarkly-node-server-sdk`. Browser SDKs (`launchdarkly-js-client-sdk`),
React SDKs (`launchdarkly-react-client-sdk`), and hooks (`useFlags`, `useLDClient`)
are outside current detection coverage.

## Can I use `flaglint validate` in CI even if I am not migrating?

Yes. `flaglint validate --no-direct-launchdarkly` exits 1 if any direct LaunchDarkly
evaluation call is found in the scanned directory. You can add it to a GitHub Actions
workflow as a policy gate independently of any migration work — for example, to
enforce that a service that has already migrated never regresses.

See the [GitHub Actions integration guide](/docs/integrations/github-actions/) and the
[`validate` reference](/docs/cli/validate/) for full details including SARIF output.

## Is there a config file I can use to exclude files or configure wrappers?

Yes. FlagLint reads `.flaglintrc` (or `.flaglintrc.json`, `.flaglintrc.yaml`) from the
project root. Options include:

- `exclude` — glob patterns to skip (e.g. `["**/*.test.ts", "**/fixtures/**"]`)
- `wrappers` — custom wrapper function names that FlagLint should treat as flag evaluations
- `minFileCount` — minimum matched files before a flag is counted as stale

See the [Configuration reference](/docs/cli/configuration/) for the full schema.

## Does FlagLint support monorepos?

Yes. Point it at any subdirectory:

```bash
npx flaglint audit ./packages/checkout-service/src
npx flaglint audit ./packages/payments-service/src
```

FlagLint does not require a monorepo-level config — each service can be audited
independently. See the [Monorepo guide](/docs/guides/monorepos/) for patterns
including scanning multiple packages and aggregating results.

## Does FlagLint replace LaunchDarkly?

No. LaunchDarkly remains the feature flag provider. FlagLint migrates the
*call-site evaluation API* from the LaunchDarkly SDK to OpenFeature — your flag
configuration, targeting rules, and LaunchDarkly account are unchanged.

After migration: `OpenFeature client → LaunchDarkly OpenFeature provider → LaunchDarkly`.

## Does FlagLint identify production-stale flags?

No. FlagLint performs local source analysis only. It does not query LaunchDarkly for
flag age, evaluation history, owner, or production usage. Source-level staleness signals
(keyword matches, path patterns, low usage count) are hints — not proof that a
production flag is safe to remove.

## What Node.js version is required?

Node.js 20 or newer. FlagLint uses ESM and requires Node.js 20+.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/reference/faq.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Changelog](/docs/reference/changelog/)
