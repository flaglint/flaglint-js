---
# ADR 010 — Exit Code Contract

**Date:** 2026-06-30
**Status:** ACCEPTED

## Context

FlagLint is used in CI pipelines and shell scripts. Exit codes are the primary
machine-readable output: they determine whether a pipeline step passes or fails.
Without a documented, stable contract, any change to exit codes is a silent
breaking change for every team using the tool in CI.

The exit code contract was partially documented in the CHANGELOG (v0.6.0) and
partially in ADR 008 (baseline mode). Neither document captures the full contract
in one place. flaglint-go must implement exactly the same exit codes to ensure
that baseline files, CI configurations, and shell scripts work identically across
implementations.

## Decision

The following exit codes are the public API of FlagLint. They apply to all
commands unless a command-specific exception is noted.

| Code  | Name            | Meaning                                                                 |
|-------|-----------------|-------------------------------------------------------------------------|
| `0`   | Success         | Command completed successfully; no policy violations or new findings    |
| `1`   | Policy failure  | `validate` found violations; `validate --fail-on-new` found new findings beyond baseline; directory not found or not a directory |
| `2`   | Invalid input   | Invalid `--format` value; invalid `--hourly-rate`; missing or malformed `--baseline` file; unsupported baseline version; config file parse error |
| `3`   | Internal error  | Unexpected error that is not caused by user input (reserved; not currently produced in practice) |
| `130` | SIGINT          | Process received Ctrl-C (shell convention: 128 + signal number 2)      |

### Command-specific notes

**`flaglint scan`**
- Always exits `0` on successful completion, even if stale flags are found.
  Stale heuristics are informational; enforcement exit codes belong only in `validate`.
- Exits `1` only if the target directory is not found or not a directory.
- Exits `2` on invalid `--format`.

**`flaglint audit`**
- Always exits `0` on successful completion.
- Exits `1` only if the target directory is not found or not a directory.
- Exits `2` on invalid `--format` or invalid `--hourly-rate`.

**`flaglint migrate`**
- Exits `0` on all successful outcomes (plan written, `--dry-run` complete, `--apply` complete).
- Exits `1` on `--apply` with a dirty git working tree (without `--allow-dirty`).
- Exits `1` if the target directory is not found or not a directory.

**`flaglint validate`**
- Exits `0` when all enabled policy checks pass.
- Exits `1` when any enabled policy check fails (e.g. `--no-direct-launchdarkly` finds violations).
- Exits `1` when `--fail-on-new` detects fingerprints not present in the baseline.
- Exits `2` on invalid `--format`, missing baseline file, malformed baseline JSON, or unsupported baseline version.

## Stability guarantee

Exit codes `0`, `1`, `2`, and `130` are stable across all v1.x releases.
Code `3` is reserved and may be produced in future releases for internal errors
that are currently surfaced as code `1`.

Any change to this contract requires a new ADR and a major version bump.

## Cross-implementation requirement

flaglint-go must implement this contract exactly. A baseline file written by
flaglint-js and consumed by flaglint-go (or vice versa) must produce identical
exit codes for the same codebase and configuration. This is the behavioral
contract that makes the two implementations interchangeable in CI.

## Consequences

- Callers can rely on `[ $? -eq 0 ]` for success, `[ $? -eq 1 ]` for violations,
  and `[ $? -eq 2 ]` for configuration errors in shell scripts.
- The distinction between code `1` (policy failure) and code `2` (bad input) lets
  CI systems distinguish "this code has violations" from "the tool is misconfigured"
  and surface appropriate failure messages.
- Code `3` being reserved means future internal error handling can be added without
  breaking scripts that currently treat any non-zero exit as a failure.
