---
title: flaglint audit
description: Generate a local flag debt audit report with risk scoring. No API key required.
lastUpdated: 2026-06-02
---

`flaglint audit` scans your source code and classifies every detected LaunchDarkly Node.js SDK
call by risk level. It produces a shareable flag debt report without
modifying any files or requiring a LaunchDarkly API key.

Use `flaglint audit` before a migration to understand the full scope of work, or as a
standalone flag hygiene check even if you are not planning a migration.

## Command

```bash
npx flaglint audit ./src
```

## Options

| Option | Description |
| --- | --- |
| `--format json` | Write structured JSON. |
| `--format markdown` | Write a Markdown report (default). |
| `--format html` | Write a self-contained shareable HTML report. |
| `--output <file>` | Write report to a file. |
| `--config <path>` | Use an explicit config file. |
| `--exclude-tests` | Exclude test/spec files and test directories. |

## Risk Levels

Each flag is classified by risk level. Classification is based on the
call types detected in your source — no production data or API access is required.

**High risk** — requires manual review before any migration action:

- **Dynamic key** — the flag key is a variable or template literal. FlagLint cannot
  statically determine which flag is evaluated.
- **Detail evaluation** — `boolVariationDetail`, `variationDetail`. Returns metadata
  with no direct OpenFeature equivalent.
- **Bulk call** — `allFlagsState`. No single-flag codemod exists; requires an
  architecture decision.
- **React/browser hook** — `useFlags`, `useLDClient`, `withLDConsumer`. Outside
  current auto-migration scope.

**Medium risk** — safely automatable via `flaglint migrate`, but still a direct
LaunchDarkly SDK call that will need to move:

- Safely automatable static calls (`boolVariation`, `stringVariation`,
  `numberVariation`, `jsonVariation`) with a proven OpenFeature client binding.
- `jsonVariation` calls flagged for careful parity review.

## Example Output

Generated from `examples/enterprise-checkout-service/src`:

```text
✓ Audit complete: 13 flags — 3 high risk, 10 medium risk
```

## Markdown Report Excerpt

```text
# FlagLint Audit Report

| Total Flags | High Risk | Medium Risk | Total Usages |
|-------------|-----------|-------------|--------------|
| 13          | 3         | 10          | 19           |

## Flag Debt Inventory

| Flag Key              | Risk      | Usages | Reasons                            |
|-----------------------|-----------|--------|------------------------------------|
| `<dynamic key>`       | 🔴 High   | 7      | key cannot be resolved statically  |
| `checkout-experiment` | 🔴 High   | 1      | detail evaluation                  |
| `*`                   | 🔴 High   | 1      | bulk call                          |
| `checkout-v2`         | 🟡 Medium | 1      | safely automatable                 |
| `payment-provider`    | 🟡 Medium | 1      | safely automatable                 |
| `discount-config`     | 🟡 Medium | 1      | safely automatable, json variation |
```

## HTML Report

The `--format html` option generates a self-contained HTML file with no external
dependencies. It includes a summary card row and a sortable flag debt table.
The file can be opened in any browser, attached to a PR, or shared with your team.

```bash
npx flaglint audit ./src --format html --output flag-debt.html
```

## Exit Behavior

`flaglint audit` always exits `0`. The audit command is informational — it reports
flag debt but does not fail the build. Use `flaglint validate --no-direct-launchdarkly`
to enforce a CI gate.

## Workflow

Use `flaglint audit` as the first step before a migration:

```bash
# Step 1: Understand your flag debt
npx flaglint audit ./src --format html --output flag-debt.html

# Step 2: Inspect detailed inventory if needed
npx flaglint scan ./src --format json --output flag-inventory.json

# Step 3: Preview safe migrations
npx flaglint migrate ./src --dry-run

# Step 4: Apply safe rewrites on a branch
npx flaglint migrate ./src --apply

# Step 5: Enforce the boundary in CI
npx flaglint validate ./src --no-direct-launchdarkly
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/audit.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Configuration](/docs/cli/configuration/)
