---
title: "Why LaunchDarkly → OpenFeature Migrations Break in Production"
date: 2026-05-29
description: "The argument-order difference between LaunchDarkly and OpenFeature silently breaks flag evaluations in production. Here's what it looks like, why grep misses it, and how AST analysis catches it."
authors:
  - name: Krishan Sharma
    title: Author of FlagLint
    url: https://www.linkedin.com/in/krishansha/
tags: ["launchdarkly", "openfeature", "migration", "nodejs", "devops"]
---

Most LaunchDarkly → OpenFeature migrations fail the same way.
And nobody catches it until it's in production.

## The Agreement That Takes 30 Minutes

Teams agree on OpenFeature quickly. It makes sense — vendor-neutral, 
CNCF-backed, clean abstraction. The decision is easy.

The migration is not.

Halfway through, most teams hit a bug that looks like this in production:
a subset of users sees the wrong feature state. The flag evaluation 
is returning unexpected values. Everything looked correct in code review.

The cause is almost always the same thing.

## The Argument-Order Trap

LaunchDarkly and OpenFeature share method names but differ in argument order:

```typescript
// LaunchDarkly
ldClient.boolVariation(flagKey, context, fallback)

// OpenFeature  
openFeatureClient.getBooleanValue(flagKey, fallback, context)
```

`context` and `fallback` are swapped.

A search-and-replace migration silently puts `context` where `fallback` 
should be, and `fallback` where `context` should be — across every call 
site in your codebase.

In production: users in your evaluation context see the fallback value.
In code review: the signature looks correct because the argument count matches.
In the post-mortem: nobody can identify when it was introduced.

## Why Grep Misses It

The typical manual approach:

1. Search for `launchdarkly-node-server-sdk` imports
2. Find all `ldClient` references  
3. Search-and-replace method names

This finds the calls. It does not understand argument semantics.

A grep-based migration will correctly rename `boolVariation` to 
`getBooleanValue` and miss the argument order entirely. The test suite 
often misses it too because the values are both valid types — `context` 
and `fallback` are both objects.

## What AST Analysis Catches

Abstract Syntax Tree (AST) analysis parses your code the same way a 
compiler does. It doesn't match text — it understands structure.

For a call like:

```typescript
const result = await ldClient.boolVariation('checkout-v2', ctx, false);
```

AST analysis identifies:
- The import binding (`ldClient` → `launchdarkly-node-server-sdk`)
- The method name (`boolVariation`)
- The argument at position 0: flag key (`'checkout-v2'` — string literal)
- The argument at position 1: context (`ctx` — object reference)
- The argument at position 2: fallback (`false` — boolean literal)

When generating the OpenFeature equivalent, it knows to produce:

```typescript
const result = await openFeatureClient.getBooleanValue('checkout-v2', false, ctx);
```

Argument 2 goes to position 1. Argument 1 goes to position 2.
Argument order corrected. Type preserved. Await preserved.

## When AST Analysis Refuses to Rewrite

Not every call can be safely automated. FlagLint identifies these 
and routes them to manual review instead of silently rewriting them:

**Dynamic flag keys:**
```typescript
const flagKey = `feature-${featureName}`;
await ldClient.boolVariation(flagKey, ctx, false);
```
The key is not statically knowable. Automated rewrite could produce 
incorrect OpenFeature client binding.

**Detail methods:**
```typescript
await ldClient.boolVariationDetail('checkout-v2', ctx, false);
```
`boolVariationDetail` returns metadata not directly equivalent in 
OpenFeature. Requires a different migration pattern.

**Bulk state calls:**
```typescript
await ldClient.allFlagsState(ctx);
```
No direct OpenFeature equivalent. Architecture decision required.

For all of these, FlagLint reports the location and reason — 
it never silently rewrites them.

## The CI Gate

Generating diffs is only half the problem. Migration rot is the other half.

After a phased migration, new engineers joining the codebase don't 
know the rule. They reach for `ldClient` because that's what they know. 
Six months later, you have new direct LD calls and the migration has 
partially reversed.

`flaglint validate --no-direct-launchdarkly` exits 1 if any direct 
LaunchDarkly evaluation call appears outside the bootstrap file.

Add it to your GitHub Actions workflow:

```yaml
- name: Enforce OpenFeature boundary
  run: flaglint validate ./src --no-direct-launchdarkly
  if: always()
```

Any new `ldClient.boolVariation()` call fails the build. The boundary holds.

## Try It Now

```bash
npx flaglint scan ./src
```

Runs locally, no SDK key needed, nothing changes. Shows you every 
direct LaunchDarkly SDK call in your codebase by file and line — 
including dynamic keys, detail methods, and bulk state calls.

```bash
flaglint migrate ./src --dry-run
```

Shows the before/after diff for every safely automatable call site.
Dynamic keys and detail methods are reported separately for manual review.

FlagLint is free, open source, MIT licensed.

→ [GitHub](https://github.com/flaglint/flaglint)  
→ [npm](https://www.npmjs.com/package/flaglint)  
→ [Quickstart](/docs/quickstart)
