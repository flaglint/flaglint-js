---
title: JSON Output Reference
description: Machine-readable output contract for flaglint scan --format json. Field definitions, types, and v1.x stability guarantees.
lastUpdated: 2026-06-22
---

FlagLint's `--format json` output is a machine-readable contract intended for CI
pipelines, dashboards, and tooling integrations. This page documents every field
in the output, the stability guarantees across versions, and the baseline file
format.

## v1.x Compatibility Promise

Within the v1.x release series:

- **No field will be renamed, removed, or retyped.** Consumers can rely on
  the shape documented here without version-checking the output.
- **New fields may be added additively.** Parsers must tolerate unknown fields.
  Do not use strict schema validation that rejects unknown keys.
- **Breaking changes require a v2.0 release.** Any removal, rename, or type
  change to an existing field will be signalled by a major version bump and a
  migration guide.

---

## Top-Level ScanResult Object

When you run `flaglint scan --format json`, the output is a single JSON object
with the following shape:

```json
{
  "scannedAt": "2026-06-22T14:30:00.000Z",
  "scanRoot": "src",
  "scannedFiles": 42,
  "totalUsages": 17,
  "uniqueFlags": ["checkout-v2", "payment-provider", "dark-mode"],
  "usages": [ /* FlagUsage[] — see below */ ],
  "scanDurationMs": 312,
  "warnings": []
}
```

