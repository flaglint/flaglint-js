---
title: flaglint audit
description: Generate a local flag debt audit report with risk scoring. No API key required.
lastUpdated: 2026-06-07
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
| `--cost-estimate` | Add a directional migration-effort estimate to audit output. |
| `--hourly-rate <number>` | Add an optional engineering-cost range using a user-supplied hourly rate. Valid only with `--cost-estimate`. |

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
✓ Audit complete: 13 unique flags across 19 call sites — 3 high risk, 10 medium risk

Migration readiness: 53/100  ·  moderate
[█████████████░░░░░░░░░░░░] 53%
10 of 19 call sites safely automatable  ·  9 require manual review
```

## Migration Readiness

The migration readiness score is a ratio of safely automatable calls to total detected direct
LaunchDarkly calls, expressed as a percentage from 0–100. See the
[Migration Readiness concept page](/docs/concepts/migration-readiness/) for grade thresholds
and a full breakdown of manual-review categories.

## Cost Estimate (--cost-estimate)

Add `--cost-estimate` to include a directional planning estimate in the audit output:

```bash
npx flaglint audit ./src --cost-estimate
```

```text
✓ Audit complete: 13 unique flags across 19 call sites — 3 high risk, 10 medium risk

Migration readiness: 53/100  ·  moderate
[█████████████░░░░░░░░░░░░] 53%
10 of 19 call sites safely automatable  ·  9 require manual review

Estimated migration effort: 20.8h – 40h
Estimates are directional. See the report for assumptions.
```

See the [Cost Estimation reference page](/docs/cli/cost-estimate/) for the full algorithm,
configurable defaults, and disclaimer.

## Markdown Report Excerpt

```text
# FlagLint Audit Report

| Total Flags | High Risk | Medium Risk | Total Usages |
|-------------|-----------|-------------|--------------|
| 13          | 3         | 10          | 20           |

## Flag Debt Inventory

| Flag Key              | Risk      | Usages | Reasons                            |
|-----------------------|-----------|--------|------------------------------------|
| `<dynamic key>`       | 🔴 High   | 8      | key cannot be resolved statically  |
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

## Further Reading

- [LaunchDarkly-to-OpenFeature Node.js migration guide](/guides/launchdarkly-to-openfeature-nodejs/) — complete safe migration workflow including audit, migrate, and enforce

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/audit.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Configuration](/docs/cli/configuration/)
