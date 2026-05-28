---
title: Express Guide
description: Apply the standard FlagLint workflow to an Express-style Node.js service.
lastUpdated: 2026-05-28
---

Express services usually keep feature-flag checks inside route handlers or service modules. FlagLint does not require Express-specific integration; point it at the source directory.

```bash
npx flaglint scan ./src
npx flaglint migrate ./src --dry-run
npx flaglint validate ./src --no-direct-launchdarkly
```

Keep provider setup in a central module, then import the OpenFeature client into route/service files.

## Suggested Layout

```text
src/platform/feature-flags.ts
src/routes/checkout.ts
src/services/pricing.ts
```

Use `openFeatureClientBindings` if route files import a shared client.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/guides/express.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [NestJS Guide](/docs/guides/nestjs/)
