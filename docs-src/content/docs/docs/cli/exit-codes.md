---
title: Exit Codes
description: How FlagLint commands signal success and failure.
lastUpdated: 2026-05-28
---

## Common Codes

| Code | Meaning |
| --- | --- |
| `0` | Command completed and no blocking condition was found. |
| `1` | Runtime error, invalid directory, blocking validation failure, dirty tree guard, or configured scan review failure. |
| `2` | Invalid output format argument. |
| `130` | Interrupted with `SIGINT`. |

## Command Notes

- `scan` exits `1` when configured stale/review signals produce blocking candidates.
- `migrate --dry-run` exits `0` after printing a plan.
- `migrate --apply` exits `1` on dirty working tree unless `--allow-dirty` is used.
- `validate --no-direct-launchdarkly` exits `1` when direct LaunchDarkly evaluation calls are found.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/exit-codes.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Express Guide](/docs/guides/express/)
