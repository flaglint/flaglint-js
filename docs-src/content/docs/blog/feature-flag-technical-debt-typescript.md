---
title: "Feature Flag Technical Debt in TypeScript: Find, Measure, and Clear It"
description: "Find, measure, and remove feature flag technical debt in TypeScript: FlagLint scans AST call sites, generates safe before/after diffs, and enforces via CI."
date: 2026-06-25
authors:
  - name: Krishan Sharma
    title: Founder and maintainer of FlagLint
    url: https://www.linkedin.com/in/krishansha/
tags: ["launchdarkly", "openfeature", "typescript", "flag-debt", "migration"]
---

TypeScript's type system enforces interface contracts and catches argument-type mismatches at compile time — but it cannot see which of your modules still depend on the LaunchDarkly SDK, which of those call sites can be automatically rewritten, or how many engineer-hours the migration backlog represents.

Feature flag technical debt in TypeScript codebases compounds quietly. A team ships a boolean flag behind `ldClient.boolVariation`, the rollout succeeds, and the code moves on. Six months later the flag is still evaluated on every request. The surrounding code has grown around it. The LaunchDarkly SDK is a locked-in transitive dependency for the entire module that contains it. And no one has a reliable count of how many of these exist, because the only tool most teams reach for is a `grep` that conflates static flag keys, wrapper functions, and bulk calls into one undifferentiated list.

