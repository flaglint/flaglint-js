---
title: "Migrating LaunchDarkly Node.js SDK to OpenFeature: A Safe, Practical Guide"
description: A practical guide to migrating direct LaunchDarkly Node.js SDK calls to OpenFeature without swapping fallback and context arguments. Audit, preview, migrate, and enforce safely with FlagLint.
lastUpdated: 2026-06-22
---

This guide walks through every step of migrating direct LaunchDarkly Node.js SDK calls to OpenFeature using FlagLint — from the initial audit to enforcing the boundary in CI.

*Verified with FlagLint v1.0.0 · Node.js · OpenFeature · LaunchDarkly*

---

## What changes when adopting OpenFeature

Adopting OpenFeature changes where in your application the flag evaluation boundary lives. Today, most LaunchDarkly Node.js codebases call the LaunchDarkly SDK directly from business logic — every `boolVariation`, `stringVariation`, or `jsonVariation` call is a direct dependency on the LaunchDarkly SDK.

```
Before:  Application code → LaunchDarkly SDK → LaunchDarkly service
After:   Application code → OpenFeature API → LaunchDarkly provider → LaunchDarkly service
```

Four things to understand before starting:

- **OpenFeature is a vendor-neutral evaluation API standard — it does not replace LaunchDarkly.** LaunchDarkly may continue to evaluate your flags through its official OpenFeature provider.
- **The flag service does not change.** Your existing LaunchDarkly flags, targeting rules, and environments stay exactly as they are.
- **The migration moves the evaluation boundary into application code.** You are changing how your application calls the flag service, not what the flag service does.
- **FlagLint does not configure or operate the provider.** FlagLint analyzes your source code and rewrites call sites. Initializing the OpenFeature client with a LaunchDarkly provider is a separate manual step covered in the [OpenFeature Provider Setup guide](/docs/tutorials/add-openfeature-provider/).

---

## Why the migration is deceptively risky

If you were to migrate by hand or with a naive find-and-replace, you would almost certainly introduce a silent runtime bug. The root cause is an argument-order inversion between the LaunchDarkly SDK and the OpenFeature API.

```ts
// LaunchDarkly: (key, context, fallback)
ldClient.boolVariation("checkout-v2", context, false);

// OpenFeature: (key, fallback, context)
openFeatureClient.getBooleanValue("checkout-v2", false, context);
```

The equivalent migration diff looks like this:

```diff
- return ldClient.boolVariation("checkout-v2", context, false);
+ return flags.getBooleanValue("checkout-v2", false, context);
```

A mechanical migration can still produce incorrect code, especially in:

- **JavaScript** — no type enforcement at all
- **Loosely typed or `any`-typed TypeScript** — the compiler cannot catch the mismatch
- **Wrapper APIs or codemods** — tools that transpose the method name without also transposing the arguments

:::caution
This is a correctness hazard, not necessarily a compile-time error. Your application may start and your tests may pass — but flags can evaluate against wrong context data until someone notices unexpected behavior in production. FlagLint rewrites both the method name and the argument order together, atomically, only when it can prove the transformation is safe.
:::

---

## Migration-pattern classification

Not all LaunchDarkly call sites are equally safe to rewrite automatically. FlagLint classifies every detected call site by migration pattern before deciding whether to rewrite or report for manual review.

| Pattern | Automation status | Reason |
|---|---|---|
| Static boolean evaluation | Usually safe | Flag key is a literal; argument types and positions are known |
| Static string evaluation | Usually safe | Direct mapping exists (`stringVariation` → `getStringValue`) |
| Static number evaluation | Usually safe | Direct mapping exists (`numberVariation` → `getNumberValue`) |
| Static JSON/object evaluation | Usually safe with parity review | Type mapping exists; review expected value shape |
| Dynamic flag key | Manual review | Flag key is a variable — FlagLint cannot verify the target flag at compile time |
| Detail evaluation | Manual review | `variationDetail`/`boolVariationDetail` return metadata; OpenFeature detail APIs differ |
| Bulk flag evaluation | Manual review | `allFlagsState` has no single-flag codemod; requires architecture decision |
| Internal wrapper function | Configuration or review required | Internal wrappers require manual review or explicit configuration |

