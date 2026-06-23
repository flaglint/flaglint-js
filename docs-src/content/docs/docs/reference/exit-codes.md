---
title: Exit Codes
description: Stable exit code contract for FlagLint v1.x — use these codes in CI to distinguish policy failures from tool errors.
lastUpdated: 2026-06-22
---

FlagLint follows a stable, machine-readable exit code contract. These codes are
guaranteed stable across v1.x and are safe to use in CI pipelines.

## Exit Code Table

| Code | Meaning | When it occurs |
|------|---------|----------------|
| `0` | Success — no blocking failures | Scan completed; no policy violations found; no stale flags detected (or stale flags found but no policy gate triggered) |
| `1` | Policy or validation failure | `flaglint validate --no-direct-launchdarkly` found direct LD calls; stale flags detected by `flaglint scan`; directory not found |
| `2` | Invalid input | Bad `--format` value; missing or malformed baseline; bad or unparseable config file (`.flaglintrc`) |
| `3` | Internal FlagLint error | Unexpected runtime exception in FlagLint itself; not expected in normal use |

**SIGINT (Ctrl-C):** FlagLint exits with code `130` when interrupted.

## Why exit 1 does not mean the tool crashed

Exit code `1` means **FlagLint ran successfully and found a policy violation** — not
that the tool failed. This distinction matters in CI logs:

- `exit 1` → FlagLint worked correctly; your code has a flag debt issue to fix.
- `exit 2` → You passed a bad argument; fix the command invocation.
- `exit 3` → FlagLint itself hit an unexpected error; please file a bug report.

This matches the POSIX convention used by linters such as ESLint (exit 1 = lint
errors found) and allows CI steps to distinguish tool failure from policy failure
without parsing stdout.

## CI YAML example

The following GitHub Actions workflow runs `flaglint validate` as a policy gate.
It expects exit 0 (clean) or exit 1 (violations found), and treats any other exit
code as a tool misconfiguration or internal error.

```yaml
name: FlagLint Policy Gate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  flaglint-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install FlagLint
        run: npm install -g flaglint

      # Exit 0 → no direct LD calls (clean).
      # Exit 1 → direct LD calls found (policy violation — fail the build).
      # Exit 2 → bad --format or config error (fix the workflow invocation).
      - name: Validate no direct LaunchDarkly calls
        run: flaglint validate ./src --no-direct-launchdarkly

      # Optional: emit SARIF for GitHub Code Scanning annotations
      - name: Validate (SARIF output)
        if: always()
        run: flaglint validate ./src --no-direct-launchdarkly --format sarif --output flaglint.sarif
        continue-on-error: true

      - name: Upload SARIF to GitHub Code Scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint.sarif
```

See the [GitHub Actions integration guide](/docs/integrations/github-actions/) and
the [`validate` command reference](/docs/cli/validate/) for the full set of options
including `--bootstrap-exclude` for allowing provider setup files.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/reference/exit-codes.md)
- [Report an issue](https://github.com/flaglint/flaglint/issues/new)
- Next: [FAQ](/docs/reference/faq/)
