---
title: flaglint scan
description: Inventory supported LaunchDarkly Node.js server SDK evaluation calls.
lastUpdated: 2026-05-28
---

`flaglint scan` performs AST-based inventory of supported direct LaunchDarkly Node.js server SDK calls.

## Command

```bash
npx flaglint scan ./src
```

## Options

| Option | Description |
| --- | --- |
| `--format json` | Write structured JSON. |
| `--format markdown` | Write a Markdown report. |
| `--format html` | Write an HTML report. |
| `--format sarif` | Write inventory SARIF. Use `validate --format sarif` for policy enforcement. |
| `--output <file>` | Write report to a file. |
| `--config <path>` | Use an explicit config file. |
| `--exclude-tests` | Exclude test/spec files and test directories. |

## Example Output

Generated from `examples/enterprise-checkout-service/src`:

```text
- Scanning ./examples/enterprise-checkout-service/src...
✓ 20 flag usages found across 11 unique flags (90ms)
ℹ  1 dynamic flag key(s) require manual review
```

## Markdown Report Excerpt

```text
## Usages by File
### checkout.ts
- Line 40: `checkout-v2` (boolVariation)
- Line 49: `payment-provider` (stringVariation)
- Line 58: `one-click-checkout` (boolVariation)
- Line 67: `checkout-currency` (stringVariation)
```

## Exit Behavior

`scan` exits `1` only when configured review signals mark non-dynamic, non-bulk flags as stale candidates. A one-file flag is not stale by default because `minFileCount` defaults to `0`.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/scan.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [migrate CLI](/docs/cli/migrate/)