:::note
FlagLint rewrites only cases it can prove are safe. Any call site where the flag key, argument types, fallback value, or OpenFeature client binding cannot be statically proven is left unchanged and reported for manual review.
:::

---

## Complete migration workflow

FlagLint provides four commands that form a complete migration workflow. Run them in order.

### Step 1 — Audit: understand your exposure

```bash
npx flaglint@latest audit ./src
```

**When to run:** Before any migration work begins, and periodically as the codebase evolves.

**What it does:** Scans source files for direct LaunchDarkly SDK calls, classifies each usage by migration risk, and produces a readiness score. Add `--format json` or `--format html` for machine-readable or browser-viewable output. Add `--effort-estimate` for a directional effort estimate.

- Does *not* modify any files
- Does *not* require API credentials or network access
- Does *not* upload your source code anywhere

**Exit code:** Always 0 — this command is informational only.

### Step 2 — Preview: review the diffs before applying

```bash
npx flaglint@latest migrate ./src --dry-run
```

**When to run:** After reviewing the audit output, before applying any changes.

**What it does:** Shows exactly which call sites will be rewritten and what the rewritten code looks like — as a reviewable diff — without touching any files. Output includes the count of automatable vs. skipped calls and the reason each skipped call was left unchanged.

- Does *not* modify any files

**Exit code:** Always 0 — this command is informational only.

### Step 3 — Apply: write the proven-safe rewrites

```bash
npx flaglint@latest migrate ./src --apply
```

**When to run:** After reviewing the dry-run output on a clean git branch.

**What it does:** Applies proven-safe rewrites to source files in place. Only call sites that pass FlagLint's safety analysis are rewritten; manual-review call sites are not touched.

- Does *not* touch flagged manual-review call sites
- Does *not* rewrite without a proven OpenFeature binding
- Requires a clean git working tree by default; pass `--allow-dirty` to override

**Exit code:** 0 on success; non-zero if preconditions fail.

### Step 4 — Validate: enforce the boundary in CI

```bash
npx flaglint@latest validate ./src --no-direct-launchdarkly
```

**When to run:** In CI after migration is complete; also locally to confirm the boundary is clean. See the [validate CLI reference](/docs/cli/validate/) for all options.

**What it does:** Fails with a non-zero exit code if any direct LaunchDarkly evaluation calls remain in the scanned files.

**Exit code:** 0 if no direct LaunchDarkly calls are found; 1 if any are found.

:::caution
Enable strict enforcement only after all manual-review call sites have been resolved — either rewritten, wrapped, or explicitly reviewed and documented. If any intentional LaunchDarkly calls remain (for example, in a wrapper still under active review), strict validation will fail until they are addressed.
:::

---

## Enterprise checkout service case study

