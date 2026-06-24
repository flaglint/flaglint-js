---
title: "Enforcing Your LaunchDarkly to OpenFeature Migration in GitHub Actions"
description: "Block new LaunchDarkly SDK calls in CI with FlagLint's validate command. Enforce your LaunchDarkly to OpenFeature migration in GitHub Actions in minutes."
date: 2026-06-24
authors:
  - name: Krishan Sharma
    title: Founder and maintainer of FlagLint
    url: https://www.linkedin.com/in/krishansha/
tags: ["launchdarkly", "openfeature", "github-actions", "ci", "migration"]
---

You started your LaunchDarkly to OpenFeature migration three weeks ago. The first sprint went well—five files converted, OpenFeature provider wired in, existing tests green. Then a teammate opened a PR for a new service. Inside it: two fresh `ldClient.boolVariation()` calls. Not malicious. They just forgot. You merge it anyway because it is not worth blocking the PR over. Two weeks later there are six more.

This is migration drift. It is the most common reason LaunchDarkly to OpenFeature migration projects stall: there is no gate on new direct LaunchDarkly SDK calls landing in main. Without a CI check that fails on any new call site, every PR can quietly add to the flag debt you are actively paying down.

FlagLint addresses this with two commands—`audit` to measure the existing flag debt and `validate` to enforce the boundary—and a one-step GitHub Actions integration that adds the gate with two lines of YAML.

<!-- Image 1 (intro): "a close up of a computer screen with many lines of code on it" by Timothy Cuenat
     Source: https://unsplash.com/photos/a-close-up-of-a-computer-screen-with-many-lines-of-code-on-it-NH0pmKaZeuk
     Alt: Close-up of a monitor displaying dense multi-colored lines of syntax-highlighted source code
     Placement: below opening paragraph -->

## Step 1: Baseline your flag debt before you gate

Before you block anything in CI, run `flaglint audit` against your source directory. This produces a readiness score and a per-flag-key inventory—the snapshot you will measure progress against, and the list you need when deciding what to exclude during the transition period.

```bash
npx flaglint audit ./src
```

Real output from the `src/` directory of the enterprise checkout service shipped with FlagLint examples:

```
- Auditing examples/enterprise-checkout-service/src/...
# FlagLint Audit Report

**Scanned at:** 2026-06-24T03:20:27.050Z
**Scan root:** /home/user/flaglint/examples/enterprise-checkout-service/src
**Files scanned:** 5
**Duration:** 63ms

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

## Flag Debt Inventory

| Flag Key | Risk | Usages | Files | Call Types | Reasons |
|----------|------|--------|-------|------------|---------|
| `<dynamic key>` | 🔴 High | 7 | 3 | variationDetail, boolVariation, stringVariation, numberVariation, jsonVariation | dynamic key |
| `checkout-experiment` | 🔴 High | 1 | 1 | boolVariationDetail | detail evaluation |
| `*` | 🔴 High | 1 | 1 | allFlagsState | bulk call |
| `checkout-v2` | 🟢 Automatable | 1 | 1 | boolVariation | safely automatable |
| `payment-provider` | 🟢 Automatable | 1 | 1 | stringVariation | safely automatable |
| `one-click-checkout` | 🟢 Automatable | 1 | 1 | boolVariation | safely automatable |
| `checkout-currency` | 🟢 Automatable | 1 | 1 | stringVariation | safely automatable |
| `discount-percentage` | 🟢 Automatable | 1 | 1 | numberVariation | safely automatable |
| `max-discount-amount` | 🟢 Automatable | 1 | 1 | numberVariation | safely automatable |
| `discount-config` | 🟡 Medium | 1 | 1 | jsonVariation | safely automatable, json variation |
| `pricing-tier-config` | 🟡 Medium | 1 | 1 | jsonVariation | safely automatable, json variation |
| `recommendations-variant` | 🟢 Automatable | 1 | 1 | stringVariation | safely automatable |
| `bulk-discount-enabled` | 🟢 Automatable | 1 | 1 | boolVariation | safely automatable |

✓ Audit complete: 13 flags — 3 high risk, 10 medium risk

Migration readiness: 53/100  ·  moderate
[█████████████░░░░░░░░░░░░] 53%
10 safely automatable  ·  9 require manual review
```

