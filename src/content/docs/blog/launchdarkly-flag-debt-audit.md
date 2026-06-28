---
title: "How to Audit and Eliminate LaunchDarkly Flag Debt"
description: "LaunchDarkly flag debt builds up silently. FlagLint audits your codebase, gets a readiness score, and shows which calls migrate safely to OpenFeature."
date: 2026-06-28
---

LaunchDarkly flag debt does not announce itself. You add a flag for a rollout, the rollout ships, and the `ldClient.boolVariation` call stays in the codebase because removing it never makes it onto a sprint. Months later you have dozens of call sites, nobody remembers which flags are permanent configuration and which were shipping scaffolding, and the idea of switching away from the LaunchDarkly SDK feels too risky to schedule.

That is LaunchDarkly flag debt — and most Node.js services are carrying more of it than their teams realise.

This guide shows you how to use [FlagLint](https://flaglint.dev), a free open-source TypeScript CLI, to measure that debt in a single command, understand the readiness score, and produce a safe migration plan to OpenFeature without touching a production flag evaluation. If you want the full step-by-step walkthrough once you have your score, start with the [Quickstart](https://flaglint.dev/docs/quickstart).

## What FlagLint Measures

FlagLint performs static analysis on your source code, not your LaunchDarkly dashboard. It finds every call to the LaunchDarkly SDK, classifies each one by call type, and decides which are safely automatable and which require manual review.

The result is a readiness score: a 0–100 number that reflects what fraction of your call sites can be automatically rewritten from the LaunchDarkly SDK to an OpenFeature provider without human involvement. A score below 60 means your LaunchDarkly flag debt is significant — most teams find they need some manual refactoring before automation can cover the rest.

Nothing leaves your machine. No API key. No source upload. FlagLint is entirely local.

## Step 1 — Audit Your Codebase

Run this against your service root:

```bash
npx flaglint@latest audit ./src
```

Here is real output from FlagLint run against its own enterprise checkout example service:

```
- Auditing ./examples/enterprise-checkout-service/src...
# FlagLint Audit Report

**Scanned at:** 2026-06-28T21:03:09.165Z
**Scan root:** /home/user/flaglint/examples/enterprise-checkout-service/src
**Files scanned:** 5
**Duration:** 76ms

## Summary

| Total Flags | High Risk | Medium Risk | Total Usages |
|-------------|-----------|-------------|--------------|
| 13 | 3 | 10 | 19 |

| Dynamic Keys | Detail Evals | Bulk Calls | Stale Signals | Safely Automatable | Manual Review |
|--------------|--------------|------------|---------------|-------------------|---------------|
| 7 | 1 | 1 | 0 | 10 | 9 |

## Migration Readiness

Migration readiness: **53/100** · moderate

[█████████████░░░░░░░░░░░░] 53%

10 safely automatable  ·  9 require manual review
```

Thirteen unique flag keys, 19 call sites, readiness score 53/100. Ten calls can be rewritten automatically; nine cannot — and the report tells you exactly why for each one.

## Reading the Flag Debt Inventory

The audit produces a full flag debt inventory that ranks every flag key by risk:

| Flag Key | Risk | Call Types | Reasons |
|----------|------|------------|---------|
| `<dynamic key>` | High | boolVariation, stringVariation… | dynamic key |
| `checkout-experiment` | High | boolVariationDetail | detail evaluation |
| `*` | High | allFlagsState | bulk call |
| `checkout-v2` | Automatable | boolVariation | safely automatable |
| `payment-provider` | Automatable | stringVariation | safely automatable |
| `discount-config` | Medium | jsonVariation | json variation |

Three patterns drive high risk:

**Dynamic flag keys.** When a flag key is computed at runtime — `ldClient.boolVariation(getFlagKey(user), ctx, false)` — FlagLint cannot prove which flag is being evaluated. These always require manual review regardless of how simple the surrounding code looks.

**Detail evaluations.** Calls like `boolVariationDetail` and `variationDetail` return a full `EvaluationDetail` object with reason and variation index. OpenFeature surfaces the same data through `getBooleanDetails()`, but the shape is different. FlagLint never auto-rewrites these.

**Bulk calls.** `allFlagsState()` and `allFlags()` have no direct OpenFeature equivalent. They require manual migration.

Everything else — a static flag key with an explicit fallback value and a known call type — is a staleness signal FlagLint is prepared to rewrite.

## Step 2 — Preview the Migration Plan

Before touching any file, preview what will change:

```bash
npx flaglint@latest migrate ./src --dry-run
```

Real output:

```
- Scanning ./examples/enterprise-checkout-service/src...
LaunchDarkly usages found: 19
Safely automatable: 10 · Manual review: 9

Reviewable diffs: 10
Diffs requiring provider setup: 10
Skipped usages: 9
```

No files are modified. For each automatable call you get a reviewable before/after diff:

```diff
--- a/src/checkout.ts
+++ b/src/checkout.ts
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);

-  return ldClient.stringVariation("payment-provider", ctx, "stripe");
+  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);

-  return ldClient.numberVariation("discount-percentage", ctx, 0);
+  return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);
```

Notice the argument order. The LaunchDarkly SDK's `boolVariation(flagKey, context, default)` puts the evaluation context before the fallback. OpenFeature's `getBooleanValue(flagKey, default, context)` reverses that order. A naive find-and-replace silently swaps your fallback and your evaluation context, producing code that compiles fine but evaluates flags incorrectly in production. FlagLint's static analysis proves both values are known before rewriting anything.

## One-Time OpenFeature Provider Bootstrap

The dry-run output identifies diffs that require OpenFeature provider setup before you can apply them. This is a one-time step at application startup:

```bash
npm install @openfeature/server-sdk @launchdarkly/openfeature-node-server
```

```typescript
import { OpenFeature } from "@openfeature/server-sdk";
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

await OpenFeature.setProviderAndWait(
  new LaunchDarklyProvider(process.env.LD_SDK_KEY!)
);
export const openFeatureClient = OpenFeature.getClient();
```

LaunchDarkly remains your feature flag backend. The OpenFeature provider wraps it. Your application code starts calling `openFeatureClient.getBooleanValue(...)` instead of `ldClient.boolVariation(...)`. Do not remove the LaunchDarkly packages — the OpenFeature provider depends on them at runtime. Your targeting rules, segments, and flag configurations are unchanged.

Full provider setup walkthrough: [flaglint.dev/docs/tutorials/add-openfeature-provider](https://flaglint.dev/docs/tutorials/add-openfeature-provider).

## Step 3 — Apply the Rewrite

```bash
npx flaglint@latest migrate ./src --apply
```

FlagLint rewrites only the calls it proved safe during the dry-run step. The nine manual-review calls in the checkout example — dynamic keys, the `boolVariationDetail` call, the `allFlagsState` call — are left untouched for you to handle.

## Step 4 — Enforce the Boundary in CI

Once migrated, add a CI gate that exits non-zero if a direct LaunchDarkly SDK evaluation call ever re-enters the codebase:

```bash
npx flaglint@latest validate ./src --no-direct-launchdarkly
```

Real output after migration completes:

```
- Scanning ./examples/enterprise-checkout-service/after-complete...
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

Exit 0 if clean. Exit 1 if violations are found. Add this to your pipeline once and the OpenFeature boundary is permanently enforced.

## What FlagLint Leaves for You

FlagLint intentionally never auto-rewrites:

- **Dynamic flag keys** — the flag key is computed at runtime
- **Detail evaluations** — `boolVariationDetail`, `variationDetail`, `jsonVariationDetail`
- **Bulk calls** — `allFlagsState()`, `allFlags()`
- **Unknown fallback types** — the static type cannot be inferred
- **Wrapper patterns** — `ldClient` is passed through a custom abstraction
- **Non-server-side SDKs** — browser, React, and mobile SDKs are out of scope

The calls most likely to represent accumulated flag debt are often the same ones that have grown complex over time. See the [safety model](https://flaglint.dev/docs/concepts/safety-model/) for the full rationale on what is and is not safe to automate.

## Improving a Low Readiness Score

A score of 53/100 means 47% of call sites need human judgment before automation. This is a to-do list, not a blocker.

Teams typically move the score in three passes:

**Refactor wrapper patterns.** If `ldClient` is passed through a helper function, pull the evaluation calls to the call sites and let FlagLint classify them individually. Most wrappers exist to abstract the LaunchDarkly SDK — unrolling them is usually straightforward.

**Enumerate dynamic flag keys.** Dynamic flag keys usually mean a flag key is built from config or user input. Enumerate the possible values and replace them with explicit call sites, or document them as intentionally dynamic so reviewers can track them.

**Migrate detail evaluations by hand.** OpenFeature surfaces evaluation reasons through `getBooleanDetails()` and similar methods. The shape differs from LaunchDarkly's `EvaluationDetail`, but the data is equivalent. Migrate these one at a time and verify the reason values your code relies on are preserved.

Re-run `flaglint audit` after each pass. Teams commonly go from 50/100 to 80/100 before running `--apply`, at which point the automated rewrite handles the bulk of the remaining call sites.

## Next Steps

LaunchDarkly flag debt tends to accumulate faster than it is cleared. A single `flaglint audit` command gives you a concrete readiness score, a ranked flag debt inventory, and a clear split between what can be automated today and what needs review first.

The complete migration walkthrough — provider setup, evaluation context mapping, and wrapper pattern strategies — is at [flaglint.dev/docs/guides/launchdarkly-to-openfeature-nodejs](https://flaglint.dev/docs/guides/launchdarkly-to-openfeature-nodejs/). Run the audit, share the report with your team, and you will have a concrete migration plan within 90 seconds.
