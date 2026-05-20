# FlagLint

**Find stale feature flags. Detect flag debt. Plan your OpenFeature migration.**

[![CI](https://github.com/flaglint/flaglint/actions/workflows/ci.yml/badge.svg)](https://github.com/flaglint/flaglint/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/flaglint.svg)](https://www.npmjs.com/package/flaglint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The problem

LaunchDarkly flags accumulate. Teams add them, forget to clean them up, and gradually build flag debt — dead code paths controlled by flags nobody manages. When you finally want to migrate to OpenFeature, you don't even know what you have.

**FlagLint fixes this.** It scans your codebase, maps every flag usage, identifies stale candidates, and generates a step-by-step OpenFeature migration plan.

---

## Quick start

```bash
npx flaglint scan
```

---

## Installation

```bash
npm install -g flaglint
# or use without installing
npx flaglint
```

---

## Commands

### `flaglint scan [dir]`

Scans a directory for LaunchDarkly SDK usage.

```bash
flaglint scan ./src
flaglint scan --format json --output report.json
flaglint scan --format html --output report.html
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format` | `markdown` | Output format: `json`, `markdown`, `html` |
| `--output` | stdout | Write report to file |
| `--config` | auto-detect | Path to `.flaglintrc` |

Exit code `0` when no stale flags found, `1` when stale flags exist — enabling CI blocking.

---

### `flaglint migrate [dir]`

Analyzes migration readiness and generates an OpenFeature migration plan.

```bash
flaglint migrate ./src
flaglint migrate --dry-run
flaglint migrate --output MIGRATION.md
```

| Option | Default | Description |
|--------|---------|-------------|
| `--output` | `MIGRATION.md` | Write migration plan to file |
| `--dry-run` | — | Print plan to stdout, do not write file |
| `--config` | auto-detect | Path to `.flaglintrc` |

---

## Configuration

Create `.flaglintrc` in your project root:

```json
{
  "include": ["**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "provider": "launchdarkly",
  "staleThreshold": 1,
  "reportTitle": "My Project Flag Report"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `include` | `string[]` | `["**/*.{ts,tsx,js,jsx}"]` | Glob patterns to scan |
| `exclude` | `string[]` | `["**/node_modules/**", ...]` | Glob patterns to ignore |
| `provider` | `string` | `"launchdarkly"` | Feature flag provider |
| `staleThreshold` | `number` | `1` | Days before a flag is considered stale |
| `reportTitle` | `string` | — | Custom title for generated reports |
| `outputDir` | `string` | `"."` | Default output directory |

FlagLint searches for config in this order: `--config` flag → `.flaglintrc` → `.flaglintrc.json` → `flaglint.config.json`.

---

## CI Integration

```yaml
- name: Check for stale flags
  run: npx flaglint scan --format json --output flaglint-report.json
  # exits 1 if stale flags found, blocking the PR
```

---

## What FlagLint detects

- `ldClient.variation()` and `ldClient.variationDetail()`
- `ldClient.allFlags()`
- `useFlags()`, `useLDClient()` React hooks
- `<LDProvider>` and `withLDConsumer()` patterns
- Dynamic flag keys (runtime-determined, flagged for manual review)

All detections include the **file path**, **line number**, **call type**, and a **stale heuristic** based on key names and file locations.

---

## OpenFeature Migration

[OpenFeature](https://openfeature.dev) is the vendor-neutral standard for feature flagging (CNCF project). `flaglint migrate` maps your LaunchDarkly SDK calls to OpenFeature equivalents and generates an actionable `MIGRATION.md`:

| LaunchDarkly | OpenFeature |
|---|---|
| `ldClient.variation(key, ctx, false)` | `client.getBooleanValue(key, false, ctx)` |
| `ldClient.variationDetail(key, ctx, def)` | `client.getBooleanDetails(key, def, ctx)` |
| `useFlags()` | `useFlag(key)` per flag |
| `useLDClient()` | `useOpenFeatureClient()` |
| `<LDProvider>` | `<OpenFeatureProvider provider={...}>` |
| `withLDConsumer()(Component)` | `withOpenFeature()(Component)` |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](./LICENSE).
