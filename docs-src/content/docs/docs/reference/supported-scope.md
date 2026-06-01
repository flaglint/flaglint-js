---
title: Supported Scope
description: What FlagLint detects, migrates, reports for manual review, and excludes.
lastUpdated: 2026-05-28
---

FlagLint currently supports LaunchDarkly Node.js server-side SDK evaluation calls in JavaScript and TypeScript from:

- `@launchdarkly/node-server-sdk`
- legacy `launchdarkly-node-server-sdk`

Browser SDKs, React SDKs, non-Node SDKs, and non-LaunchDarkly providers are outside current detection coverage and do not appear in reports.

## API Coverage

| Pattern | Scan | Apply | Manual Review | Unsupported |
| --- | --- | --- | --- | --- |
| `variation("key", ctx, false)` with literal fallback | Yes | Yes, when type and OpenFeature binding are proven | No | No |
| `boolVariation("key", ctx, false)` | Yes | Yes, when OpenFeature binding is proven | No | No |
| `stringVariation("key", ctx, "control")` | Yes | Yes, when OpenFeature binding is proven | No | No |
| `numberVariation("key", ctx, 100)` | Yes | Yes, when OpenFeature binding is proven | No | No |
| `jsonVariation("key", ctx, {...})` | Yes | Yes, when OpenFeature binding is proven | No | No |
| Dynamic flag keys | Yes | No | Yes | No |
| `*VariationDetail(...)` methods | Yes | No | Yes | No |
| `allFlags()` and `allFlagsState()` | Yes | No | Yes | No |
| Unknown fallback type | Yes | No | Yes | No |
| Configured wrappers | Yes | No | Yes | No |
| Ambiguous OpenFeature client binding | Yes | No | Yes | No |
| Browser SDKs | No | No | No | Yes |
| React SDKs/hooks/HOCs | No | No | No | Yes |
| Go, Java, Python, or other SDKs | No | No | No | Yes |
| Non-LaunchDarkly providers | No | No | No | Yes |

## Supported Import Provenance

FlagLint resolves LaunchDarkly client provenance from supported SDK imports only:

```ts
import * as LaunchDarkly from "@launchdarkly/node-server-sdk";
const client = LaunchDarkly.init("sdk-key");
```

```ts
import { init as ldInit } from "@launchdarkly/node-server-sdk";
const client = ldInit("sdk-key");
```

```ts
const { init: ldInit } = require("@launchdarkly/node-server-sdk");
const client = ldInit("sdk-key");
```

Unrelated functions named `init`, `ldInit`, `client`, `feature`, `flag`, or similar do not establish LaunchDarkly provenance.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/reference/supported-scope.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Limitations](/docs/reference/limitations/)
