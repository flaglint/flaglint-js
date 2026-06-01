---
title: GitHub Actions
description: Run FlagLint inventory and policy enforcement in CI.
lastUpdated: 2026-05-28
---

Use `scan` for inventory/reporting and `validate --format sarif` for direct-SDK policy enforcement.

## Inventory Report

```yaml
name: FlagLint Inventory

on: [pull_request]

jobs:
  inventory:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx flaglint scan ./src --format html --output flaglint-inventory.html
```

## Blocking Enforcement with SARIF

```yaml
name: FlagLint Policy

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Validate no direct LaunchDarkly evaluation calls
        id: flaglint
        run: |
          npx flaglint validate ./src \
            --no-direct-launchdarkly \
            --bootstrap-exclude "src/provider/setup.ts" \
            --format sarif \
            --output flaglint-validation.sarif

      - name: Upload validation SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint-validation.sarif
```

Do not set `continue-on-error: true` on the blocking validation step. The job should fail when violations exist. `if: always()` belongs on the upload step so GitHub can still ingest SARIF after the validation step fails.

## Rule ID

```text
flaglint.direct-launchdarkly
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/integrations/github-actions.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [OpenTelemetry](/docs/integrations/opentelemetry/)
