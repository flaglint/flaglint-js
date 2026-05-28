---
title: flaglint validate
description: Enforce direct LaunchDarkly usage policy in CI.
lastUpdated: 2026-05-28
---

`flaglint validate` checks policy rules after migration. It is the command to use for direct-SDK CI enforcement.

```bash
flaglint validate [dir] [options]
```

## Examples

Report only:

```bash
flaglint validate ./src
```

Fail when direct LaunchDarkly evaluation calls remain:

```bash
flaglint validate ./src --no-direct-launchdarkly
```

Allow a provider/bootstrap file:

```bash
flaglint validate ./src \
  --no-direct-launchdarkly \
  --bootstrap-exclude "src/provider/setup.ts"
```

Emit SARIF:

```bash
flaglint validate ./src \
  --no-direct-launchdarkly \
  --bootstrap-exclude "src/provider/setup.ts" \
  --format sarif \
  --output flaglint-validation.sarif
```

## Output

Pass:

```text
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 42 file(s).
```

Fail:

```text
✗ validate --no-direct-launchdarkly: 2 direct LaunchDarkly evaluation call(s) found.

  src/services/checkout.ts:42:8 — boolVariation("checkout-v2")
  src/services/pricing.ts:17:4 — boolVariation(dynamic key — manual review required)
```

## SARIF

Validation SARIF uses rule id:

```text
flaglint.direct-launchdarkly
```

Each direct LaunchDarkly evaluation call produces a policy finding. Upload the generated SARIF file to GitHub Code Scanning to annotate pull requests.
