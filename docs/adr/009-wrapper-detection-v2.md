---
# ADR 009 — Wrapper Detection v2: Import-Verified Custom SDK Wrappers

**Date:** 2026-06-30
**Status:** ACCEPTED

## Context

Enterprise teams rarely call the LaunchDarkly SDK directly. They wrap it behind
internal abstractions to control the dependency boundary, enforce evaluation
patterns, or provide team-specific defaults:

```ts
import { useFeatureFlag } from '@company/flags'     // React hook wrapper
import { featureService } from '@company/platform'  // service wrapper
```

FlagLint v1.0 shipped a `wrappers` config field that accepts a list of function
names as strings. This is detection by name only — no import verification. Any
function in the codebase that shares one of the configured names is detected as
an LD usage, regardless of where it came from.

This violates the same design principle that governs LD SDK detection:
**identity must be established through import source, not name alone**.
The string-only form also blocks flaglint-go from implementing compatible
wrapper detection, since the fingerprint contract requires the flag key to be
consistently extracted.

## Decision

### Config schema — mixed array, backward compatible

`wrappers` accepts both string entries (legacy, unchanged) and object entries
(new, import-verified):

```json
{
  "wrappers": [
    "legacyFunctionName",
    {
      "import": "@company/flags",
      "function": "useFeatureFlag"
    },
    {
      "import": "@company/experimentation",
      "function": "evaluate",
      "flagKeyArgument": 1
    }
  ]
}
```

**Object entry fields:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `import` | `string` | yes | — | Exact import source string to match (e.g. `"@company/flags"`) |
| `function` | `string` | yes | — | Exported function name to detect calls to |
| `flagKeyArgument` | `number` | no | `0` | Zero-indexed position of the flag key argument |

### Import source matching is exact

`"@company/flags"` matches only `import ... from '@company/flags'`. It does
**not** match `'@company/flags/utils'`, `'@company/flags/react'`, or any prefix.
Exact match is predictable; prefix matching would produce unexpected hits on
monorepo sub-packages.

### Aliased imports are automatically handled

```ts
import { useFeatureFlag as useFF } from '@company/flags'
useFF('my-flag')  // detected — localName "useFF" is resolved from the import
```

The scanner resolves the local binding name from the import specifier, so
aliased imports work without additional configuration.

### String-form wrappers continue to work unchanged

No deprecation warning is emitted. String-form wrappers are a deliberate
tradeoff: less precise, but zero config overhead when the name is unique
in the codebase. Teams can migrate to object-form at their own pace.

### `callType` in output is always `"variation"`

Wrapper-detected calls produce `callType: "variation"` in all output formats,
identical to direct LD SDK calls. Downstream consumers (reporters, SARIF,
migrator, baseline) do not know or care whether a detection came from the LD
SDK or a wrapper. No special-casing is needed anywhere downstream.

### Fingerprints are identical to direct LD calls

A wrapper call detected with flag key `"my-flag"` in `src/service.ts` produces:

```
launchdarkly:variation:my-flag:src/service.ts
```

This is byte-identical to a direct `ldClient.variation('my-flag', ...)` call
in the same file. Baselines written by flaglint-js are consumable by
flaglint-go and vice versa.

### Phase 1 scope: named import → function call only

This ADR covers the case where the wrapper is a named export (or default) that
is imported and called as a function. Member-access patterns
(`featureFlags.isEnabled('key')` where `featureFlags` is an imported object)
are deferred to a follow-up ADR after real user demand establishes the
required design.

### Detection model (same two-step model as collectLDClients)

**Step 1 — collect verified local names:**
Scan `ImportDeclaration` nodes for import sources matching `wrapper.import`.
For each matching import, find the specifier whose imported name matches
`wrapper.function` and collect its local name.

**Step 2 — detect calls:**
For each `CallExpression` with an `Identifier` callee, check if the local name
is in the verified set. Extract the flag key from
`call.arguments[wrapper.flagKeyArgument]`.

## flaglint-go compatibility contract

flaglint-go must implement wrapper detection with identical behavior:

1. Parse `wrappers` as a mixed array of strings and objects
2. Object form: resolve local name from import specifier with matching source
3. Extract flag key from `arguments[flagKeyArgument]` (default index 0)
4. Emit `callType: "variation"` for all wrapper hits
5. Generate fingerprint as `launchdarkly:variation:{flagKey}:{normalizedPath}`
6. String-form wrappers: detect by local identifier name only (no import check)

## Consequences

- `wrappers` config accepts `(string | WrapperObjectConfig)[]` — additive,
  existing string-only configs continue to parse and work unchanged
- Enterprise teams with internal SDK wrappers can now get zero false positives
- Aliased imports work without extra config
- The pattern is the third instance of the import-verified identity model
  (after `collectLDClients` and `collectLDReactSymbols`), confirming it as
  the canonical detection approach for all future vendor integrations
- Member-access wrapper patterns (`obj.method('key')`) are out of scope;
  a follow-up ADR will cover that case when user demand warrants it
