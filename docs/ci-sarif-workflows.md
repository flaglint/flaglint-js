# FlagLint — CI and SARIF workflows for platform teams

This page documents how platform teams can integrate FlagLint into GitHub Actions to:

1. Get inventory visibility into every direct LaunchDarkly SDK call (stale flag candidates)
2. Enforce a no-direct-LaunchDarkly policy via GitHub Code Scanning PR annotations
3. Block PR merges when direct LD evaluation calls are introduced

---

## What each command reports

| Command | Exits non-zero when | SARIF level | Rule IDs |
|---------|---------------------|-------------|----------|
| `flaglint scan` | stale flags found | `warning` | `flaglint.keyword`, `flaglint.path`, `flaglint.minFileCount` |
| `flaglint migrate --dry-run` | never (read-only report) | — | — |
| `flaglint validate --no-direct-launchdarkly` | any direct LD eval call found | `error` | `flaglint.direct-launchdarkly` |

### `flaglint scan` — inventory and reporting

Scans source files for every direct LaunchDarkly Node.js server SDK call site. Produces a report in
JSON, Markdown, HTML, or SARIF format. Does not enforce any migration policy.

SARIF output (`--format sarif`) reports **stale flag candidates** — flag usages that triggered
staleness heuristics — as `level: "warning"` findings. These are informational: they do not
block PR merges by default in GitHub Code Scanning unless you add a branch protection rule.

```bash
flaglint scan ./src --format sarif --output flaglint-scan.sarif
```

### `flaglint migrate --dry-run` — migration readiness reporting

Analyzes each LD SDK call site and generates a reviewable before/after diff showing the exact
OpenFeature equivalent. Includes provider setup guidance when a diff needs it. Never modifies files. Never exits non-zero
(it is a read-only report). Use it to plan the migration before running `--apply`.

```bash
flaglint migrate ./src --dry-run
```

### `flaglint validate --no-direct-launchdarkly` — policy enforcement

Scans the codebase and fails (`exit 1`) if any direct LaunchDarkly evaluation call is found
outside the bootstrap-excluded files. This is the CI gate.

SARIF output (`--format sarif`) reports each violation as `level: "error"` with
`ruleId: "flaglint.direct-launchdarkly"`. GitHub Code Scanning treats `error`-level results as
annotations on the PR diff, making them visible to reviewers without running anything locally.

```bash
flaglint validate ./src \
  --no-direct-launchdarkly \
  --bootstrap-exclude "src/platform/feature-flags.ts" \
  --format sarif \
  --output flaglint-validate.sarif
```

---

## SARIF document structure

### Policy-enforcement SARIF (`validate --no-direct-launchdarkly --format sarif`)

```json
{
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "FlagLint",
        "rules": [{
          "id": "flaglint.direct-launchdarkly",
          "name": "DirectLaunchDarklySDKUsage",
          "shortDescription": { "text": "Direct LaunchDarkly SDK evaluation call detected" }
        }]
      }
    },
    "results": [{
      "ruleId": "flaglint.direct-launchdarkly",
      "level": "error",
      "message": {
        "text": "Direct LaunchDarkly SDK call boolVariation(\"checkout-v2\") at src/services/checkout.ts:42. Migrate to OpenFeature using flaglint migrate --dry-run."
      },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "src/services/checkout.ts", "uriBaseId": "%SRCROOT%" },
          "region": { "startLine": 42, "startColumn": 9 }
        }
      }],
      "partialFingerprints": { "flagKey/v1": "checkout-v2" },
      "properties": { "flagKey": "checkout-v2", "callType": "boolVariation", "isDynamic": false }
    }]
  }]
}
```

See [`docs/assets/example-validate-sarif.json`](./assets/example-validate-sarif.json) for a
complete two-violation example.

### Inventory SARIF (`scan --format sarif`)

```json
{
  "results": [{
    "ruleId": "flaglint.keyword",
    "level": "warning",
    "message": {
      "text": "Potentially stale feature flag \"old-checkout-flow\" detected: keyword \"old\"."
    },
    "locations": [...]
  }]
}
```