[FlagLint](https://flaglint.dev) is a free open-source CLI that parses TypeScript source files using an AST scanner to enumerate every LaunchDarkly SDK call site, classify each one by call type and risk, compute a readiness score, and output a migration plan to OpenFeature. No LaunchDarkly API key required.

<!-- Image 1 (intro): "A close up of a laptop computer with code on the screen" by Behnam Norouzi
     Source: https://unsplash.com/photos/a-close-up-of-a-laptop-computer-with-code-on-the-screen-lYFERR5dTG4
     Alt: Close-up of a laptop screen showing multi-colored programming code in a dark environment -->

## Why grep misses TypeScript feature flag technical debt

Running `grep -r "ldClient" ./src` gives you a count. It does not give you a classification. Every result looks equivalent in grep output, but three structurally different situations hide behind the same pattern:

1. **Static flag key, direct call** — the flag key is a string literal; the call type is `boolVariation`, `stringVariation`, or `numberVariation`; the return type is known. FlagLint can generate a safe rewrite for this automatically.
2. **Wrapper function with a dynamic key** — the function accepts a `flagKey` parameter and calls the LaunchDarkly SDK internally. FlagLint cannot statically determine which flag is being evaluated, verify the call type, or confirm the return type. This is a high-risk call type.
3. **Detail evaluation or bulk call** — `boolVariationDetail` and `allFlagsState` have no direct OpenFeature provider equivalent and cannot be safely transformed by a static rewriter.

All three groups require completely different migration approaches — but grep cannot distinguish them.

Run `flaglint scan` against your source directory to get the AST-based inventory:

```bash
npx flaglint scan ./src
```

Real output from the enterprise checkout service included with FlagLint (5 source files):

```
- Scanning examples/enterprise-checkout-service/src/...
✓ 19 flag usages found across 11 unique flags (65ms)
ℹ  1 dynamic flag key(s) require manual review
# FlagLint Scan Report

**Scanned:** 5 files in 65ms
**Flag usages:** 19 across 11 unique flags
**Stale candidates:** 0 flags flagged for review

## Flag Inventory
| Flag Key              | Usages | Files | Call Types                                                 | Status   |
|-----------------------|--------|-------|------------------------------------------------------------|----------|
| (dynamic key)         | 7      | 3     | variationDetail, boolVariation, stringVariation, ...       | ✓ Active |
| checkout-experiment   | 1      | 1     | boolVariationDetail                                        | ✓ Active |
| (dynamic key)         | 1      | 1     | allFlagsState                                              | ✓ Active |
| checkout-v2           | 1      | 1     | boolVariation                                              | ✓ Active |
| payment-provider      | 1      | 1     | stringVariation                                            | ✓ Active |
| one-click-checkout    | 1      | 1     | boolVariation                                              | ✓ Active |
| checkout-currency     | 1      | 1     | stringVariation                                            | ✓ Active |
| discount-percentage   | 1      | 1     | numberVariation                                            | ✓ Active |
| max-discount-amount   | 1      | 1     | numberVariation                                            | ✓ Active |
| discount-config       | 1      | 1     | jsonVariation                                              | ✓ Active |
| pricing-tier-config   | 1      | 1     | jsonVariation                                              | ✓ Active |
| recommendations-variant | 1    | 1     | stringVariation                                            | ✓ Active |
| bulk-discount-enabled | 1      | 1     | boolVariation                                              | ✓ Active |
```

Seven of the nineteen usages resolve to a dynamic flag key. All seven originate from `flags-wrapper.ts`, which accepts `flagKey` as a parameter and proxies calls to the LaunchDarkly SDK. Grep would list those seven as equivalent entries alongside the statically-keyed calls in `checkout.ts` and `pricing.ts`. The AST scanner surfaces the wrapper boundary.

## Measuring the flag debt

`flaglint scan` gives you the inventory. `flaglint audit` adds risk classification, a readiness score, and an optional effort estimate in engineer-hours:

```bash
npx flaglint audit examples/enterprise-checkout-service/
```

Real output:

```
- Auditing examples/enterprise-checkout-service/...
# FlagLint Audit Report

**Files scanned:** 16
**Duration:** 97ms

## Summary

| Total Flags | High Risk | Medium Risk | Total Usages |
|-------------|-----------|-------------|--------------|
| 13          | 3         | 10          | 27           |

| Dynamic Keys | Detail Evals | Bulk Calls | Stale Signals | Safely Automatable | Manual Review |
|--------------|--------------|------------|---------------|--------------------|---------------|
| 7            | 1            | 1          | 0             | 18                 | 9             |

> **Staleness:** No staleness signals detected. Heuristics checked: keyword match
> (flag key contains old/deprecated/legacy/temp/tmp/test/demo), path pattern
> (test/spec/mock files, deprecated/old/legacy directories), and minFileCount threshold.
> Git-history-based staleness (last evaluation date) requires git metadata and is not
> available in a pure static scan.

## Migration Readiness

Migration readiness: **67/100** · moderate

[█████████████████░░░░░░░░] 67%

18 safely automatable  ·  9 require manual review
```

The readiness score is the fraction of direct LaunchDarkly SDK call sites that FlagLint can rewrite automatically. A score of 67 means 18 of the 27 call sites are safely transformable. The remaining 9 require a human to resolve before an automated pass can run on those files.

The staleness signal column surfaces flag keys whose names carry heuristic staleness signal — keywords like `old`, `deprecated`, `legacy`, or `tmp` in the flag key itself. Zero here means no staleness signal at the source level. Staleness detection does not require a LaunchDarkly API key or runtime data.

Add `--effort-estimate` to convert the count into a planning number:

```bash
npx flaglint audit ./src --effort-estimate
```

This appends a three-phase estimate: automatable call sites at approximately 0.25 engineer-hours each, manual review call sites at 1.5–3 hours each, plus 30% overhead for validation and testing. Supplying `--hourly-rate 150` appends a dollar range to the summary. The estimate is a planning heuristic calibrated to call-site complexity, not a billing projection.

<!-- Image 2 (middle): "Code displayed on computer screens" by Jakub Żerdzicki
     Source: https://unsplash.com/photos/code-displayed-on-computer-screens-v-jFS1AsHXo
     Alt: Multiple monitors displaying syntax-highlighted source code in a dark office environment -->

## The three risk tiers in the flag debt inventory

Every flag key in the audit report lands in one of three tiers:

**High risk — cannot be automated:**

`<dynamic key>` (7 usages across 3 files) — the flag key is a runtime variable, not a string literal. FlagLint marks every dynamic flag key as high risk because it cannot statically determine which flag is being evaluated, verify the call type, or confirm the return type. The resolution is to trace back to the call sites that supply the key parameter, then extract each unique flag key to a named constant. Re-running `flaglint audit` after that change will reclassify the previously-dynamic entries as automatable.

`checkout-experiment` (1 usage) — `boolVariationDetail` is a detail evaluation call type. OpenFeature has a `getBooleanDetails` equivalent, but the reason vocabulary differs: the LaunchDarkly SDK returns `TARGETING_MATCH` and `RULE_MATCH`; OpenFeature uses its own reason strings. Code that inspects `reason.kind` or `reason.ruleId` must be updated by hand alongside the call site.

`*` (1 usage) — `allFlagsState` is a bulk call with no OpenFeature provider equivalent. The resolution is to enumerate the specific flag keys the bulk call feeds and replace them with individual named-key calls. If full flag state at application startup is genuinely required, retain the LaunchDarkly SDK client for that bootstrap path while migrating all other call sites.

**Medium risk — automatable with review:**

`discount-config` and `pricing-tier-config` are `jsonVariation` call types. They are safely automatable, but OpenFeature's object value API returns `unknown`. After the rewrite, confirm that any code that casts or destructures the return value still compiles and behaves correctly.

**Automatable — safe to transform:**

Eight flag keys — `checkout-v2`, `payment-provider`, `one-click-checkout`, `checkout-currency`, `discount-percentage`, `max-discount-amount`, `recommendations-variant`, and `bulk-discount-enabled` — are called with `boolVariation`, `stringVariation`, or `numberVariation` using static string literal flag keys. FlagLint can rewrite all of these.

## The argument order inversion

The automatable rewrite is not a text substitution. The LaunchDarkly SDK and OpenFeature provider place the fallback value and evaluation context in different argument positions:

```typescript
// LaunchDarkly SDK — (flagKey, context, fallback)
const enabled = await ldClient.boolVariation("checkout-v2", ctx, false);

// OpenFeature provider — (flagKey, fallback, context)
const enabled = await openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

The flag key is identical. The fallback value and evaluation context swap positions. A naive find-and-replace migration that does not track argument order evaluates every flag with the wrong context on the first request and returns the wrong result silently. FlagLint's AST rewriter moves all three arguments to the correct positions for each automatable call type.

Preview every transformation before any file is touched:

```bash
npx flaglint migrate --dry-run ./src
```

The dry-run output shows a reviewable diff for each automatable call site alongside the OpenFeature provider setup steps. No files are modified.

## Applying the migration plan and enforcing the boundary

Once you have reviewed the dry-run output and set up the OpenFeature provider:

```bash
npx flaglint migrate --apply ./src
```

This applies all safe rewrites in-place. Run your test suite after the apply. Then lock the boundary in CI:

```bash
npx flaglint validate --no-direct-launchdarkly ./src
```

`flaglint validate` exits non-zero when any direct LaunchDarkly SDK call is detected. Add it to your GitHub Actions workflow and direct LaunchDarkly SDK calls become a build failure from that point forward, blocking regressions as the migration lands across multiple PRs.

<!-- Image 3 (end): "Coding code on multiple computer screens" — Unsplash
     Source: https://unsplash.com/photos/coding-code-on-multiple-computer-screens-O3ChbcT94NM
     Alt: Multiple computer monitors displaying programming code in a developer workspace -->

## Clearing the manual review backlog incrementally

Work through the high-risk items in batches. After each batch, re-run `flaglint audit` to watch the readiness score climb. At 80 or above, the remaining feature flag technical debt in TypeScript can be handled in a single automated pass — `flaglint migrate --apply` clears it and `flaglint validate --no-direct-launchdarkly` confirms the boundary is clean.

The audit plus the CI gate is a closed loop: audit measures what exists, migrate rewrites what is safe, validate blocks regressions, audit confirms progress. You can run the full cycle on a large codebase before writing a single line of migration code. The readiness score tells you up front whether you are looking at a two-sprint effort or a six-month program, and the migration plan tells you exactly which call sites require which kind of attention.

## Next steps

- [LaunchDarkly to OpenFeature Node.js migration guide](/docs/guides/launchdarkly-to-openfeature-nodejs/) — the six-step workflow: audit, provider setup, dry-run, apply, validate
- [Manual review patterns](/docs/guides/manual-review-patterns/) — resolving dynamic flag keys, detail evaluations, and bulk calls before running migrate
- [`flaglint audit` CLI reference](/docs/cli/audit/) — all options, output formats (JSON, Markdown, HTML), and exit codes
- [Migration readiness concept](/docs/concepts/migration-readiness/) — grade thresholds and the formula behind the readiness score
- [Enforce in GitHub Actions](/docs/tutorials/enforce-in-github-actions/) — CI workflow to block direct LaunchDarkly SDK regressions
