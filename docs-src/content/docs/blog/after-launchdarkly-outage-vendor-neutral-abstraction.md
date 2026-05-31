---
title: "After the LaunchDarkly Outage: Adding a Vendor-Neutral Abstraction Without a Full Migration"
date: 2026-05-29
description: "The October 2025 AWS outage showed why vendor lock-in in feature flags is a real risk. Here's how to add an OpenFeature abstraction layer without a 6-week migration project."
authors:
  - name: Krishan Sharma
    title: Author of FlagLint
    url: https://www.linkedin.com/in/krishansha/
tags: ["launchdarkly", "openfeature", "vendor-lock-in", "nodejs", "devops"]
---

In October 2025, an AWS US-East-1 outage took LaunchDarkly offline.
Teams couldn't update or create feature flags. Rollbacks were delayed.

For teams with direct LaunchDarkly SDK calls throughout their codebase,
there was no quick path to a fallback provider.

This doesn't require abandoning LaunchDarkly. It requires one abstraction layer.

## The Vendor Lock-In Problem

Direct SDK calls look like this:

```typescript
import LaunchDarkly from 'launchdarkly-node-server-sdk';
const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY);

const enabled = await ldClient.boolVariation('checkout-v2', ctx, false);
```

Your application code is coupled to LaunchDarkly's API surface.
Switching providers means rewriting every evaluation call.

OpenFeature decouples this. Your application calls the OpenFeature API.
The provider (LaunchDarkly, or anything else) is a configuration detail.

## The Migration That Stalls

Most teams agree to add OpenFeature. Most migrations take 6+ weeks
and nearly break production at least once.

The reasons:
- No inventory of where direct SDK calls live
- Argument-order differences cause subtle production bugs
- Phased migrations partially reverse when new engineers join
- No CI enforcement to prevent new direct calls

One of those reasons is an API difference that breaks even careful rewrites — [the argument-order trap between LaunchDarkly and OpenFeature →](/docs/blog/launchdarkly-openfeature-argument-order-bug/)

## What FlagLint Does

Before you can migrate, you need to know what you're migrating.

```bash
npx flaglint scan ./src
```

AST-based inventory of every direct LaunchDarkly SDK call.
File, line, call type, flag key, whether it's safely automatable.

Then:

```bash
flaglint migrate ./src --dry-run
```

Reviewable diffs for safe call sites. Argument order corrected.
Dynamic keys, detail methods, and bulk calls reported for manual review.

Then:

```bash
flaglint validate ./src --no-direct-launchdarkly
```

CI gate. Fails the build if any new direct LD call appears.
The migration doesn't rot.

## LaunchDarkly Stays As Your Provider

This is not a migration away from LaunchDarkly.

LaunchDarkly offers an official OpenFeature provider. After the migration,
LaunchDarkly still evaluates your flags — you're just calling the 
OpenFeature API instead of the LaunchDarkly SDK directly.

The difference: if you need to switch providers, you change the provider 
configuration. Your application code doesn't change.

→ [Start with the scan](/docs/quickstart)  
→ [GitHub](https://github.com/flaglint/flaglint)

---
**Related:** [Why LaunchDarkly → OpenFeature Migrations Break in Production →](/docs/blog/launchdarkly-openfeature-argument-order-bug/)
