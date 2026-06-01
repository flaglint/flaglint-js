---
title: Shared Client Architecture
description: Configure FlagLint for teams that import one shared OpenFeature client.
lastUpdated: 2026-05-28
---

Mid-sized Node.js codebases usually initialize OpenFeature once and import a shared client into service files.

```text
platform/feature-flags.ts
  exports openFeatureClient

src/checkout.ts
  imports openFeatureClient
  calls openFeatureClient.getBooleanValue(...)
```

## Supported Binding Patterns

```ts
import { openFeatureClient } from "../platform/feature-flags.js";
```

```ts
import { openFeatureClient as flags } from "../platform/feature-flags.js";
```

```ts
const openFeatureClient = OpenFeature.getClient();
```

Aliased imports preserve the local identifier in dry-run and apply output.

## Configuration

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

Ambiguous or unconfigured bindings are skipped. FlagLint does not guess that an arbitrary imported identifier is an OpenFeature client.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/tutorials/shared-client-architecture.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [How FlagLint Works](/docs/concepts/how-flaglint-works/)