The readiness score of 53 means 10 of the 19 direct LaunchDarkly SDK call sites can be automatically rewritten by `flaglint migrate --apply`. The remaining 9 require manual work: 7 use a dynamic flag key (a variable, not a string literal), 1 is a detail evaluation returning reason metadata, and 1 is a bulk `allFlagsState` call with no single-flag OpenFeature equivalent. The staleness signal count of zero means no flag keys carry source-level stale signal—no keys contain `old`, `deprecated`, `legacy`, or `tmp`.

Save this output as your progress baseline.

## Step 2: Run the validate command locally

`flaglint validate --no-direct-launchdarkly` exits non-zero when any direct LaunchDarkly SDK call is found in the scanned directory. Before wiring it into CI, run it locally so you know exactly what the gate will report:

```bash
npx flaglint validate ./src --no-direct-launchdarkly
```

Real output from the same `src/` directory:

```
- Scanning examples/enterprise-checkout-service/src/...
✗ validate --no-direct-launchdarkly: 19 direct LaunchDarkly evaluation call(s) found.

  analytics.ts:51:43 — variationDetail("(dynamic key)")
  analytics.ts:76:23 — boolVariationDetail("checkout-experiment")
  analytics.ts:104:22 — allFlagsState(bulk inventory)
  checkout.ts:40:9 — boolVariation("checkout-v2")
  checkout.ts:49:9 — stringVariation("payment-provider")
  checkout.ts:58:9 — boolVariation("one-click-checkout")
  checkout.ts:67:9 — stringVariation("checkout-currency")
  flags-wrapper.ts:48:9 — boolVariation("(dynamic key)")
  flags-wrapper.ts:67:11 — boolVariation("(dynamic key)")
  flags-wrapper.ts:70:11 — stringVariation("(dynamic key)")
  flags-wrapper.ts:73:11 — numberVariation("(dynamic key)")
  flags-wrapper.ts:75:9 — jsonVariation("(dynamic key)")
  pricing.ts:46:9 — numberVariation("discount-percentage")
  pricing.ts:55:9 — numberVariation("max-discount-amount")
  pricing.ts:69:9 — jsonVariation("discount-config")
  pricing.ts:83:9 — jsonVariation("pricing-tier-config")
  product.ts:52:9 — boolVariation("(dynamic key)")
  product.ts:61:9 — stringVariation("recommendations-variant")
  product.ts:70:9 — boolVariation("bulk-discount-enabled")

These files must migrate to OpenFeature before this rule passes.
Run `flaglint migrate --dry-run` to review the migration plan.
```

Each finding shows file path, line number, column, call type, and flag key. All call types are tracked: `boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`, `variationDetail`, `boolVariationDetail`, and `allFlagsState`. Dynamic flag keys appear as `(dynamic key)`.

The gate exits non-zero the moment any direct LaunchDarkly SDK call is detected, blocking any new flag from bypassing the OpenFeature provider. When validate finds zero violations, it exits cleanly:

```
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
```

That line is what you are working toward.

<!-- Image 2 (middle): "screens display coding text, representing programming work" by Jakub Żerdzicki
     Source: https://unsplash.com/photos/screens-display-coding-text-representing-programming-work-gCyjEr-g2oI
     Alt: Multiple screens displaying coding text representing active software development work
     Placement: between Step 2 and Step 3 -->

## Step 3: Add the GitHub Actions gate

FlagLint ships a composite GitHub Actions action. The minimum setup is two lines:

```yaml
name: FlagLint

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: flaglint/flaglint@main
        with:
          directory: ./src
```