See [`docs/assets/example-scan-sarif.json`](./assets/example-scan-sarif.json) for a complete
example.

---

## GitHub Actions workflow — Node 20 and 22

This workflow runs on Node.js 20 and 22 (the versions FlagLint supports and validates in CI).

```yaml
name: FlagLint

on:
  pull_request:
  push:
    branches: [main]

jobs:
  flaglint:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    permissions:
      security-events: write   # required for uploading SARIF
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      # ── Step 1: inventory scan — annotate stale flag candidates (warning level) ──
      - name: FlagLint — inventory scan
        run: npx flaglint scan ./src --format sarif --output flaglint-scan.sarif
        continue-on-error: true   # don't fail here; upload SARIF first

      - name: Upload inventory SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint-scan.sarif
          category: flaglint-inventory

      # ── Step 2: policy enforcement — block direct LD calls (error level) ──
      - name: FlagLint — enforce no direct LaunchDarkly evaluations (SARIF)
        run: |
          npx flaglint validate ./src \
            --no-direct-launchdarkly \
            --bootstrap-exclude "src/platform/feature-flags.ts" \
            --format sarif \
            --output flaglint-validate.sarif
        continue-on-error: true   # let upload run even when violations found

      - name: Upload policy-enforcement SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint-validate.sarif
          category: flaglint-policy

      # ── Step 3: CI gate — fail the job when violations exist ──
      - name: FlagLint — enforce no direct LaunchDarkly evaluations (exit code)
        run: |
          npx flaglint validate ./src \
            --no-direct-launchdarkly \
            --bootstrap-exclude "src/platform/feature-flags.ts"
        # exits 1 on violations — blocks PR merge
```

### Why three steps instead of one?

GitHub Code Scanning requires a SARIF upload even when the tool exits non-zero. The pattern is:

1. Run with `--format sarif --output` + `continue-on-error: true` — always produces the SARIF file.
2. Upload the SARIF file — always succeeds because step 1 produced the file.
3. Run without `--format sarif` (text output) — this is the actual CI gate; exits 1 on violations.

This pattern ensures both SARIF annotations *and* a failing job when violations are present.

---

## Minimal enforcement-only workflow

If you only need the CI gate (no SARIF annotations), skip the SARIF steps:

```yaml
- name: FlagLint — enforce no direct LaunchDarkly evaluations
  run: |
    npx flaglint validate ./src \
      --no-direct-launchdarkly \
      --bootstrap-exclude "src/platform/feature-flags.ts"
```

---

## Multiple bootstrap exclusions

Use `--bootstrap-exclude` multiple times for files allowed to import the LaunchDarkly SDK directly
(e.g. your OpenFeature provider setup file):

```yaml
- name: FlagLint — enforce no direct LaunchDarkly evaluations
  run: |
    npx flaglint validate ./src \
      --no-direct-launchdarkly \
      --bootstrap-exclude "src/platform/feature-flags.ts" \
      --bootstrap-exclude "src/platform/feature-flags-legacy.ts" \
      --bootstrap-exclude "src/bootstrap/**"
```

Glob patterns supported:

| Pattern | Matches |
|---------|---------|
| `src/provider/setup.ts` | exact file |
| `src/provider/*.ts` | all `.ts` files in `src/provider/` (one level) |
| `src/bootstrap/**` | all files under `src/bootstrap/` at any depth |
| `src/**/setup.ts` | `setup.ts` at any depth under `src/` |

---

## Suppressing specific violations in GitHub Code Scanning

If a specific call site is intentional and you want to suppress the annotation without adding it to
`--bootstrap-exclude` (which excludes the entire file), use GitHub's code scanning
[alert dismissal](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/dismissing-code-scanning-alerts)
UI to mark the alert as a "won't fix" or "used in tests".

---

## Exit codes reference

| Exit code | Meaning |
|-----------|---------|
| `0` | No violations found (policy passed) |
| `1` | One or more violations found |
| `2` | Invalid CLI option (e.g. unknown `--format`) |
| `130` | Interrupted by SIGINT (Ctrl-C) |
