---
title: flaglint validate
description: Enforce no-direct-LaunchDarkly policy, baseline-aware CI enforcement, and SARIF findings.
lastUpdated: 2026-06-22
---

`flaglint validate` checks whether source files comply with migration policy.

## Options

| Option | Description |
| --- | --- |
| `--no-direct-launchdarkly` | Fail if any direct LaunchDarkly Node server SDK evaluation calls are found. |
| `--bootstrap-exclude <glob>` | Glob pattern for files allowed to use the LaunchDarkly SDK directly (repeatable). |
| `--format text` | Output as human-readable text (default). |
| `--format sarif` | Output as SARIF for GitHub Code Scanning. |
| `--output <file>` | Write report to a file instead of stdout. |
| `--config <path>` | Use an explicit config file. |
| `--baseline <file>` | Baseline file for comparing against known debt. |
| `--fail-on-new` | Exit 1 if any findings are not in the baseline. |

## Blocking Policy Command

```bash
npx flaglint validate ./src --no-direct-launchdarkly
```

Fail output from the enterprise demo migration-in-progress state:

```text
✗ validate --no-direct-launchdarkly: 20 direct LaunchDarkly evaluation call(s) found.

  checkout.ts:40:9 — boolVariation("checkout-v2")
  pricing.ts:46:9 — numberVariation("discount-percentage")

These files must migrate to OpenFeature before this rule passes.
Run `flaglint migrate --dry-run` to review the migration plan.
```

Pass output from the completed demo state:

```text
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

## Baseline Mode

Use `--baseline` with `--fail-on-new` to adopt `validate` in CI before all
existing debt is resolved. Only findings whose fingerprints are absent from the
baseline file cause a failure:

```bash
# Write current findings as the accepted baseline
npx flaglint audit ./src --write-baseline .flaglint-baseline.json

# In CI: fail only on findings not in the baseline
npx flaglint validate ./src \
  --no-direct-launchdarkly \
  --baseline .flaglint-baseline.json \
  --fail-on-new
```

Commit `.flaglint-baseline.json` to source control. Re-run `--write-baseline`
when you accept new debt or after a `migrate --apply` run resolves findings.
See the [JSON Output Reference](/docs/reference/json-output/) for the baseline file format.

## SARIF

```bash
npx flaglint validate ./src \
  --no-direct-launchdarkly \
  --format sarif \
  --output flaglint-validation.sarif
```

SARIF findings use rule id `flaglint.direct-launchdarkly`.

## Bootstrap Exclusions

Use `--bootstrap-exclude` for files that are allowed to wire the provider:

```bash
npx flaglint validate ./src \
  --no-direct-launchdarkly \
  --bootstrap-exclude "src/provider/setup.ts"
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | No policy violations found. |
| `1` | Direct LaunchDarkly calls found (with `--no-direct-launchdarkly`); or new findings beyond baseline (with `--fail-on-new`). |
| `2` | Invalid `--format` value; missing or malformed baseline file. |

## Further Reading

- [LaunchDarkly-to-OpenFeature Node.js migration guide](/docs/guides/launchdarkly-to-openfeature-nodejs/) — see how to enforce the OpenFeature boundary after a full migration
- [Exit Codes reference](/docs/reference/exit-codes/) — full stable exit code contract for v1.x
- [JSON Output Reference](/docs/reference/json-output/) — baseline file format

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/cli/validate.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Configuration](/docs/cli/configuration/)
