# ADR 004 — React SDK and JS Browser SDK Detection Design

Date: 2026-06-20
Status: ACCEPTED (spec complete; implementation deferred to post-distribution window)

## Decision

Extend the scanner to detect `launchdarkly-react-client-sdk`, `@launchdarkly/react-client-sdk`, `launchdarkly-js-client-sdk`, and `@launchdarkly/js-client-sdk` usages. Surface them with a new `sdkSurface` field on `FlagUsage` and emit `unsupported-sdk` warnings for browser/React SDK call sites. Do NOT attempt auto-migration of React or browser SDK usages — they are always manual-review items.

## Context

The existing scanner handles `launchdarkly-node-server-sdk` and `@launchdarkly/node-server-sdk` only. Full-stack monorepos silently produce incomplete reports when React or browser SDK calls exist in the same scan root. Issue #125 tracks the UX gap (silent omission). This ADR specifies the detection design so an engineer can build from it cold.

---

## Package Scope

| Package | Surface | Import style |
|---|---|---|
| `launchdarkly-react-client-sdk` | React (hooks + HOC) | Named ESM |
| `@launchdarkly/react-client-sdk` | React (hooks + HOC) | Named ESM |
| `launchdarkly-js-client-sdk` | Browser (plain JS) | Default + named ESM / CJS |
| `@launchdarkly/js-client-sdk` | Browser (plain JS) | Default + named ESM / CJS |

---

## CallType Mapping

The existing `CallType` union already contains the members needed for React and browser patterns. No new union values are required.

| Pattern | CallType | Notes |
|---|---|---|
| `useFlags()` | `"hook-useFlags"` | Returns object of ALL flags; no single key |
| `useLDClient()` | `"hook-useLDClient"` | Returns client instance; flag key extracted from subsequent `.variation()` call if static |
| `withLDProvider(config)(App)` | `"provider"` | HOC — no flag key |
| `asyncWithLDProvider(config)` | `"provider"` | Async variant — same treatment |
| `withFlagUnleashed(Component)` | `"hoc"` | HOC — no flag key |
| `LDProvider` JSX | `"provider"` | JSX element form of provider setup |
| `withLDConsumer()` | `"hoc"` | Consumer HOC — no flag key |
| `ldClient.variation("key", default)` | `"variation"` | Browser JS SDK — identical method shape to server SDK |
| `ldClient.boolVariation("key", default)` | `"boolVariation"` | Browser JS SDK |
| `ldClient.identify(ctx)` | — | Skipped — not a flag evaluation |

`useFlags()` always uses `flagKey: "*"` and `isDynamic: false` — the same convention as `allFlags`/`allFlagsState` on the server side. This is intentional: the call returns all flags and there is no single static key to extract.

---

## New FlagUsage Field: `sdkSurface`

Add one optional field to `FlagUsage` (additive — existing node-server usages leave it undefined for backwards compatibility):

```ts
export interface FlagUsage {
  // ... existing fields unchanged ...
  sdkSurface?: "node-server" | "react" | "js-browser";
  flagKeyIsCamelCased?: boolean;
}
```

