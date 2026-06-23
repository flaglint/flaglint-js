---
title: "LaunchDarkly to OpenFeature Node.js Migration: A Complete Workflow"
description: "Map your flag debt, preview safe rewrites with flaglint, and enforce the OpenFeature boundary in CI. LaunchDarkly to OpenFeature migration in six steps."
lastUpdated: 2026-06-23
---

LaunchDarkly SDK calls are easy to write and hard to undo. After a few years in production, a Node.js service accumulates dozens of direct `ldClient.boolVariation`, `ldClient.stringVariation`, and `ldClient.jsonVariation` calls spread across checkout, pricing, analytics, and product modules. Each one is a coupling point that binds your application to a proprietary vendor SDK.

<!-- Image 1 (intro): "Code displayed on computer screens" by Jakub Żerdzicki
     Source: https://unsplash.com/photos/code-displayed-on-computer-screens-v-jFS1AsHXo
     Alt: A computer screen displaying colorful programming code with syntax highlighting -->

A LaunchDarkly to OpenFeature migration replaces each of those vendor-specific calls with a vendor-neutral OpenFeature provider call. LaunchDarkly can remain as the evaluation backend throughout — only the call-site API changes. The migration is mechanical and auditable, which makes it a good candidate for automation.

This guide uses FlagLint to run a complete LaunchDarkly to OpenFeature migration on a real Node.js checkout service. Every CLI command below produces real, verbatim output.

## The flag debt problem

Flag debt accumulates silently. Teams ship features behind flags, launch them, and move on. Months later the flags are still in the codebase — evaluated on every request, carrying risk in every future refactor.

Before you touch a single call site, you need an inventory that answers three questions:

- How many direct LaunchDarkly SDK call sites exist, and in which files?
- Which call types are safely automatable and which require manual review?
- What is your readiness score — the percentage of call sites a tool can rewrite without human input?

Without that inventory, LaunchDarkly to OpenFeature migration planning is guesswork and execution is fragile. `flaglint audit` produces the inventory from static source alone. No API key required.

## Step 1: Audit your flag debt

```bash
npx flaglint audit ./src
```

Output on the `src/` directory of the enterprise checkout service shipped with FlagLint:

```
- Auditing examples/enterprise-checkout-service/src/...
# FlagLint Audit Report

**Files scanned:** 5
**Duration:** 51ms

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

The readiness score of **50/100** means 50% of detected direct LaunchDarkly SDK calls can be automatically rewritten. The remaining 50% need manual work before or alongside the automated step. A score below 50 is graded *complex* — more than half of call sites require manual review. A score of 80 or above is graded *ready* and the migration can proceed with minimal manual effort.

Zero staleness signals were detected here: no flag keys contain keywords like `old`, `deprecated`, or `legacy`, and no git history analysis was run. Add `--effort-estimate` to append a directional engineering-hours range to the audit output.

## Step 2: Read the flag debt inventory

The audit includes a per-flag breakdown. The key columns are flag key, risk level, number of usages, call type, and the reason each call is classified as it is:

```
| Flag Key              | Risk           | Usages | Call Types          | Reasons                            |
|-----------------------|----------------|--------|---------------------|------------------------------------|
| `<dynamic key>`       | 🔴 High        | 8      | boolVariation, …    | dynamic key, wrapper usage         |
| `checkout-experiment` | 🔴 High        | 1      | boolVariationDetail | detail evaluation                  |
| `*`                   | 🔴 High        | 1      | allFlagsState       | bulk call                          |
| `checkout-v2`         | 🟢 Automatable | 1      | boolVariation       | safely automatable                 |
| `payment-provider`    | 🟢 Automatable | 1      | stringVariation     | safely automatable                 |
| `discount-config`     | 🟡 Medium      | 1      | jsonVariation       | safely automatable, json variation |
```

Three patterns drive the manual-review call sites for this service:

**Dynamic flag key** (8 usages) — `flagKey` is a variable in `flags-wrapper.ts`, which FlagLint also classifies as a wrapper. Because the flag key is not a static string literal, FlagLint cannot determine which flag is being evaluated, verify the return type, or confirm the flag key exists. Extract the key to a named constant per call site to make these automatable. See [Manual Review Patterns](/docs/guides/manual-review-patterns/).

**Detail evaluation** (1 usage) — `boolVariationDetail` returns an evaluation reason object. OpenFeature has a `getBooleanDetails` equivalent, but the reason vocabulary differs from LaunchDarkly's (`RULE_MATCH` vs `TARGETING_MATCH`, for example). Migrate this call manually, updating any code that inspects `reason.kind` or `reason.ruleId`.

**Bulk call** (1 usage) — `allFlagsState` has no OpenFeature equivalent. OpenFeature does not define a bulk evaluation API. This call requires an architecture decision: enumerate the specific flags needed individually, or retain the underlying LaunchDarkly SDK client for the bootstrap-only path while migrating all other call sites.

## Step 3: Add the OpenFeature provider

Install the official LaunchDarkly OpenFeature provider for Node.js:

```bash
npm install @openfeature/server-sdk @launchdarkly/node-server-sdk @launchdarkly/openfeature-node-server
```

Create one bootstrap module — for example, `platform/feature-flags.ts`:

```ts
import { OpenFeature } from "@openfeature/server-sdk";
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

const ldProvider = new LaunchDarklyProvider(process.env.LD_SDK_KEY!);
await OpenFeature.setProviderAndWait(ldProvider);

