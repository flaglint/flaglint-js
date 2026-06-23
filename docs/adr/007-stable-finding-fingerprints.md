---
# ADR 007 — Stable Finding Fingerprints

**Date:** 2026-06-22
**Status:** ACCEPTED

## Context

FlagLint v1.0 introduces baseline mode, which requires stable identifiers for
findings across runs. Line numbers are fragile — they change when code is
reformatted, comments are added, or unrelated code moves around. We need
fingerprints that remain stable as long as the logical finding has not changed.

Consumers of stable fingerprints:
- **Baseline mode** — matches current findings against a stored baseline to
  identify new debt without failing on historical debt
- **SARIF output** — stable result identities prevent GitHub Code Scanning
  alert churn between runs
- **Future reporting** — trend tracking, exception registry, dashboards

## Decision

### v1.0 fingerprint schema

```
provider:callType:flagKey:normalizedFilePath
```

| Component | Example | Notes |
|---|---|---|
| `provider` | `launchdarkly` | hardcoded in v1.0; extensible post-v1 |
| `callType` | `boolVariation` | the SDK method name |
| `flagKey` | `checkout-v2` | the literal string key |
| `normalizedFilePath` | `src/checkout/service.ts` | relative to scan root, forward slashes, no leading `./` |

**Example fingerprints:**
```
launchdarkly:boolVariation:checkout-v2:src/checkout/service.ts
launchdarkly:stringVariation:payment-provider:src/payments/processor.ts
```

### File path normalization

- Path is relative to the scan root directory
- All backslashes replaced with forward slashes (Windows compatibility)
- No leading `./`
- No trailing slash

### Dynamic key handling

For dynamic keys (`isDynamic: true` or `flagKey === "*"`), include a
sequential index within the file to differentiate multiple dynamic calls:

```
launchdarkly:boolVariation:*:src/service.ts:0
launchdarkly:boolVariation:*:src/service.ts:1
```

This is imperfect — index order may shift if dynamic calls reorder — but it
is better than omitting fingerprints for dynamic calls entirely.

### Known collision

If the same `flagKey` is called with the same `callType` more than once in
the same file, the fingerprints collide and both findings share the same
fingerprint.

**Why not add `containingSymbol` in v1.0?** Finding the enclosing
function/class requires additional AST traversal. Same-file collisions are
rare in practice. Deferring to v1.1 where the fifth component can be added
additively without breaking existing baselines.

### File rename / move behavior

When a file is renamed or moved, the fingerprints for all its findings change
because the `normalizedFilePath` component changes. Those findings will
appear as new debt in baseline comparisons. This is documented behavior —
users should re-run `--write-baseline` after significant refactors.

## Implementation

- Add `fingerprint: string` to `FlagUsage` in `src/types.ts` (additive)
- Create `src/scanner/fingerprint.ts` with a `generateFingerprint()` helper
- Call in scanner after each `FlagUsage` is built
- Include in all JSON output
- SARIF consumers use fingerprint as result identity (see ADR 008)
- Baseline artifacts store fingerprint arrays (see ADR 008)

## Consequences

- `FlagUsage` gains a `fingerprint: string` field — additive, no breaking change
- Fingerprints survive line-number changes
- Baseline mode is unblocked (see ADR 008)
- **Known limitation:** same-file collision for identical `callType` + `flagKey`;
  to be addressed in v1.1 by adding `containingSymbol` as a fifth component
- **Known limitation:** file renames change fingerprints; re-run
  `--write-baseline` after significant refactors