- Node-server usages: `sdkSurface` is `undefined` (backwards compatible — consumers that don't read it are unaffected)
- React SDK usages: `sdkSurface: "react"`
- JS browser SDK usages: `sdkSurface: "js-browser"`

No other `FlagUsage` fields change. `MigrationInventoryItem` does NOT need `sdkSurface` because React/browser usages always produce `safelyAutomatable: false` and `manualReviewReason: "browser-sdk"` (new value — see below).

---

## New MigrationManualReviewReason Value

```ts
export type MigrationManualReviewReason =
  | "dynamic-key"
  | "unknown-fallback"
  | "detail-method"
  | "bulk-inventory-call"
  | "browser-sdk"; // NEW — additive
```

All React and JS browser SDK usages are assigned `manualReviewReason: "browser-sdk"` and `safelyAutomatable: false`.

---

## New ScanWarning Kind

```ts
export type ScanWarning =
  | { kind: "read-failure"; file: string; fsCode: string }
  | { kind: "parse-failure"; file: string }
  | { kind: "unsupported-sdk"; file: string; package: string }; // NEW
```

One `unsupported-sdk` warning is emitted per file that imports from a React or browser SDK package, regardless of how many calls that file contains.

---

## The camelCase Key Mapping Trap

**This is the single most dangerous migration pitfall for React SDK users.**

The LaunchDarkly React SDK automatically converts flag keys to camelCase in the object returned by `useFlags()`:

```ts
// Flag key in LaunchDarkly dashboard: "checkout-v2"
const flags = useFlags();
flags["checkout-v2"]; // undefined — key was camelCased
flags.checkoutV2;     // true — this is what React SDK exposes
```

Consequences for FlagLint:
- When a codebase accesses `flags.checkoutV2`, the static key seen in source is `"checkoutV2"`, not `"checkout-v2"`. The scanner MUST record this as `isDynamic: false, flagKey: "checkoutV2"` and emit a separate warning that the real dashboard key may differ.
- The migrator MUST NOT attempt to auto-generate an OpenFeature call from a camelCased key without first resolving the original kebab-case key.
- A `flagKeyIsCamelCased?: boolean` field on `FlagUsage` (optional, additive) signals this condition to the reporter and migrator.

Detection heuristic: any `flagKey` extracted from a `hook-useFlags` usage that passes `/^[a-z][a-zA-Z0-9]*$/.test(key) && /[A-Z]/.test(key)` is likely a camelCased dashboard key. Flag it.

---

## Detection Algorithm

### Step 1 — Import tracking (per file)

Scan all `ImportDeclaration` nodes. For each import from a React or browser SDK package:

```
REACT_PACKAGES = {
  "launchdarkly-react-client-sdk",
  "@launchdarkly/react-client-sdk"
}
BROWSER_PACKAGES = {
  "launchdarkly-js-client-sdk",
  "@launchdarkly/js-client-sdk"
}
```

Record:
- Which local names map to `useFlags`, `useLDClient`, `withLDProvider`, `asyncWithLDProvider`, `withLDConsumer`, `LDProvider`, `withFlagUnleashed`
- The surface (`"react"` or `"js-browser"`)
- Emit one `unsupported-sdk` ScanWarning for the file

### Step 2 — Call detection (existing walk)

The existing iterative AST walk already handles `CallExpression` nodes. Extend it:

**Hook calls** (`useFlags()`, `useLDClient()`):
- Match `CallExpression` where callee is one of the tracked hook names
- `flagKey: "*"`, `isDynamic: false`, callType per table above
- `sdkSurface: "react"`, `safelyAutomatable: false`

**HOC calls** (`withLDProvider(config)(App)`, `asyncWithLDProvider(config)`, `withLDConsumer()(Comp)`, `withFlagUnleashed(Comp)`):
- Match outer `CallExpression` where callee is the tracked HOC name (curried or direct)
- `flagKey: "*"`, `isDynamic: false`, callType `"provider"` or `"hoc"`
- `sdkSurface: "react"`, `safelyAutomatable: false`

**JSX provider** (`<LDProvider ...>`):
- Match `JSXOpeningElement` where name matches tracked `LDProvider` local name
- `flagKey: "*"`, `isDynamic: false`, callType `"provider"`
- `sdkSurface: "react"`

**Browser JS client** (`ldClient.variation("key", default)` etc.):
- The browser JS SDK client methods are identical in shape to the server SDK
- Already partially detected if the client variable matches LD_CLIENT_PATTERN
- Distinguish by checking if the import that created the client came from a browser package
- `sdkSurface: "js-browser"`, `safelyAutomatable: false`

### Step 3 — Property access on useFlags() result

```ts
const flags = useFlags();
const enabled = flags["checkout-v2"]; // static string key in bracket notation
const v2 = flags.checkoutV2;          // identifier property access — likely camelCased
```

After detecting a `useFlags()` call, track the local variable name. Walk subsequent `MemberExpression` nodes where the object matches that variable:
- Bracket notation with a string literal: extract as `flagKey`, `isDynamic: false`
- Identifier property: extract as `flagKey` (camelCased), set `flagKeyIsCamelCased: true`
- Dynamic computed key: `isDynamic: true`

Scope tracking is limited to the same function body. Cross-function propagation is not required for v1 — mark as `isDynamic: true` if the variable escapes the local scope.

---

## Component-Context Staleness Implications

The existing staleness signals (keyword match, path pattern, minFileCount) apply structurally to React SDK files the same as server files. However:

1. **Git-history staleness**: React SDK `useFlags()` usages return all flags in one call. There is no per-flag commit history to check. Git staleness signals cannot be applied at the flag-key level for `useFlags()` bulk returns — only at the file level.

2. **minFileCount signal**: Works correctly — counts distinct files importing from React SDK packages.

3. **Path-pattern signal**: Works correctly — matches against the file path.

4. **Keyword signal**: Works correctly — matches against flag key strings found in source, including camelCased variants.

The reporter should note alongside any `useFlags()` usage that per-flag staleness is not available for bulk hook calls.

---

## Fixture List (≥ 12 files required)

Fixtures go in `src/scanner/tests/fixtures/`:

| File | What it tests |
|---|---|
| `ld-react-use-flags.tsx` | `useFlags()` — basic call, property access with string key |
| `ld-react-use-flags-camelcase.tsx` | `useFlags()` — property access via identifier (camelCase trap) |
| `ld-react-use-flags-dynamic.tsx` | `useFlags()` — dynamic computed key access (`flags[keyVar]`) |
| `ld-react-use-ld-client.tsx` | `useLDClient()` — subsequent `.variation()` call with static key |
| `ld-react-with-ld-provider.tsx` | `withLDProvider(config)(App)` HOC pattern |
| `ld-react-async-with-ld-provider.tsx` | `asyncWithLDProvider(config)` — async HOC variant |
| `ld-react-jsx-provider.tsx` | `<LDProvider clientSideID="...">` JSX form |
| `ld-react-with-ld-consumer.tsx` | `withLDConsumer()(MyComponent)` consumer HOC |
| `ld-browser-variation.ts` | `@launchdarkly/js-client-sdk` — `ldClient.variation("key", false)` |
| `ld-react-scoped-import.tsx` | `import * as LD from 'launchdarkly-react-client-sdk'` — namespace import |
| `ld-false-positive-use-flags-swr.tsx` | `useFlags()` from SWR — must NOT be detected as LD |
| `ld-false-positive-use-flags-custom.tsx` | `useFlags()` from a local `./hooks` import — must NOT be detected |
| `ld-false-positive-use-ld-client-name.tsx` | Variable named `ldClient` but not from LD package — must NOT trigger |
| `ld-react-mixed-server-client.tsx` | File importing both server SDK and React SDK — both surfaces detected |

---

## Readiness and Migrator Implications

**Readiness score**: React and browser SDK usages count toward `totalLaunchDarklyUsages` but NOT toward `safelyAutomatableCount`. They always increment `manualReviewCount`. The readiness score formula (`safelyAutomatable / total`) is therefore unaffected structurally — just the denominator grows.

**Migration items**: `MigrationItem.requiresManualReview = true`, `reviewReason = "browser-sdk — OpenFeature React SDK required"` for all React SDK usages.

**OpenFeature React SDK target shape**:

```ts
// Target package: @openfeature/react-sdk
import { useFlag, OpenFeatureProvider, OpenFeature } from "@openfeature/react-sdk";

// Replace useFlags() + property access:
// Before: const { checkoutV2 } = useFlags();
// After:  const { value: checkoutV2 } = useFlag("checkout-v2", false);
// NOTE: original dashboard key must be resolved from camelCase first

// Replace LDProvider:
// Before: <LDProvider clientSideID="..."><App /></LDProvider>
// After:  <OpenFeatureProvider><App /></OpenFeatureProvider>
// (provider config set up separately via OpenFeature.setProvider())
```

The migrator CANNOT auto-generate these rewrites because:
1. camelCase → kebab-case key reversal is lossy (not always reversible)
2. `useFlags()` returns all flags; `useFlag()` takes one key — structural mismatch
3. HOC wrapping patterns differ significantly

All React SDK migration items must appear in the report with concrete manual instructions, not auto-apply diffs.

---

## Docs Warnings to Delete When This Ships

The following notes become obsolete and must be removed from docs when React/browser SDK detection is implemented:

1. `docs-src/content/docs/docs/reference/supported-scope.md` line 12 — the "Browser SDKs, React SDKs, non-Node SDKs" bullet in the "What is never auto-rewritten" section. Replace with: "React and browser SDK usages are detected and reported but always require manual migration (see React SDK support)."

2. `README.md` line 116 — the "Browser SDKs, React SDKs, non-Node SDKs" bullet in the "What is never auto-rewritten" list. Same replacement.

3. `src/scanner/index.ts` line 19 — the comment "MVP scope: inventory Node server-side LaunchDarkly SDK usage" (does not contain the exact phrase but is the in-scope boundary note that should be updated when React/browser detection ships).

Do NOT delete the `flaglint validate --no-direct-launchdarkly` docs note that React SDK calls are not LD server-side calls — that remains accurate for the validator's scope.

---

## Consequences

- `FlagUsage` gains optional `sdkSurface` and `flagKeyIsCamelCased` fields (additive — no breaking change)
- `MigrationManualReviewReason` gains `"browser-sdk"` (additive)
- `ScanWarning` gains `"unsupported-sdk"` kind (additive)
- One new constant set in `src/scanner/index.ts`: `LD_REACT_PACKAGES`, `LD_BROWSER_PACKAGES`
- Fixture count increases by ≥ 14 files
- Readiness score formula unchanged; denominator grows for mixed codebases
- No auto-migration for any React or browser SDK call site — ever
