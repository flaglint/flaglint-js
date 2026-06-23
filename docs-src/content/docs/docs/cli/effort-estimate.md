---
title: Effort Estimation (--effort-estimate)
description: Add a directional migration-effort estimate to flaglint audit output.
lastUpdated: 2026-06-07
---

`--effort-estimate` adds a directional planning estimate to `flaglint audit` output.
It is a planning guide — not a savings calculation, ROI projection, billing analysis,
or LaunchDarkly contract effort estimate.

## Usage

```bash
npx flaglint audit ./src --effort-estimate
```

```bash
npx flaglint audit ./src --effort-estimate --hourly-rate 125
```

## Example Output

```text
✓ Audit complete: 13 flags — 3 high risk, 10 medium risk

Migration readiness: 50/100  ·  moderate
[█████████████░░░░░░░░░░░░] 50%
10 safely automatable  ·  10 require manual review

Estimated migration effort: 22.8h – 43.9h
Estimates are directional. See the report for assumptions.
```

## Algorithm

The estimate is derived from the number of automatable and manual-review call sites
detected in the scanned directory.

**Phase: automation**

```
automationLow  = automatableCalls × 0.25
automationHigh = automationLow × 1.5
```

**Phase: manual review**

```
manualLow  = manualReviewCalls × 1.5
manualHigh = manualLow × 2
```

**Phase: validation**

```
validationLow  = (automationLow + manualLow) × 0.3
validationHigh = (automationHigh + manualHigh) × 0.3
```

**Totals**

Totals are computed from unrounded phase values, then rounded to one decimal place,
then floored to a minimum of 4 hours for very small codebases:

```
totalLow  = max(4, round1(automationLow + manualLow + validationLow))
totalHigh = max(4, round1(automationHigh + manualHigh + validationHigh))
```

**Default assumptions**

| Parameter | Default | Meaning |
|---|---|---|
| `automationHoursPerCall` | 0.25 | Hours per automatable call site |
| `manualReviewHoursPerCall` | 1.5 | Hours per manual-review call site |
| `validationMultiplier` | 0.3 | Validation overhead as a fraction of automation + manual total |
| `minimumHours` | 4 | Floor applied to both low and high totals |

These defaults are planning heuristics, not observed industry benchmarks.

## Hourly Rate (--hourly-rate)

Supplying `--hourly-rate <number>` adds `costLow` and `costHigh` fields to the
top-level estimate object in JSON output. These fields are also included in markdown
and HTML report output. `--hourly-rate` is valid only when `--effort-estimate` is
also specified.

```bash
npx flaglint audit ./src --effort-estimate --hourly-rate 125
```

## Not-Applicable Behavior

When no direct LaunchDarkly calls are detected, the estimate is `null` and no estimate
line is printed. This matches the not-applicable readiness score state.

## Disclaimer

> Estimates are directional planning guides based on call-site complexity. Actual effort
> depends on test coverage, team familiarity, and provider setup. FlagLint does not access
> runtime data or LaunchDarkly billing.

## Further Reading

- [`flaglint audit` CLI reference](/docs/cli/audit/) — command options and example output
- [Migration Readiness concept](/docs/concepts/migration-readiness/) — how the readiness score is calculated
