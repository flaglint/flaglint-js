---
title: Migration Readiness
description: How FlagLint scores migration readiness using a ratio of safely automatable calls to total detected LaunchDarkly calls.
lastUpdated: 2026-06-07
---

Migration readiness is a 0–100 score that answers one question: what fraction of your
detected direct LaunchDarkly calls can FlagLint safely automate?

## Formula

```
safely automatable calls ÷ total detected direct LaunchDarkly calls × 100
```

A call is counted as **safely automatable** when FlagLint can statically prove that the
flag key is a string literal, the fallback value and type are known, the LaunchDarkly source
client is traceable to a supported SDK import, and a configured OpenFeature destination
binding is present. Every other call — dynamic keys, detail evaluations, bulk calls,
ambiguous clients, unknown fallbacks — is counted as **requiring manual review** and is
excluded from the automatable numerator.

## Grade Thresholds

| Score | Grade | Meaning |
|---|---|---|
| ≥ 80 | ready | Most calls are safe to automate. Migration can proceed with minimal manual effort. |
| 50–79 | moderate | A significant portion of calls require manual review. Plan time for manual migration work. |
| < 50 | complex | More than half of calls require manual review. Prioritize resolving manual-review signals before migrating. |
| — | not-applicable | No direct LaunchDarkly calls detected. Score is `null` and no readiness bar is displayed. |

## Manual-Review Breakdown

The following categories explain why a call is counted as requiring manual review.
This breakdown is informational — it helps you understand where effort will be needed,
but it does not numerically alter the score beyond those calls being counted as non-automatable.

| Manual-review reason | Why review is required | Recommended next step |
|---|---|---|
| Dynamic flag key | Flag key determined at runtime — cannot be statically rewritten | Extract key to a named constant |
| Detail evaluation | `boolVariationDetail`/`variationDetail` — returns metadata with no direct OpenFeature equivalent | Migrate manually or check OpenFeature provider metadata support |
| Bulk evaluation | `allFlagsState` — no single-flag codemod exists | Requires architecture decision; migrate flag by flag |
| Unknown fallback value | Fallback type cannot be inferred statically | Add an explicit typed fallback literal |
| Ambiguous client binding | Call site cannot be proven to use a supported LD client | Ensure client provenance is traceable from a supported SDK import |

## Not-Applicable Behavior

When no direct LaunchDarkly calls are detected, the readiness score is `null` and the
grade is `not-applicable`. This happens when:

- The scanned directory contains no LaunchDarkly SDK imports.
- All detected calls are from unsupported SDKs (browser, React, non-Node).
- The directory is empty or contains only test files excluded via `--exclude-tests`.

No readiness bar or score line is printed to the terminal in this case.

## Further Reading

- [`flaglint audit` CLI reference](/docs/cli/audit/) — command options and example output
- [Cost Estimation (--cost-estimate)](/docs/cli/cost-estimate/) — directional effort planning
