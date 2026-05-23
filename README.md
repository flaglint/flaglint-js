<p align="center">
  <img src="docs/assets/logo.png" alt="FlagLint" width="400" />
</p>

<p align="center">
  <strong>Your LaunchDarkly codebase has flag debt. FlagLint tells you exactly what and where.</strong>
</p>

<p align="center">
  <a href="https://github.com/flaglint/flaglint/actions/workflows/ci.yml">
    <img src="https://github.com/flaglint/flaglint/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://www.npmjs.com/package/flaglint">
    <img src="https://img.shields.io/npm/v/flaglint.svg" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/flaglint">
    <img src="https://img.shields.io/npm/dm/flaglint.svg" alt="downloads" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License" />
  </a>
</p>


# FlagLint

Find zombie flags. Eliminate flag debt. Generate your OpenFeature
migration plan.

---

## The problem

LaunchDarkly flags accumulate. Teams add them, forget to clean them up, and gradually build flag debt — dead code paths controlled by flags nobody manages. When you finally want to migrate to OpenFeature, you don't even know what you have.

Like Uber's Piranha — for any JS/TS codebase.

**FlagLint fixes this.** It scans your codebase, maps every flag usage, identifies stale candidates, and generates a step-by-step OpenFeature migration plan.

---

## Quick start

```bash
npx flaglint scan
```

Example output:

```text
✓ 15 flag usages found across 6 unique flags (48ms)
⚠  5 potentially stale flag(s) — review recommended
ℹ  1 dynamic flag key(s) require manual review
```

Markdown report excerpt:

```markdown
## Flag Inventory
| Flag Key | Usages | Files | Call Types | Status |
|----------|--------|-------|------------|--------|
| show-banner | 1 | 1 | variation | ✓ Active |
| old-checkout | 1 | 1 | variation | ⚠ Stale |
| temp-debug-mode | 1 | 1 | variation | ⚠ Stale |

## ⚠ Stale Flag Candidates
| Flag Key | Reason | Location |
|----------|--------|----------|
| old-checkout | Contains "old" in key | ld-stale.ts:1 |
```

### JSON output (`--format json`)

Pipe-friendly. Every usage includes file, line, call type,
and structured staleness signals:

```json
{
  "flagKey": "old-checkout",
  "isDynamic": false,
  "file": "src/components/Checkout.tsx",
  "line": 14,
  "callType": "variation",
  "stalenessSignals": [
    { "source": "keyword", "keyword": "old" },
    { "source": "minFileCount", "fileCount": 1, "threshold": 1 }
  ]
}
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
flaglint scan --format sarif --output flaglint.sarif
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format` | `markdown` | Output format: `json`, `markdown`, `html`, `sarif` |
| `--output` | stdout | Write report to file |
| `--config` | auto-detect | Path to a config file |
| `--exclude-tests` | — | Exclude test files from scan results |

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
| `--config` | auto-detect | Path to a config file |

---

## Configuration

Create `.flaglintrc`, `.flaglintrc.json`, or `flaglint.config.json` in your project root:

```json
{
  "include": ["**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "provider": "launchdarkly",
  "minFileCount": 1,
  "reportTitle": "My Project Flag Report"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `include` | `string[]` | `["**/*.{ts,tsx,js,jsx}"]` | Glob patterns to scan |
| `exclude` | `string[]` | `["**/node_modules/**", ...]` | Glob patterns to ignore |
| `provider` | `string` | `"launchdarkly"` | Feature flag provider |
| `minFileCount` | `number` | `1` | A flag is stale if it appears in ≤ N files (default: 1) |
| `wrappers` | `string[]` | `[]` | Function names that wrap LD SDK calls. FlagLint will detect calls to these functions as flag usages. Example: `["flagPredicate", "useFlag", "getFlag", "isEnabled"]` |
| `reportTitle` | `string` | — | Custom title for generated reports |
| `outputDir` | `string` | `"."` | Default output directory |

FlagLint searches for config in this order: `--config` path → `.flaglintrc` → `.flaglintrc.json` → `flaglint.config.json`.

---

## CI Integration

### Basic — block PRs on stale flags

```yaml
- name: Check for stale flags
  run: npx flaglint scan --format json --output flaglint-report.json
  # exits 1 if stale flags found, blocking the PR
```

### GitHub PR annotations via SARIF

Stale flags appear as warnings directly in the PR diff —
no dashboard, no separate tool.

```yaml
name: FlagLint
on: [pull_request]

jobs:
  flaglint:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Scan for flag debt
        run: npx flaglint scan --format sarif --output flaglint.sarif
        continue-on-error: true
      - name: Upload to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint.sarif
```

Stale flags show up as Code Scanning alerts on the exact file
and line where the flag is used — reviewers see them in the PR
without running anything locally.

---

## What FlagLint detects

- `ldClient.variation()` and `ldClient.variationDetail()`
- `ldClient.allFlags()`
- `useFlags()`, `useLDClient()` React hooks
- `<LDProvider>` and `withLDConsumer()` patterns
- Custom wrapper calls such as `flagPredicate("my-flag", false)` when configured with `wrappers`
- Dynamic flag keys (runtime-determined, flagged for manual review)

All detections include the **file path**, **line number**, **call type**, and staleness signals based on key names, file locations, and low file counts.

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

## Free flag debt audit

Running this on a real codebase?
[Book a free 30-minute audit →](https://flaglint.dev#waitlist)
I'll run FlagLint on your repo and walk you through the results.

---

## License

MIT — see [LICENSE](./LICENSE).