This case study uses the [FlagLint enterprise-checkout-service demo fixture](https://github.com/flaglint/flaglint/tree/main/examples/enterprise-checkout-service), a realistic checkout service with intentionally mixed patterns — static evaluations, dynamic keys, detail calls, and a shared wrapper function.

| Metric | Value |
|---|---|
| Source files scanned | 5 |
| Direct LaunchDarkly calls | 20 |
| Unique flags | 13 |
| High risk | 3 |
| Medium risk | 10 |
| Safely automatable | 10 |
| Manual review required | 10 |
| Files changed by migrate | 3 |

Actual audit output from `flaglint audit`:

```
✓ Audit complete: 13 flags — 3 high risk, 10 medium risk

Migration readiness: 50/100  ·  moderate
[█████████████░░░░░░░░░░░░] 50%
10 safely automatable  ·  10 require manual review
```

A readiness score of 50/100 means roughly half the call sites require manual review before migration can be declared complete. In this fixture, that is primarily due to dynamic flag keys inside a shared wrapper function in `flags-wrapper.ts` that accepts a flag key as a parameter. Resolving those 10 manual-review calls — for example, by extracting keys to constants where possible — would push the score toward 100/100.

The three changed files are `checkout.ts`, `pricing.ts`, and `product.ts` — the files that contained only static-key evaluations. The remaining two files (`analytics.ts` and `flags-wrapper.ts`) were left unchanged because they contain dynamic keys, detail calls, or bulk evaluation patterns that require manual review.

---

## Rewrite and refusal examples

The following examples come directly from `flaglint migrate --dry-run` output on the enterprise-checkout-service fixture.

### Example 1 — Boolean evaluation (rewritten)

```ts
// checkout.ts — Before
return ldClient.boolVariation("checkout-v2", ctx, false);
// After
return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

FlagLint confirms that `"checkout-v2"` is a string literal, that `ctx` is an evaluation context, and that `false` is a boolean fallback. The argument order is transposed and the method is renamed atomically.

### Example 2 — String evaluation (rewritten)

```ts
// pricing.ts — Before
return ldClient.stringVariation("payment-provider", ctx, "stripe");
// After
return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);
```

`stringVariation` maps to `getStringValue`; argument positions are transposed; the string literal key is preserved exactly.

### Example 3 — Dynamic flag key (left unchanged)

```ts
// flags-wrapper.ts — not rewritten
return ldClient.boolVariation(flagKey, ldContext, defaultValue);
```

FlagLint reports: `Manual review required: dynamic flag key`

`flagKey` is a function parameter — its value is not known at compile time, so FlagLint cannot verify which OpenFeature method to call or confirm the fallback type. The correct resolution is to extract the key to a constant where possible, or manually review and rewrite each call site after confirming the key's range of values.

### Example 4 — Detail evaluation (left unchanged)

```ts
// analytics.ts — not rewritten
return ldClient.boolVariationDetail(flagKey, context, false);
```

FlagLint reports: `Manual review required: detail methods skipped — OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires manual review`

`boolVariationDetail` returns an `LDEvaluationDetail` object with `reason` and `variationIndex` fields alongside the boolean value. OpenFeature has equivalent detail APIs, but the result shape and field semantics differ between the two SDKs. FlagLint does not rewrite detail calls because doing so could produce code that compiles correctly but reads the wrong fields at runtime.

---

## Provider boundary

Rewriting application call sites is necessary but not sufficient. Before the rewritten code will work in production, the OpenFeature client must be initialized with a LaunchDarkly provider that routes evaluation calls to the LaunchDarkly service. That is a separate manual setup step — see the [OpenFeature Provider Setup guide](/docs/tutorials/add-openfeature-provider/) for instructions.

| Step | Who handles it |
|---|---|
| Source-code migration — rewrites call sites, transposes arguments, renames methods | FlagLint |
| OpenFeature client initialization — initialize OpenFeature with your chosen provider | Manual |
| LaunchDarkly provider configuration — register the LaunchDarkly OpenFeature provider with your SDK key | Manual |
| Application rollout and testing — verify flag behavior is unchanged in staging | Manual |
| CI enforcement — `flaglint validate --no-direct-launchdarkly` gates the boundary | FlagLint |

---

## Preventing regression in CI

Once the migration is complete, add a validation step to CI to ensure no new direct LaunchDarkly calls are introduced as the codebase evolves.

```bash
npx flaglint@latest validate ./src --no-direct-launchdarkly
```

**After the 10 safe rewrites only** — 10 manual-review calls still remain in `analytics.ts` and `flags-wrapper.ts`. Strict validation fails at this intermediate state:

```
10 direct LaunchDarkly calls remain. Resolve manual-review findings before enforcing this gate.
Exit code: 1
```

Once all 10 manual-review calls have been separately resolved or removed, validation passes:

```
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
Exit code: 0
```

GitHub Actions snippet:

```yaml
# .github/workflows/ci.yml
- name: Enforce OpenFeature boundary
  run: npx flaglint@latest validate ./src --no-direct-launchdarkly
```

:::caution
Enable strict enforcement only after all direct LaunchDarkly calls are resolved. If any manual-review call sites remain — dynamic keys, detail calls, bulk evaluation, or wrapper functions still under review — validation will fail until they are addressed.
:::

---

## Get started

Run the audit command to see where you stand. FlagLint runs entirely locally — your source code does not leave your machine.

```bash
npx flaglint@latest audit ./src
```

**Related:**
- [Quickstart](/docs/quickstart/)
- [Safety model](/docs/concepts/safety-model/)
- [Migration readiness](/docs/concepts/migration-readiness/)
- [validate CLI reference](/docs/cli/validate/)
- [Supported scope](/docs/reference/supported-scope/)
