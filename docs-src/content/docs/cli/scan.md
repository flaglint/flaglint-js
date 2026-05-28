---
title: flaglint scan
description: Inventory supported LaunchDarkly Node.js server SDK evaluation calls.
lastUpdated: 2026-05-28
---

`flaglint scan` performs AST-based inventory of supported direct LaunchDarkly Node.js server SDK calls.

```bash
flaglint scan [dir] [options]
```

## Examples

```bash
flaglint scan ./src
flaglint scan ./src --format json --output report.json
flaglint scan ./src --format markdown --output report.md
flaglint scan ./src --format html --output report.html
flaglint scan ./src --format sarif --output inventory.sarif
```

Example output:

```text
✓ 18 flag usages found across 6 unique flags (61ms)
ℹ  3 dynamic flag key(s) require manual review
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--format` | `markdown` | Output format: `json`, `markdown`, `html`, or `sarif`. |
| `--output` | stdout | Write report to a file. |
| `--config` | auto-detect | Path to a config file. |
| `--exclude-tests` | off | Exclude test files from scan results. |

## JSON Shape

```json
{
  "flagKey": "checkout-v2",
  "isDynamic": false,
  "file": "src/services/checkout.ts",
  "line": 14,
  "callType": "boolVariation",
  "stalenessSignals": []
}
```

## Notes

`scan --format sarif` is inventory SARIF. For direct-SDK policy enforcement in CI, use [`flaglint validate --format sarif`](/docs/cli/validate/).