export const openFeatureClient = OpenFeature.getClient();
```

Then tell FlagLint where to find the shared client by adding a binding entry to `.flaglintrc`:

```json
{
  "openFeatureClientBindings": [
    {
      "importName": "openFeatureClient",
      "modulePatterns": ["**/platform/feature-flags"]
    }
  ]
}
```

LaunchDarkly remains the evaluation backend. The OpenFeature provider sits between the LaunchDarkly SDK and your application code. No flag evaluation changes at this step. See [Add OpenFeature Provider](/docs/tutorials/add-openfeature-provider/) for configuration details.

## Step 4: Preview the migration plan

<!-- Image 2 (middle): "A coder's workspace, filled with code and keyboards" by Jakub Żerdzicki
     Source: https://unsplash.com/photos/a-coders-workspace-filled-with-code-and-keyboards-FjtWczJWRlc
     Alt: A developer's multi-monitor workspace with illuminated keyboard showing programming code -->

Generate the full migration plan with `--dry-run`. No files are modified:

```bash
npx flaglint migrate ./src --config .flaglintrc --dry-run
```

```
LaunchDarkly usages found: 20
Safely automatable: 10 · Manual review: 10
Reviewable diffs: 10
Diffs requiring provider setup: 0
Skipped usages: 10
```

The dry-run output includes a diff per automatable file. For `checkout.ts`, FlagLint produces:

```diff
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);

-  return ldClient.stringVariation("payment-provider", ctx, "stripe");
+  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);

-  return ldClient.boolVariation("one-click-checkout", ctx, false);
+  return openFeatureClient.getBooleanValue("one-click-checkout", false, ctx);

-  return ldClient.stringVariation("checkout-currency", ctx, "USD");
+  return openFeatureClient.getStringValue("checkout-currency", "USD", ctx);
```

The transformation is consistent across every automatable call site: the flag key is preserved exactly, the fallback value moves to position two (the OpenFeature convention), and the evaluation context stays as the third argument. No flag behavior changes. LaunchDarkly SDK evaluation logic is unaffected — only the call-site API changes.

The **Skipped Usages** section of the dry-run output lists every call site that was not rewritten and why. Those are the manual-review items from the flag debt inventory in Step 2.

## Step 5: Apply on a branch

Apply the rewrites on a feature branch:

```bash
git checkout -b feat/openfeature-migration
npx flaglint migrate ./src --config .flaglintrc --apply
```

`migrate --apply` requires a clean git working tree by default. Pass `--allow-dirty` only if you understand the risk of applying to uncommitted changes. Reviewing the dry-run diff before applying is strongly recommended.

## Step 6: Validate and enforce in CI

After the apply step, confirm that no direct LaunchDarkly SDK calls remain in the migrated modules:

```bash
npx flaglint validate ./src --no-direct-launchdarkly
```

Output from the completed migration snapshot in this repository:

```
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

<!-- Image 3 (end): "Colorful software or web code on a computer monitor" by Markus Spiske
     Source: https://unsplash.com/photos/colorful-software-or-web-code-on-a-computer-monitor-Skf7HxARcoc
     Alt: Colorful syntax-highlighted code displayed on a dark computer monitor -->

Add this command to your CI pipeline. `flaglint validate --no-direct-launchdarkly` exits non-zero when any direct LaunchDarkly call is detected, blocking regressions. Automated rewrites and manual migrations can land in separate PRs; the CI gate catches any call site that slips through. See [Enforce in GitHub Actions](/docs/tutorials/enforce-in-github-actions/) for a ready-made workflow file.

## What the auto-rewrite does not touch

`flaglint migrate --apply` only rewrites call sites it can statically prove are safe. It never touches:

- **Dynamic flag keys** — the flag key is a variable or template literal
- **Detail evaluations** — `boolVariationDetail`, `variationDetail`
- **Bulk calls** — `allFlagsState`
- **Calls through wrappers** with unresolvable client bindings

These appear under **Skipped Usages** in the dry-run output and under high-risk entries in the audit report. The flag debt inventory from Step 1 is your migration plan for the manual portion — work through it before or in parallel with the automated apply step.

## Full workflow summary

A complete LaunchDarkly to OpenFeature migration for a Node.js service follows this sequence:

1. `npx flaglint audit ./src` — map your flag debt and get your readiness score
2. Resolve high-risk manual-review signals: dynamic flag keys, detail evaluations, bulk calls
3. Install the OpenFeature provider; configure the bootstrap module and client binding
4. `npx flaglint migrate ./src --dry-run` — review the generated migration plan
5. `npx flaglint migrate ./src --apply` on a feature branch
6. `npx flaglint validate ./src --no-direct-launchdarkly` — enforce the boundary in CI

LaunchDarkly stays as the evaluation backend throughout. The migration is incremental: automated call sites and manual call sites can land in separate PRs, with the CI gate catching regressions on either.

## Next steps

- [Add OpenFeature Provider](/docs/tutorials/add-openfeature-provider/) — bootstrap module setup in detail
- [Migrate a Node Service](/docs/tutorials/migrate-a-node-service/) — hands-on tutorial with the checkout demo
- [Manual Review Patterns](/docs/guides/manual-review-patterns/) — how to resolve each skip category
- [`flaglint audit` CLI reference](/docs/cli/audit/) — all options and output formats
- [Enforce in GitHub Actions](/docs/tutorials/enforce-in-github-actions/) — CI workflow file
