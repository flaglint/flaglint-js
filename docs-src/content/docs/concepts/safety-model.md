---
title: Safety Model
description: How FlagLint limits automatic migration to reviewable, proven transformations.
lastUpdated: 2026-05-28
---

FlagLint is intentionally conservative. It performs local static analysis and only rewrites call sites that preserve behavior at the source level.

## AST-Based Analysis

FlagLint parses JavaScript and TypeScript with `@typescript-eslint/typescript-estree`. It uses AST bindings instead of regular expressions so it can distinguish:

- LaunchDarkly imports from unrelated local variables.
- Named `init` import aliases from unrelated functions named `ldInit`.
- Static string keys from dynamic expressions.
- Known fallback literals from unknown fallback expressions.

## Clean Git Tree Requirement

`flaglint migrate --apply` refuses to run on a dirty git working tree unless `--allow-dirty` is set.

```bash
flaglint migrate ./src --apply
```

If the tree is dirty:

```text
Refusing to apply migration with uncommitted changes.
Commit or stash changes first, or rerun with --allow-dirty.
```

## No Automatic Rewrite of Ambiguous Patterns

FlagLint does not automatically rewrite:

- Dynamic keys.
- Detail evaluations.
- Bulk flag-state calls.
- Unknown fallback types.
- Ambiguous or unconfigured OpenFeature client bindings.
- Browser SDKs, React SDKs, non-Node SDKs, or non-LaunchDarkly providers.

## Review and Tests Required

Generated changes require human review and project tests before merge. FlagLint can preserve source-level arguments and enforce direct-SDK policy, but it cannot prove business behavior, flag targeting, or production rollout safety.

FlagLint does not query LaunchDarkly for flag age, owner, evaluation history, environment configuration, or production usage. Local review signals are not proof that a production flag is stale.