The action runs `flaglint validate ./src --no-direct-launchdarkly` and exits 1 when any direct call is found. Do not set `continue-on-error: true` on the FlagLint step. The job failing is the mechanism—that is what blocks the PR.

### Excluding the bootstrap file

Your OpenFeature provider setup module legitimately imports from the LaunchDarkly SDK to instantiate the provider. Exclude it with `--bootstrap-exclude` so the gate does not fire on it:

```yaml
- uses: flaglint/flaglint@main
  with:
    directory: ./src
    extra-args: '--bootstrap-exclude "src/provider/setup.ts"'
```

You can pass multiple exclusion patterns:

```yaml
extra-args: >-
  --bootstrap-exclude "src/provider/setup.ts"
  --bootstrap-exclude "src/bootstrap/**"
```

The excluded files can call the LaunchDarkly SDK directly. Everything else cannot. The `--bootstrap-exclude` flag accepts glob patterns, so a single `"src/provider/**"` covers a provider directory with multiple files.

## Step 4: Add SARIF annotations for inline PR diff visibility

Job-level failure tells engineers something is wrong. SARIF annotations tell them exactly which line is wrong, directly in the PR diff. Add the SARIF upload step alongside the gate:

```yaml
name: FlagLint Policy

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Validate no direct LaunchDarkly calls
        id: flaglint
        uses: flaglint/flaglint@main
        with:
          directory: ./src
          extra-args: >-
            --bootstrap-exclude "src/provider/setup.ts"
            --format sarif
            --output flaglint-validation.sarif

      - name: Upload validation SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint-validation.sarif
```

SARIF findings use rule id `flaglint.direct-launchdarkly`. With `security-events: write`, GitHub annotates each violation inline on the relevant PR diff line as a code scanning alert. Set `if: always()` on the upload step—not on the validate step—so GitHub receives the SARIF file even after the job fails, and annotations appear regardless of whether the PR passes.

<!-- Image 3 (end): "a coder's workspace, filled with code and keyboards" by Jakub Żerdzicki
     Source: https://unsplash.com/photos/a-coders-workspace-filled-with-code-and-keyboards-FjtWczJWRlc
     Alt: A developer's multi-monitor workstation showing source code with a glowing keyboard in a dark room
     Placement: between Step 4 and the transition period section -->

## Managing the transition period

If your service already has 19 direct LaunchDarkly SDK calls when you add the gate, CI will immediately fail. Two approaches handle the transition:

**Start with SARIF-only, then harden.** Set `continue-on-error: true` temporarily on the validate step so violations surface as code scanning alerts without blocking merges. Remove `continue-on-error` once you have migrated the bulk of existing call sites.

**Exclude directories that are mid-migration.** Use `--bootstrap-exclude` patterns to allow files already in the migration queue through the gate while blocking any new file from adding a direct LaunchDarkly SDK call. Remove each exclusion as you migrate that directory.

Re-run the audit after each sprint to track how the readiness score moves. The goal is a validate run that exits cleanly:

```
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
```

When that is the consistent CI result, the LaunchDarkly to OpenFeature migration is structurally complete. No new direct call sites can land, and the codebase no longer carries flag debt pointing at the LaunchDarkly SDK.

## Next steps

- [LaunchDarkly to OpenFeature Node.js migration guide](/docs/guides/launchdarkly-to-openfeature-nodejs/) — the full end-to-end workflow: audit, provider setup, dry-run, apply, validate
- [Manual Review Patterns](/docs/guides/manual-review-patterns/) — how to resolve dynamic flag keys, detail evaluations, and bulk calls before `migrate --apply` can handle them automatically
- [`flaglint audit` CLI reference](/docs/cli/audit/) — all options, output formats (JSON, Markdown, HTML), and exit behavior
- [Migration Readiness concept](/docs/concepts/migration-readiness/) — how the readiness score is calculated and what the grade thresholds mean
- [GitHub Actions integration reference](/docs/integrations/github-actions/) — full option table for the composite action, SARIF configuration, and rule id reference
