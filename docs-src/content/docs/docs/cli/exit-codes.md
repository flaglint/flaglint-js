---
title: Exit Codes
description: Stable exit code contract for FlagLint v1.x — 0=success, 1=policy failure, 2=invalid input, 3=internal error.
lastUpdated: 2026-06-22
---

FlagLint uses a stable, machine-readable exit code contract guaranteed across all v1.x releases.
See the [full Exit Codes reference](/docs/reference/exit-codes/) for CI examples and rationale.

## Exit Code Table

| Code | Meaning | When it occurs |
| --- | --- | --- |
| `0` | Success — no blocking failures. | Scan completed; no policy violations found. |
| `1` | Policy or validation failure. | `validate --no-direct-launchdarkly` found direct LD calls; new findings beyond baseline (`--fail-on-new`); dirty working tree without `--allow-dirty`. |
| `2` | Invalid input. | Bad `--format` value; missing or malformed baseline or config file. |
| `3` | Internal FlagLint error. | Unexpected runtime exception in FlagLint itself. |
| `130` | Interrupted with `SIGINT` (Ctrl-C). | |

## Command Notes

- `audit` always exits `0` — it is informational only.
- `scan` exits `1` when configured stale/review signals produce blocking candidates.
- `migrate --dry-run` exits `0` after printing a plan.
- `migrate --apply` exits `1` on a dirty working tree unless `--allow-dirty` is used.
- `validate --no-direct-launchdarkly` exits `1` when direct LaunchDarkly evaluation calls are found.
- `validate --baseline <file> --fail-on-new` exits `1` when any finding fingerprint is absent from the baseline.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/cli/exit-codes.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- See also: [Exit Codes reference](/docs/reference/exit-codes/)
- Next: [Express Guide](/docs/guides/express/)
