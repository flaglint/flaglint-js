# ADR 005 — Cleanup Command (Deferred)

Date: 2026-06
Status: DEFERRED

## Decision

Do not implement `flaglint cleanup` in v0.x. Do not remove flag branches based
on static analysis of fallback values alone. Revisit only after the prerequisites
below are met and an explicit implementation path is approved.

## Context

The most requested capability beyond migration is dead-branch removal: once a flag
is permanently true or false in production, delete the losing branch and simplify
the code. This would extend FlagLint's audience beyond "teams migrating to OpenFeature"
to "any team with flag sprawl" — a significantly larger addressable market.

## Why Not Now

The critical constraint: **the fallback value is not the permanent flag value.**

In `ldClient.boolVariation(flagKey, context, fallback)`, `fallback` is used only
when evaluation fails — the provider is unavailable, the SDK cannot reach LaunchDarkly,
or the flag key does not exist. It is not the value LaunchDarkly is serving to users
in production.

A cleanup command that removes branches based on fallback values could silently delete
code that LaunchDarkly is actively serving to real users. This would:

1. **Produce production breakage with no build-time warning.** The rewritten code
   compiles and passes tests. The breakage only appears at runtime when users receive
   the wrong feature state.

2. **Violate the core product promise: safety over coverage.** ADR 005 would undo
   the trust built by the product contract. A wrong rewrite is worse than no rewrite.
   FlagLint's moat is that it can be trusted with `--apply`. A single high-profile
   incident of wrong branch removal would destroy that trust.

3. **Have no reliable signal to act on.** Source-level staleness signals (keyword
   matches, low usage count, age) are hints — not proof that a production flag is
   safe to remove. FlagLint explicitly does not query LaunchDarkly APIs.

## The Only Safe Implementation Path

Cleanup is only safe if the user explicitly provides the known permanent flag value:

```bash
flaglint cleanup --assume checkout-v2=true --dry-run
flaglint cleanup --flag-values ./resolved-flags.json --dry-run
```

In this model:
- FlagLint does not infer which branch is winning. The user tells it.
- FlagLint parses the AST, identifies which branch corresponds to the provided value,
  and proposes removal of the other branch.
- `--dry-run` is the default. `--apply` is opt-in.
- Any call site where the permanent value cannot be statically matched to a branch
  is reported for manual review, never rewritten.

This preserves safety over coverage. The user supplies the knowledge FlagLint cannot
derive; FlagLint supplies the structural transformation FlagLint can prove is safe.

## When to Revisit

- After the `--assume` / `--flag-values` input mechanism is designed (requires its own ADR).
- After the product contract page (`/docs/product-contract`) is live, so the "safety
  over coverage" constraint is publicly documented and the cleanup command's design
  can be evaluated against it explicitly.
- After at least one platform team has requested this with a specific use case, so
  the implementation can be validated against a real workflow rather than a hypothetical.

## Consequences

- No cleanup command in v0.x.
- Policy-as-code (ADR 004) is the correct near-term answer to flag sprawl — govern
  flag lifetime rather than remove branches without production data.
- When cleanup is revisited, the design must: require explicit user-supplied flag values,
  default to `--dry-run`, and refuse any call site where the branch cannot be
  statically matched to the provided value.
