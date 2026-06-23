---
title: GitHub Actions
description: Add FlagLint LaunchDarkly enforcement to any GitHub Actions workflow with two lines of YAML.
lastUpdated: 2026-06-20
---

FlagLint publishes a reusable [GitHub Actions composite action](https://github.com/flaglint/flaglint) so you can enforce LaunchDarkly SDK policies in CI without writing boilerplate setup steps.

## Zero-Config Usage

Add these two lines to any workflow job that has already checked out your code:

```yaml
- uses: flaglint/flaglint@main
  with:
    directory: ./src
```

This runs `flaglint validate ./src --no-direct-launchdarkly` and fails the job if any direct LaunchDarkly SDK evaluation calls are found.

## Full Options

| Input | Default | Description |
|---|---|---|
| `directory` | `.` | Directory to scan |
| `command` | `validate` | FlagLint command: `validate`, `scan`, or `audit` |
| `extra-args` | `""` | Additional CLI flags passed verbatim to flaglint |
| `node-version` | `'20'` | Node.js version used by `actions/setup-node@v4` |

## Example: Blocking Enforcement

```yaml
name: FlagLint Policy

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: flaglint/flaglint@main
        with:
          directory: ./src
```

## Example: SARIF Upload for GitHub Code Scanning

SARIF output requires `--format sarif` (passed via `extra-args`) and the `security-events: write` permission. After the validation step emits a `.sarif` file, upload it with `github/codeql-action/upload-sarif`.

```yaml
name: FlagLint Policy (SARIF)

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Validate no direct LaunchDarkly evaluation calls
        id: flaglint
        uses: flaglint/flaglint@main
        with:
          directory: ./src
          extra-args: >-
            --bootstrap-exclude "src/provider/setup.ts"
            --format sarif
            --output flaglint-validation.sarif

      - name: Upload validation SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint-validation.sarif
```

Do not set `continue-on-error: true` on the FlagLint step. The job should fail when violations exist. `if: always()` belongs on the upload step so GitHub can still ingest SARIF even after a validation failure.

## Rule ID

```text
flaglint.direct-launchdarkly
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/integrations/github-actions.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- See also: [validate command](/docs/cli/validate/)
- Next: [OpenTelemetry](/docs/integrations/opentelemetry/)
