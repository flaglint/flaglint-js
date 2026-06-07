---
title: "Five LaunchDarkly SDK Patterns That Block Automatic Migration to OpenFeature"
date: 2026-06-06
description: "Dynamic keys, detail evaluations, bulk state calls, configured wrappers, and unknown fallback types all require manual review. Here's what each looks like, why it blocks automigration, and how to resolve each one."
authors:
  - name: Krishan Sharma
    title: Founder and maintainer of FlagLint
    url: https://www.linkedin.com/in/krishansha/
tags: ["launchdarkly", "openfeature", "migration", "nodejs", "devops"]
---

Run `flaglint migrate ./src --dry-run` and you will see two kinds of results: call
sites with a generated diff and call sites marked `skip — manual review required`.
The skipped calls are not bugs in the tool. They are patterns where a mechanical
rewrite would change runtime behavior in ways the tool cannot prove are safe.

This article covers the five patterns that produce skips and what you need to do for each.

<!-- excerpt -->

## What makes a call automatable

FlagLint rewrites a call automatically only when it can prove three things:

1. The flag key is a static string literal.
2. The fallback value type is known (`boolean`, `string`, `number`, or `json`).
3. A verified OpenFeature client binding is present in scope.

If any proof fails, the call is left unchanged and flagged for manual review. The
conservative stance is intentional: a wrong rewrite is worse than no rewrite.

---

## Pattern 1 — Dynamic flag keys

**What it looks like:**

```ts
// key comes from a variable
const key = user.experimentGroup === 'A' ? 'checkout-v2' : 'checkout-v1';
const enabled = await ldClient.boolVariation(key, ctx, false);

// key comes from a function call
const discount = await ldClient.numberVariation(getFlagKey(user.tier), ctx, 0);

// key is assembled at runtime
const variant = await ldClient.stringVariation(`feature-${region}-rollout`, ctx, 'control');
```

**Why it blocks migration:**

OpenFeature's evaluation methods are structurally identical to LaunchDarkly's for
this case — both take `(key, defaultValue, context)`. But if the key is dynamic,
FlagLint cannot know which flag is being evaluated, which means it cannot verify
that the OpenFeature provider has that flag configured, cannot determine the correct
return type, and cannot guarantee the fallback default is the right type for that
specific flag.

**How to resolve:**

Extract the dynamic selection into an explicit switch or map, then call evaluation
with a known static key per branch:

```ts
// Before
const discount = await ldClient.numberVariation(getFlagKey(user.tier), ctx, 0);

// After
const FLAG_BY_TIER: Record<string, string> = {
  free: 'discount-free-tier',
  pro: 'discount-pro-tier',
  enterprise: 'discount-enterprise-tier',
};
const flagKey = FLAG_BY_TIER[user.tier] ?? 'discount-free-tier';
const discount = await openFeatureClient.getNumberValue(flagKey, 0, ctx);
```

Once the key is static in each branch, the surrounding calls become automatable in
the next `migrate` run.

---

## Pattern 2 — Detail evaluations

**What it looks like:**

```ts
const detail = await ldClient.boolVariationDetail('show-banner', ctx, false);
// detail.value — the evaluated value
// detail.reason — WHY it was that value (RULE_MATCH, FALLTHROUGH, etc.)
// detail.variationIndex — index into the flag's variation list

const result = await ldClient.variationDetail('checkout-experiment', ctx, 'control');
```

**Why it blocks migration:**

OpenFeature has an equivalent — `getBooleanDetails()` returns a `{ value, reason,
errorCode }` object. But the reason structure is different. LaunchDarkly's
`EvaluationReason` includes `ruleId`, `ruleIndex`, `bigSegmentsStatus`, and
`prerequisiteKey`. OpenFeature's `ResolutionDetails` uses a smaller vocabulary
(`CACHED`, `DEFAULT`, `ERROR`, `SPLIT`, `STATIC`, `TARGETING_MATCH`, `UNKNOWN`).

Code that consumes `detail.reason.kind === 'RULE_MATCH'` or `detail.reason.ruleId`
will need to be updated alongside the evaluation call. FlagLint cannot safely
generate that transformation because the consuming code varies too much.

**How to resolve:**

Migrate these calls manually. For each `variationDetail` call:

1. Replace the evaluation with `getBooleanDetails()` / `getStringDetails()` etc.
2. Update any consumers of `reason.kind`, `reason.ruleId`, or `variationIndex` to use OpenFeature's reason vocabulary.
3. Add tests that cover the specific reason codes your business logic depends on.

```ts
// Before
const detail = await ldClient.boolVariationDetail('show-banner', ctx, false);
if (detail.reason.kind === 'RULE_MATCH') { track('rule-matched'); }

// After
const detail = await openFeatureClient.getBooleanDetails('show-banner', false, ctx);
if (detail.reason === 'TARGETING_MATCH') { track('rule-matched'); }
```

---

## Pattern 3 — Bulk state calls

**What it looks like:**

```ts
// Server-side bootstrap — sends all flag values to the client
const allFlags = ldClient.allFlags(ctx);
const state = await ldClient.allFlagsState(ctx);

// Common in SSR: inject all flags into the page for client-side hydration
res.locals.flags = ldClient.allFlags(ctx);
```

**Why it blocks migration:**

OpenFeature has no equivalent to `allFlags()` or `allFlagsState()`. The OpenFeature
specification deliberately does not include bulk evaluation — providers are expected
to surface individual flags, and bulk retrieval is a vendor-specific concern.

The LaunchDarkly OpenFeature provider does not expose `allFlags` through the
OpenFeature client interface. If your code relies on bulk evaluation to bootstrap a
client-side SDK or build a flag snapshot, that architecture requires rethinking, not
just rewriting.

