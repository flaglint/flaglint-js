---
title: Safety Model
description: What FlagLint auto-rewrites, what it skips, and why the safety-over-coverage principle guides every pattern.
lastUpdated: 2026-06-22
---

FlagLint is conservative by design. It separates inventory, review, and source edits so teams can inspect every migration change before it lands in production.

## Safety Model Diagram

<pre class="mermaid">
flowchart TD
    A["Source files"] --> B["Local AST analysis"]
    B --> C["Evaluation inventory"]
    C --> D["Migration plan / SARIF"]
    D --> E{Developer review}
    E -->|approve| F["migrate --apply"]
    E -->|skip| C
</pre>

## What FlagLint WILL Auto-Rewrite

`migrate --apply` rewrites a call site only when **all** of the following are provably true from static analysis:

| Condition | Example |
|-----------|---------|
| **Static string literal flag key** | `"checkout-v2"` — not a variable, not a template literal, not a function call |
| **Supported variation method** | `boolVariation`, `stringVariation`, `numberVariation`, or `jsonVariation` |
| **Unambiguous fallback type** | `false` → `getBooleanValue`, `"stripe"` → `getStringValue`, `0` → `getNumberValue`, object/array → `getObjectValue` |
| **LaunchDarkly Node.js server SDK import** | `@launchdarkly/node-server-sdk` or `launchdarkly-node-server-sdk` — both ESM and CommonJS |
| **Verified evaluation context expression** | The context argument is present and can be forwarded as-is |
| **Proven OpenFeature client binding** | A local or configured import of the OpenFeature client is resolvable |
| **Clean working tree** | `git status` is clean, unless `--allow-dirty` is explicitly passed |

When every condition is met, FlagLint produces an idempotent, argument-order-correct rewrite — and leaves the LaunchDarkly packages in `package.json` because the OpenFeature provider depends on them at runtime.

## What FlagLint WILL NOT Rewrite

| Pattern | Why it is skipped | What to do |
|---------|------------------|------------|
| **Dynamic flag keys** — `ldClient.boolVariation(getFlagKey(user), ctx, false)` | The key is only known at runtime; FlagLint cannot statically verify which flag is being evaluated or infer the correct OpenFeature method | Refactor to a static key at the call site, then re-run |
| **`variationDetail` / `boolVariationDetail` / `stringVariationDetail` / `numberVariationDetail`** | These return a `LDEvaluationDetail` object containing reason and index fields that have no direct OpenFeature equivalent | Use the OpenFeature `EvaluationDetails` API manually; see [OpenFeature Boundary](/docs/concepts/openfeature-boundary/) |
| **`allFlags()` / `allFlagsState()`** | Bulk evaluation has no OpenFeature equivalent; migrating it requires an architectural decision about how flag state is consumed | Replace with individual targeted evaluations or a custom provider hook |
| **React SDK calls** — `useFlags`, `useLDClient`, `withLDProvider` | The React SDK is a browser/client-side SDK with a fundamentally different lifecycle from the Node.js server SDK | Use the OpenFeature React SDK and its hooks directly |
| **Wrappers not configured in `.flaglintrc`** | FlagLint cannot distinguish a custom wrapper from an unrelated function unless it is explicitly declared | Add wrapper declarations to `wrappers: []` in `.flaglintrc`, then re-run |
| **Ambiguous fallback types** — e.g. `null`, a variable, or a union-typed expression | FlagLint cannot determine which `get*Value` method to use without a concrete literal type | Replace the fallback with an explicit literal (`false`, `""`, `0`, `{}`) at the call site |
| **Non-LaunchDarkly providers** | FlagLint is a LaunchDarkly-specific static analysis tool | No action; these calls are reported in the inventory but never touched |
| **Non-Node.js SDKs** — browser SDK, Go SDK, Java SDK | Only the Node.js server-side SDK import provenance is verified | Migrate browser and other-language calls manually |

## Why Fallback Value Does Not Equal Production Value

The fallback value in `boolVariation("my-flag", ctx, false)` is the value the SDK returns when it **cannot reach LaunchDarkly** — for example, during a network outage, before initialization, or in test environments with no SDK key.

It is **not** the current live state of the flag in your LaunchDarkly project.

FlagLint uses the fallback value for one purpose only: to infer the correct OpenFeature `get*Value` method so the argument types stay consistent. A `false` fallback maps to `getBooleanValue`; a `"stripe"` fallback maps to `getStringValue`. No flag evaluation or API call is made.

This means:

- FlagLint does **not** know whether `"my-flag"` is `true` or `false` in production.
- FlagLint does **not** know whether the flag has been cleaned up in LaunchDarkly.
- FlagLint preserves your fallback exactly — it does not guess a different default.

If your fallback is `false` but the flag is `true` 99% of the time in production, your OpenFeature migration will still have `false` as the disconnected default. That is correct: the fallback is an emergency value, not the expected value.

## Safety Over Coverage

> A wrong automated rewrite in production is worse than no rewrite at all.

FlagLint adds a new auto-rewrite pattern only when **all three** of these conditions are true:

1. **The OpenFeature equivalent is unambiguous.** There is exactly one correct `get*Value` method and one correct argument order for the source pattern. If the mapping requires a judgment call, the pattern stays in the manual-review list.

2. **The rewrite is idempotent.** Running `migrate --apply` twice produces the same output as running it once. A rewrite that changes on the second run indicates a bug in the pattern, not a feature.

3. **Fixture tests prove correctness.** Every supported pattern has a corresponding AST fixture in `src/scanner/tests/fixtures/` and a migrator test in `src/migrator/`. The test must cover the before state, the after state, and the case where the pattern should be skipped.

Patterns that pass two out of three are documented in this page's "Will Not Rewrite" table and shipped as manual-review findings in `flaglint audit` output.

## Static Analysis Only

FlagLint operates entirely on your local source files using AST parsing. It:

- **Never calls the LaunchDarkly API.** No SDK key or API token is required or accepted.
- **Never evaluates flags at runtime.** Flag values are not fetched, cached, or inferred from LaunchDarkly servers.
- **Never uploads source code or flag keys.** No file paths, flag keys, or code snippets leave your machine.
- **Never requires network access.** `audit`, `scan`, `migrate`, and `validate` all work fully offline.

The only external calls happen when the OpenFeature provider your application uses connects to LaunchDarkly at runtime — that is your code, not FlagLint.

## What `--apply` Requires (Summary Checklist)

`migrate --apply` rewrites a call site only when all of these are true:

- The LaunchDarkly client is proven from supported Node.js server SDK provenance.
- The call is one of: `boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`.
- The flag key is a static string literal.
- The fallback value is a concrete literal with an unambiguous type.
- The evaluation context expression is present.
- A local or configured imported OpenFeature client binding is proven.
- The git working tree is clean, unless `--allow-dirty` is explicitly used.

If any condition cannot be satisfied from static analysis alone, the call site is added to the manual-review list and left untouched.

## Required Review

Generated diffs are reviewable migration assistance, not a guarantee of production safety. Run your test suite and review each diff before merging. FlagLint's job is to make the safe cases fast and the unsafe cases visible — not to replace engineer judgment.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/concepts/safety-model.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [OpenFeature Boundary](/docs/concepts/openfeature-boundary/)
