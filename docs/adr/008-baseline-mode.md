---
# ADR 008 — Baseline Mode for CI Adoption

**Date:** 2026-06-22
**Status:** ACCEPTED

## Context

Teams with existing flag debt cannot adopt strict CI gates on day one. Blocking
every CI run on pre-existing debt creates an all-or-nothing adoption barrier —
the team must clean up all historical debt before they can get any value from
enforcement.

This pattern is well-established in the static analysis ecosystem:
- **ESLint** — `--quiet` suppresses warnings; per-rule `warn` vs `error` levels
- **Semgrep** — `--baseline-commit` ignores findings present before a commit
- **SonarQube** — "New Code" period isolates findings introduced since a branch point

FlagLint needs an equivalent: freeze current debt in a committed baseline file,
then fail CI only on findings that were not present when the baseline was written.

## Decision

Introduce **baseline mode** via two new flags:

### Writing a baseline

```
flaglint audit ./src --write-baseline flaglint-baseline.json
```

Runs a normal audit, then writes all current finding fingerprints to
`flaglint-baseline.json`. The file should be committed to source control.

### Enforcing against a baseline

```
flaglint validate ./src --baseline flaglint-baseline.json --fail-on-new
```

Loads the baseline, compares current findings against it, and fails CI
(exit code 1) only for findings whose fingerprint is **not** present in the
baseline. `--baseline` without `--fail-on-new` provides context-only output
without CI enforcement.

## Baseline File Format (version 1)

```json
{
  "version": "1",
  "createdAt": "2026-06-22T14:00:00.000Z",
  "flaglintVersion": "1.0.0",
  "fingerprints": [
    "abc123def456",
    "789ghi012jkl"
  ]
}
```

| Field            | Type     | Description                                        |
|------------------|----------|----------------------------------------------------|
| `version`        | string   | Schema version; currently always `"1"` (string, not number) |
| `createdAt`      | string   | ISO 8601 timestamp of when the baseline was written|
| `flaglintVersion`| string   | FlagLint version used to create the baseline       |
| `fingerprints`   | string[] | Stable finding fingerprints (from ADR 007)         |

The `version` field allows future schema changes without breaking consumers that
check it before parsing.

## Behavior Table

| Scenario                                     | Behavior                                               |
|----------------------------------------------|--------------------------------------------------------|
| Finding IS in baseline                       | Reported in output; does **not** cause CI failure      |
| Finding is NOT in baseline                   | Reported; causes exit code 1 with `--fail-on-new`      |
| Fingerprint in baseline has no current match | Silently ignored (finding was cleaned up)              |
| `--baseline` present, `--fail-on-new` absent | Baseline loaded for context only; exit 0               |
| Baseline file missing                        | Exit code 2 with descriptive error message             |
| Baseline file is malformed JSON              | Exit code 2 with descriptive error message             |
| Baseline file has wrong `version` value      | Exit code 2 with descriptive error message             |

## File-Move Edge Case

Fingerprints (ADR 007) include the file path relative to the scan root. Moving
a file changes its path, which changes its fingerprint. From the baseline's
perspective, the old finding was cleaned up and a new finding was introduced.

**Documented behavior:** after any significant refactor or file move, re-run
`--write-baseline` to capture the updated fingerprints and commit the new
baseline file. Teams should treat baseline regeneration as part of their
cleanup sprint workflow.

## Exit Code Contract

| Code | Meaning                                               |
|------|-------------------------------------------------------|
| `0`  | Success — no new findings (or `--fail-on-new` absent) |
| `1`  | New findings detected with `--fail-on-new`            |
| `2`  | Invalid baseline — missing file, malformed JSON, wrong version |
| `3`  | Internal error                                        |

This extends the existing exit code contract (code 2 for invalid `--format`,
code 130 for SIGINT) without conflicting with it.

## Baseline File Evolution

The `version` field allows future changes to the baseline schema. Consumers
must read and validate `version` before parsing `fingerprints`. When the schema
changes, the version string increments (e.g. `"1"` → `"2"`). Older baseline
files with an unrecognised version exit with code 2, prompting the user to
regenerate the baseline. The value is always a **string**, not a number — this
is intentional so that the check `obj["version"] !== "1"` is a simple strict
equality test with no JSON number coercion surprises.

## Implementation

- New module: `src/baseline.ts`
  - `readBaseline(path)` — reads, validates, and parses a baseline file; throws
    on missing file, malformed JSON, or wrong version
  - `writeBaseline(path, fingerprints, meta)` — serialises and writes a baseline
    file atomically
  - `diffFindings(current, baseline)` — returns `{new: string[], existing: string[]}`
- `flaglint audit` — gains `--write-baseline <file>` option (implemented in
  `src/commands/scan.ts`)
- `flaglint validate` — gains `--baseline <file>` and `--fail-on-new` options
  (implemented in `src/commands/validate.ts`)
- No changes to core scanner or reporter modules

## Consequences

### Positive

- **Day-one CI adoption** — teams can add FlagLint to CI immediately without
  first cleaning up historical debt.
- **Incremental improvement** — each cleanup sprint shrinks the baseline; new
  debt is always blocked.
- **Transparent history** — the committed baseline file shows exactly what debt
  was present when enforcement started.

### Negative / Trade-offs

- **File moves require baseline regeneration** — this is a known rough edge and
  is documented above.
- **`--fail-on-new` is opt-in** — teams that omit it get no CI enforcement even
  with `--baseline`. This is intentional (progressive adoption), but requires
  documentation emphasis.
- **Baseline can go stale** — after a large cleanup sprint the team must
  remember to regenerate and commit the baseline; otherwise old fingerprints
  accumulate silently. Recommend adding baseline regeneration to sprint
  definition-of-done.
