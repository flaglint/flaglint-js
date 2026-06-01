---
title: Monorepos
description: Run FlagLint across packages without hiding unsupported scope.
lastUpdated: 2026-05-28
---

For monorepos, start with one Node.js service or package at a time:

```bash
npx flaglint scan ./services/checkout/src --config ./services/checkout/.flaglintrc
npx flaglint migrate ./services/checkout/src --config ./services/checkout/.flaglintrc --dry-run
```

Use package-specific config when import paths, wrapper names, or OpenFeature client bindings differ.

## Example Config

```json
{
  "include": ["**/*.{ts,js}"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/*.test.ts"],
  "openFeatureClientBindings": [
    {
      "importName": "openFeatureClient",
      "modulePatterns": ["**/platform/feature-flags"]
    }
  ]
}
```

Browser SDKs, React SDKs, and non-Node packages are outside current detection coverage.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/guides/monorepos.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Manual Review Patterns](/docs/guides/manual-review-patterns/)
