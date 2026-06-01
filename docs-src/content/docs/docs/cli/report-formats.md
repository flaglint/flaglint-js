---
title: Report Formats
description: JSON, Markdown, HTML, and SARIF outputs.
lastUpdated: 2026-05-28
---

## Scan Formats

```bash
npx flaglint scan ./src --format json
npx flaglint scan ./src --format markdown
npx flaglint scan ./src --format html --output flaglint-inventory.html
npx flaglint scan ./src --format sarif --output flaglint-inventory.sarif
```

Use scan formats for inventory and review.

## Validation SARIF

Use `validate --format sarif` for direct-SDK policy enforcement:

```bash
npx flaglint validate ./src \
  --no-direct-launchdarkly \
  --format sarif \
  --output flaglint-validation.sarif
```

This is the SARIF output intended for GitHub Code Scanning annotations.

## Migration Reports

```bash
npx flaglint migrate ./src --output MIGRATION.md
npx flaglint migrate ./src --dry-run
```

The default migration report summarizes evidence. Dry-run prints diffs.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/report-formats.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Exit Codes](/docs/cli/exit-codes/)
