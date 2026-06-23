---
title: "LaunchDarkly Flag Debt: Audit, Estimate, and Prioritize Your Migration"
description: "Audit your Node.js codebase for LaunchDarkly flag debt in minutes: get a risk-scored inventory, estimated migration hours, and a shareable HTML report."
date: 2026-06-23
authors:
  - name: Krishan Sharma
    title: Founder and maintainer of FlagLint
    url: https://www.linkedin.com/in/krishansha/
tags: ["launchdarkly", "openfeature", "flag-debt", "migration", "nodejs"]
---

LaunchDarkly flag debt accumulates quietly. A team ships a feature behind a flag, verifies the rollout, and moves on. The flag stays. Six months later it is still being evaluated on every request — carrying the original business logic, an implicit dependency on the LaunchDarkly SDK, and a refactoring cost that compounds with every passing sprint.

At scale, the problem becomes a planning question as much as a technical one. Grepping for `ldClient` gives you a count, but it misses wrappers, misclassifies risk levels, and gives no indication of how long cleanup will actually take. Before you can schedule the work or make the case to your engineering manager, you need a measurement: how many direct LaunchDarkly SDK calls exist, which ones are safe to automate, and how many engineer-hours does this represent?

FlagLint produces that measurement from static source analysis alone. No LaunchDarkly API key required.

<!-- Image 1 (intro): "a computer screen with a bunch of code on it" by Chris Ried
     Source: https://unsplash.com/photos/a-computer-screen-with-a-bunch-of-code-on-it-ieic5Tq8YMk
     Alt: A monitor displaying multi-colored syntax-highlighted source code -->

## Step 1: Get the flag debt inventory

Run `flaglint audit` against your source directory:

```bash
npx flaglint audit ./src
```

Real output from the enterprise checkout service shipped with FlagLint (5 source files, run from `examples/enterprise-checkout-service/`):

```
- Auditing src/...
# FlagLint Audit Report

**Files scanned:** 5
**Duration:** 64ms

## Summary

| Total Flags | High Risk | Medium Risk | Total Usages |
|-------------|-----------|-------------|--------------|
| 13 | 3 | 10 | 20 |

| Dynamic Keys | Detail Evals | Bulk Calls | Stale Signals | Safely Automatable | Manual Review |
|--------------|--------------|------------|---------------|-------------------|---------------|
| 8 | 1 | 1 | 0 | 10 | 10 |

## Migration Readiness

Migration readiness: **50/100** · moderate

[█████████████░░░░░░░░░░░░] 50%

10 safely automatable  ·  10 require manual review
```

The readiness score answers the foundational question before any migration begins: what fraction of your direct LaunchDarkly SDK call sites can a tool rewrite automatically? A score of 50 — *moderate* — means exactly half require a human to review before any automated step runs. A score below 50 is graded *complex*; 80 or above is *ready*, meaning the migration can proceed with minimal manual effort.

The `stale signals` column surfaces flag keys that carry staleness signal — flag keys containing keywords like `old`, `deprecated`, `legacy`, or `tmp`. Zero here means no flag key names carry obvious staleness signal at the source level. Git-based staleness detection, which checks last-evaluation date against git history, is outside the scope of a static scan.

## Step 2: Measure the LaunchDarkly flag debt in engineer-hours

A risk count tells you what you have. It does not tell you what it will cost to fix. Add `--effort-estimate` to get a directional planning number:

```bash
npx flaglint audit ./src --effort-estimate
```

Real output:

```
## Estimated Migration Effort

| | Low | High |
|---|---|---|
| Automatable calls (10 calls) | 2.5h | 3.8h |
| Manual review calls (10 calls) | 15h | 30h |
| Validation & testing | 5.3h | 10.1h |
| **Total** | **22.8h** | **43.9h** |

> Estimates are directional planning guides based on call-site complexity. Actual effort
> depends on test coverage, team familiarity, and provider setup. FlagLint does not access
> runtime data or LaunchDarkly billing.

Migration readiness: 50/100  ·  moderate
[█████████████░░░░░░░░░░░░] 50%
10 safely automatable  ·  10 require manual review

Estimated migration effort: 22.8h – 43.9h
Estimates are directional. See the report for assumptions.
```

The estimate breaks into three phases. **Automation** covers running `flaglint migrate --apply`, reviewing the generated diffs, and merging — roughly 0.25 engineer-hours per automatable call site. **Manual review** is where the range widens: each call site that requires human inspection is estimated at 1.5–3h, because the effort depends on what the surrounding code does with the evaluated value and how complex the flag key resolution is. **Validation** adds 30% of the combined automation and manual total for test runs, CI, and integration checks.

Supplying `--hourly-rate` converts the estimate to an engineering cost range:

```bash
npx flaglint audit ./src --effort-estimate --hourly-rate 150
```

This appends `Estimated cost: $3,420 – $6,585` to the summary output. It is a planning heuristic calibrated to call-site complexity, not a billing projection.

<!-- Image 2 (middle): "shallow focus photography of computer codes" by Shahadat Rahman
     Source: https://unsplash.com/photos/shallow-focus-photography-of-computer-codes-BfrQnKBulYQ
     Alt: Close-up shallow-focus photograph of programming code on a laptop screen -->

## Step 3: Read the flag debt inventory

The audit report includes a per-flag breakdown. This is where you translate the summary numbers into a concrete migration plan:

