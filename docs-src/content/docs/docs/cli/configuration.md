---
title: Configuration
description: Configure scan scope, wrappers, and imported OpenFeature client bindings.
lastUpdated: 2026-05-28
---

FlagLint reads the first matching config file from:

```text
.flaglintrc
.flaglintrc.json
flaglint.config.json
```

Use `--config <path>` to pass a specific file.

## Example

```json
{
  "include": ["**/*.{ts,js}"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "provider": "launchdarkly",
  "minFileCount": 0,
  "wrappers": ["evaluateFlag"],
  "openFeatureClientBindings": [
    {
      "importName": "openFeatureClient",
      "modulePatterns": ["**/platform/feature-flags"]
    }
  ]
}
```

## Fields

| Field | Default | Purpose |
| --- | --- | --- |
| `include` | `["**/*.{ts,tsx,js,jsx}"]` | Files to scan. |
| `exclude` | common build/test output | Files to skip. |
| `provider` | `launchdarkly` | Current implemented provider scope. |
| `minFileCount` | `0` | Optional local source review heuristic. |
| `wrappers` | `[]` | Wrapper call names to report for manual review. |
| `openFeatureClientBindings` | `[]` | Imported shared client allowlist for `migrate --apply`. |
| `reportTitle` | unset | Optional report title. |
| `outputDir` | `.` | Reserved CLI output setting. |

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/cli/configuration.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Report Formats](/docs/cli/report-formats/)