**How to resolve:**

**Option A — Enumerate the flags explicitly.** If you know which flags are needed
at the injection point, evaluate them individually and bundle the results:

```ts
const FLAGS_TO_BOOTSTRAP = ['show-banner', 'checkout-v2', 'new-pricing'] as const;

const flagSnapshot = Object.fromEntries(
  await Promise.all(
    FLAGS_TO_BOOTSTRAP.map(async (key) => [
      key,
      await openFeatureClient.getBooleanValue(key, false, ctx),
    ])
  )
);
```

**Option B — Use the LaunchDarkly provider directly for bootstrapping.** The
OpenFeature provider wraps the LD Node.js SDK. You can access the underlying client
for the specific bootstrap call while migrating all other evaluation calls to
OpenFeature:

```ts
import { LaunchDarklyProvider } from '@launchdarkly/openfeature-node-server';

const provider = new LaunchDarklyProvider(process.env.LD_SDK_KEY!);
await OpenFeature.setProviderAndWait(provider);

// Access the underlying LD client only for bulk bootstrap
const ldClient = (provider as any).getClient(); // type-cast needed; provider internals are not public API
const allFlags = ldClient.allFlags(ctx);
```

Option B is a transitional pattern. The goal is to eliminate it once you've
enumerated the flags that actually need bootstrapping.

---

## Pattern 4 — Configured wrappers

**What it looks like:**

```ts
// A shared evaluation helper used across services
export function isFeatureEnabled(flagKey: string, ctx: LDContext): Promise<boolean> {
  return ldClient.boolVariation(flagKey, ctx, false);
}

// Custom wrapper that adds logging and metrics
export async function evaluateFlag<T>(key: string, ctx: LDContext, fallback: T): Promise<T> {
  const result = await ldClient.variation(key, ctx, fallback);
  metrics.record('flag.evaluation', { key, result });
  return result as T;
}
```

**Why it blocks migration:**

FlagLint detects wrappers configured in `.flaglintrc` under the `wrappers` key.
When a wrapper is detected, the call is surfaced in the audit and scan output but
never auto-rewritten — because rewriting the call site does not solve the problem.
The wrapper itself contains the direct LD SDK call that needs to change.

**How to resolve:**

Migrate the wrapper implementation, not the call sites. The call sites stay the same;
only the internals of the wrapper change:

```ts
// Before
export function isFeatureEnabled(flagKey: string, ctx: LDContext): Promise<boolean> {
  return ldClient.boolVariation(flagKey, ctx, false);
}

// After — wrapper now delegates to OpenFeature
export function isFeatureEnabled(flagKey: string, ctx: EvaluationContext): Promise<boolean> {
  return openFeatureClient.getBooleanValue(flagKey, false, ctx);
}
```

After the wrapper implementation is migrated, configure FlagLint to recognise the
wrapper's result type so downstream `scan` output is accurate:

```json
{
  "wrappers": ["isFeatureEnabled", "evaluateFlag"]
}
```

Wrappers that accept a dynamic `flagKey` parameter will still appear in reports —
that is correct behaviour. The scanner surfaces them for the same reason it surfaces
dynamic keys: it cannot prove which flag is being evaluated.

---

## Pattern 5 — Unknown fallback types (`jsonVariation`)

**What it looks like:**

```ts
// Untyped JSON — fallback type is object but the shape is unknown
const config = await ldClient.jsonVariation('pricing-config', ctx, {});

// Typed JSON with a complex or union shape
const rules = await ldClient.jsonVariation('routing-rules', ctx, { routes: [] });
```

**Why it blocks migration:**

OpenFeature's equivalent is `getObjectValue()`, which returns `JsonValue` — a union
of `string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }`.
When the fallback is `{}` or another untyped object, FlagLint cannot determine the
correct generic type to use, and it cannot verify that the calling code handles the
`JsonValue` type correctly rather than a narrower application-specific type.

**How to resolve:**

Add explicit type annotations to the fallback and the result, then migrate manually:

```ts
// Define the expected shape
interface PricingConfig {
  basePrice: number;
  currency: string;
  tiers: { name: string; discount: number }[];
}

const DEFAULT_CONFIG: PricingConfig = { basePrice: 0, currency: 'USD', tiers: [] };

// Before
const config = await ldClient.jsonVariation('pricing-config', ctx, DEFAULT_CONFIG);

// After
const config = await openFeatureClient.getObjectValue(
  'pricing-config',
  DEFAULT_CONFIG,
  ctx
) as PricingConfig;
```

The explicit cast is safe because the provider returns whatever LaunchDarkly sends,
and the schema is defined in the LaunchDarkly dashboard. If the shape might not
match, add a runtime validator (Zod works well here) at the call site.

---

## Seeing the full breakdown before you start

Before migrating, run `flaglint audit ./src` to see how many calls fall into each
category and why:

```
✓ Audit complete: 18 flags — 5 high risk, 13 medium risk

| Flag Key              | Risk   | Usages | Reasons                           |
|-----------------------|--------|--------|-----------------------------------|
| <dynamic key>         | High   | 9      | key cannot be resolved statically |
| checkout-experiment   | High   | 1      | detail evaluation                 |
| *                     | High   | 1      | bulk call                         |
| <wrappers>            | High   | 4      | configured wrapper                |
| pricing-config        | Medium | 1      | json — unknown shape              |
| checkout-v2           | Medium | 1      | safely automatable                |
```

The five patterns above account for every high-risk category. Resolving them
one at a time — starting with wrappers, then dynamic keys — progressively reduces
the manual review surface until `migrate --apply` can handle the rest automatically.