```
| Flag Key              | Risk           | Usages | Call Types                           | Reasons                     |
|-----------------------|----------------|--------|--------------------------------------|-----------------------------|
| `<dynamic key>`       | 🔴 High        | 8      | boolVariation, stringVariation, ...  | dynamic key, wrapper usage  |
| `checkout-experiment` | 🔴 High        | 1      | boolVariationDetail                  | detail evaluation           |
| `*`                   | 🔴 High        | 1      | allFlagsState                        | bulk call                   |
| `checkout-v2`         | 🟢 Automatable | 1      | boolVariation                        | safely automatable          |
| `payment-provider`    | 🟢 Automatable | 1      | stringVariation                      | safely automatable          |
| `discount-config`     | 🟡 Medium      | 1      | jsonVariation                        | safely automatable, json variation |
```

Three call types drive the high-risk category in this service:

**Dynamic flag key** (8 usages across 3 files) — the flag key is a variable or template literal rather than a string literal. In this service, `flags-wrapper.ts` is the source: it accepts `flagKey` as a parameter and calls the LaunchDarkly SDK internally. FlagLint classifies it as a wrapper and marks every call through it as high risk because it cannot statically determine which flag is being evaluated, verify the call type, or confirm the return type. The resolution is to extract each dynamic key path to a named constant per call site so subsequent `flaglint audit` runs can classify them as automatable.

**Detail evaluation** (1 usage) — `boolVariationDetail` returns an evaluation reason object alongside the flag value. OpenFeature has a `getBooleanDetails` equivalent, but the reason vocabulary differs from the LaunchDarkly SDK (`TARGETING_MATCH` vs `RULE_MATCH`). Code that inspects `reason.kind` or `reason.ruleId` must be updated alongside the call site. FlagLint cannot safely generate that transformation.

**Bulk call** (1 usage) — `allFlagsState` has no OpenFeature provider equivalent. This call type requires an architecture decision before the migration can proceed: enumerate the specific flag keys needed explicitly, or retain the LaunchDarkly SDK client for the bootstrap path while migrating all other call sites to OpenFeature.

The call-site difference between a high-risk and an automatable entry is visible in source:

```ts
// High risk — dynamic flag key, cannot be rewritten automatically
const result = await ldClient.boolVariation(flagKey, ctx, false);

// Automatable — static flag key, safely rewritable
const enabled = await ldClient.boolVariation("checkout-v2", ctx, false);
// becomes:
const enabled = await openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

The only structural difference in the automatable rewrite is argument order: the OpenFeature provider convention places the fallback value at position two and the evaluation context at position three. The flag key is preserved exactly. No flag evaluation logic at LaunchDarkly changes.

## Step 4: Generate a shareable HTML report

For teams that need to share the findings with engineering leads or allocate sprint capacity, `--format html` produces a self-contained file with no external dependencies:

```bash
npx flaglint audit ./src --effort-estimate --format html --output flag-debt.html
```

The file includes the summary card row, the effort estimate table, and the sortable flag debt inventory. It can be attached to a JIRA ticket, linked in a PR description, or opened locally. No LaunchDarkly credentials appear in the output — the report contains only what the static scan detected.

## Step 5: Track progress toward zero flag debt

After migrating a batch of call sites, run `flaglint validate` to confirm the OpenFeature boundary holds:

```bash
npx flaglint validate ./src --no-direct-launchdarkly
```

Real output before migration begins:

```
✗ validate --no-direct-launchdarkly: 20 direct LaunchDarkly evaluation call(s) found.

  analytics.ts:51:43 — variationDetail("(dynamic key)")
  analytics.ts:76:23 — boolVariationDetail("checkout-experiment")
  analytics.ts:104:22 — allFlagsState(bulk inventory)
  checkout.ts:40:9 — boolVariation("checkout-v2")
  checkout.ts:49:9 — stringVariation("payment-provider")
  checkout.ts:58:9 — boolVariation("one-click-checkout")
  checkout.ts:67:9 — stringVariation("checkout-currency")
  ...

These files must migrate to OpenFeature before this rule passes.
Run `flaglint migrate --dry-run` to review the migration plan.
```

Add this command to your CI pipeline. `flaglint validate --no-direct-launchdarkly` exits non-zero when any direct LaunchDarkly SDK call is detected, blocking regressions as the migration lands across multiple PRs. The validate gate is the mechanism that turns a migration plan into a contract.

<!-- Image 3 (end): "black computer keyboard" by Fotis Fotopoulos
     Source: https://unsplash.com/photos/black-computer-keyboard-DuHKoV44prg
     Alt: A black mechanical keyboard with code visible on a monitor in the background -->

As you resolve manual-review call sites — extracting dynamic flag keys to named constants, migrating detail evaluations by hand, replacing bulk calls with enumerated evaluations — re-run the audit to watch the readiness score climb. At 80 or above, `flaglint migrate --apply` can handle the remaining LaunchDarkly flag debt in a single automated pass, and the CI validate gate will confirm the boundary is clean.

## Next steps

- [LaunchDarkly to OpenFeature Node.js migration guide](/guides/launchdarkly-to-openfeature-nodejs/) — six-step end-to-end workflow: audit, provider setup, dry-run, apply, validate
- [Manual Review Patterns](/docs/guides/manual-review-patterns/) — how to resolve dynamic flag keys, detail evaluations, and bulk calls before running migrate
- [`flaglint audit` CLI reference](/docs/cli/audit/) — all options, output formats (JSON, Markdown, HTML), and exit behavior
- [Migration Readiness concept](/docs/concepts/migration-readiness/) — grade thresholds and the formula behind the readiness score
- [Enforce in GitHub Actions](/docs/tutorials/enforce-in-github-actions/) — ready-made CI workflow to block direct LaunchDarkly regressions
