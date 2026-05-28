---
title: NestJS Guide
description: Use FlagLint with NestJS modules and services.
lastUpdated: 2026-05-28
---

NestJS projects usually place evaluation calls inside injectable services. FlagLint scans the TypeScript source directly; it does not need Nest runtime metadata.

```bash
npx flaglint scan ./src --exclude-tests
npx flaglint migrate ./src --dry-run --exclude-tests
npx flaglint validate ./src --no-direct-launchdarkly --bootstrap-exclude "src/platform/**"
```

Centralize provider setup in a platform module and expose a shared OpenFeature client or service wrapper. Direct LaunchDarkly evaluation calls in application services should migrate behind that boundary.

## Manual Review

Wrappers that take dynamic flag keys should be reviewed manually. Configure wrapper names only when you want them surfaced:

```json
{ "wrappers": ["evaluateFlag", "getFlag"] }
```

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/guides/nestjs.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Monorepos](/docs/guides/monorepos/)