| Field | Type | Description |
|---|---|---|
| `scannedAt` | `string` (ISO 8601) | UTC timestamp of when the scan started |
| `scanRoot` | `string` | The directory that was scanned, as passed to the CLI |
| `scannedFiles` | `number` | Total number of files examined |
| `totalUsages` | `number` | Total number of flag call-sites found across all files |
| `uniqueFlags` | `string[]` | Deduplicated list of static flag keys found; dynamic keys (`"*"`) are excluded |
| `usages` | `FlagUsage[]` | One entry per flag call-site; see the [FlagUsage object](#flagusage-object) section |
| `scanDurationMs` | `number` | Wall-clock time of the scan in milliseconds |
| `warnings` | `ScanWarning[]` | Non-fatal issues encountered during the scan (unreadable files, parse failures) |

---

## FlagUsage Object

Each entry in the `usages` array represents one call-site where a LaunchDarkly
SDK method was detected.

```json
{
  "flagKey": "checkout-v2",
  "isDynamic": false,
  "file": "src/checkout/service.ts",
  "line": 42,
  "column": 18,
  "callType": "boolVariation",
  "fingerprint": "launchdarkly:boolVariation:checkout-v2:src/checkout/service.ts",
  "stalenessSignals": [
    { "source": "keyword", "keyword": "remove" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `flagKey` | `string` | The literal flag key string. `"*"` when the key is dynamic (computed at runtime). |
| `isDynamic` | `boolean` | `true` when the flag key is not a static string literal (e.g. a variable or template expression). |
| `file` | `string` | Path to the source file containing this call-site. Always relative to the scan root, forward slashes, no leading `./`. See [file field notes](#file-field-notes). |
| `line` | `number` | 1-based line number of the flag call. |
| `column` | `number` | 0-based column offset of the flag call. |
| `callType` | `CallType` | The SDK method that was called. See [callType values](#calltype-values). |
| `fingerprint` | `string` | Stable identity for this finding, used by baseline mode and SARIF. Added in v1.0.0. See [fingerprint notes](#fingerprint-notes). |
| `stalenessSignals` | `StalenessSignal[]` | Zero or more reasons this flag is considered stale. Empty array means no staleness detected. See [stalenessSignals](#stalenesssignals). |

### file Field Notes

The `file` field is always:

- **Relative to the scan root** — never an absolute path. This makes JSON output
  portable across machines and CI environments.
- **Forward slashes** — even on Windows. Consumers do not need to normalise
  path separators.
- **No leading `./`** — the path starts directly with the directory or file name.

### fingerprint Notes

The `fingerprint` field was added in **v1.0.0** and follows the schema:

```
provider:callType:flagKey:normalizedFilePath
```

For example:

```
launchdarkly:boolVariation:checkout-v2:src/checkout/service.ts
launchdarkly:stringVariation:payment-provider:src/payments/processor.ts
```

For dynamic calls (`isDynamic: true`), a sequential index is appended to
differentiate multiple dynamic calls in the same file:

```
launchdarkly:boolVariation:*:src/service.ts:0
launchdarkly:boolVariation:*:src/service.ts:1
```

Fingerprints are stable across line-number changes (reformatting, added
comments). They change when the flag key, call type, or file path changes.
File renames will produce new fingerprints — re-run `--write-baseline` after
significant refactors.

**Known limitation (v1.0):** If the same `flagKey` is called with the same
`callType` more than once in the same file, both findings share the same
fingerprint. This will be addressed in v1.1 by adding a `containingSymbol`
component.

### callType Values

| Value | SDK Method |
|---|---|
| `"variation"` | `client.variation(key, ctx, default)` |
| `"variationDetail"` | `client.variationDetail(key, ctx, default)` |
| `"boolVariation"` | `client.boolVariation(key, ctx, false)` |
| `"boolVariationDetail"` | `client.boolVariationDetail(key, ctx, false)` |
| `"stringVariation"` | `client.stringVariation(key, ctx, "")` |
| `"stringVariationDetail"` | `client.stringVariationDetail(key, ctx, "")` |
| `"numberVariation"` | `client.numberVariation(key, ctx, 0)` |
| `"numberVariationDetail"` | `client.numberVariationDetail(key, ctx, 0)` |
| `"jsonVariation"` | `client.jsonVariation(key, ctx, {})` |
| `"jsonVariationDetail"` | `client.jsonVariationDetail(key, ctx, {})` |
| `"allFlags"` | `client.allFlags(ctx)` |
| `"allFlagsState"` | `client.allFlagsState(ctx)` |
| `"isFeatureEnabled"` | `client.isFeatureEnabled(key, user)` (legacy) |
| `"hook-useFlags"` | React `useFlags()` hook |
| `"hook-useLDClient"` | React `useLDClient()` hook |
| `"hoc"` | `withLDConsumer()` higher-order component |
| `"provider"` | `<LDProvider>` or `asyncWithLDProvider()` |

### stalenessSignals

Each entry in `stalenessSignals` has a `source` discriminant:

| `source` | Additional fields | Meaning |
|---|---|---|
| `"keyword"` | `keyword: string` | A staleness keyword (e.g. `"remove"`, `"cleanup"`, `"todo"`) was found in a comment or string near the flag call. |
| `"path"` | `pattern: string` | The file path matched a configured stale path pattern (e.g. `legacy/`, `deprecated/`). |
| `"minFileCount"` | `fileCount: number`, `threshold: number` | The flag appears in fewer files than the configured `minFileCount` threshold, suggesting it may be unused. |

An empty `stalenessSignals` array means no staleness was detected for this
call-site. Use `stalenessSignals.length > 0` to check if a finding is stale.

---

## Baseline File Format

The baseline file (written by `flaglint audit --write-baseline <file>`) is a JSON
object that should be committed to source control alongside your code.

```json
{
  "version": 1,
  "createdAt": "2026-06-22T14:30:00.000Z",
  "flaglintVersion": "1.0.0",
  "fingerprints": [
    "launchdarkly:boolVariation:checkout-v2:src/checkout/service.ts",
    "launchdarkly:stringVariation:payment-provider:src/payments/processor.ts"
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `version` | `number` | Baseline schema version. Currently `1`. |
| `createdAt` | `string` (ISO 8601) | UTC timestamp of when the baseline was written. |
| `flaglintVersion` | `string` | The version of FlagLint that wrote the baseline. |
| `fingerprints` | `string[]` | The set of finding fingerprints that are accepted as baseline debt. Findings whose fingerprints match this list are suppressed in subsequent runs. |

The baseline file is typically committed to `.flaglint-baseline.json` at the
repository root. Commit it whenever you accept existing debt as known — for
example, at the start of a migration project, or after a `--apply` run that
resolved some findings.
