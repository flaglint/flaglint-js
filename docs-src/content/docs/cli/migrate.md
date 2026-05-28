---
title: flaglint migrate
description: Generate migration plans and guarded OpenFeature call-site rewrites.
lastUpdated: 2026-05-28
---

`flaglint migrate` analyzes supported LaunchDarkly Node.js server SDK evaluation calls and produces an OpenFeature migration plan.

```bash
flaglint migrate [dir] [options]
```

## Examples

```bash
flaglint migrate ./src
flaglint migrate ./src --dry-run
flaglint migrate ./src --apply
flaglint migrate ./src --apply --allow-dirty
flaglint migrate ./src --output MIGRATION.md
```

Dry-run example:

```diff
- const enabled = await ldClient.boolVariation("checkout-v2", ctx, false);
+ const enabled = await openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--output` | `MIGRATION.md` | Write migration plan to a file. |
| `--dry-run` | off | Print reviewable diffs without writing source files. |
| `--apply` | off | Apply only provably automatable transformations in-place. |
| `--allow-dirty` | off | Override the clean git tree guard for `--apply`. |
| `--config` | auto-detect | Path to a config file. |
| `--exclude-tests` | off | Skip test and spec files. |

## Apply Safety Contract

`--apply` only rewrites a call site when all of these are true:

- The call is a supported LaunchDarkly Node.js server SDK evaluation method.
- The flag key is static.
- The value type is known from the SDK method or literal fallback.
- The fallback and evaluation context can be preserved exactly.
- A proven OpenFeature client binding exists in the file.

The OpenFeature client binding may be local:

```ts
import { OpenFeature } from "@openfeature/server-sdk";

const openFeatureClient = OpenFeature.getClient();
```

Or imported from an allowlisted shared module:

```ts
import { openFeatureClient as flags } from "../platform/feature-flags.js";
```

```json
{
  "openFeatureClientBindings": [
    {
      "importName": "openFeatureClient",
      "modulePatterns": ["**/platform/feature-flags"]
    }
  ]
}
```

Aliased imports preserve the local identifier. TypeScript ESM `.js` runtime import specifiers are recognized when the configured `modulePatterns` entry omits `.js`.

## Manual Review

FlagLint does not automatically rewrite dynamic keys, detail evaluations, bulk flag-state calls, unknown fallback types, ambiguous OpenFeature client bindings, browser SDKs, React SDKs, non-Node SDKs, or non-LaunchDarkly providers.
