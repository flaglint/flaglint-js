---
title: Add OpenFeature Provider
description: Add the LaunchDarkly OpenFeature provider while keeping LaunchDarkly as the backend.
lastUpdated: 2026-05-28
---

FlagLint changes application call sites. It does not generate provider/bootstrap files.

## Install Provider Packages

```bash
npm install @openfeature/server-sdk @launchdarkly/node-server-sdk @launchdarkly/openfeature-node-server
```

## Bootstrap Once

Create one provider module such as `platform/feature-flags.ts`:

```ts
import { OpenFeature } from "@openfeature/server-sdk";
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

const ldProvider = new LaunchDarklyProvider(process.env.LD_SDK_KEY!);
await OpenFeature.setProviderAndWait(ldProvider);

export const openFeatureClient = OpenFeature.getClient();
```

The LaunchDarkly OpenFeature provider accepts OpenFeature `targetingKey` or an existing LaunchDarkly `key`. FlagLint preserves existing evaluation context expressions at migrated call sites.

## Configure Shared Client Imports

If services import the shared client, allowlist the binding:

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

For TypeScript ESM projects, configured module patterns without `.js` also recognize the corresponding `.js` runtime import specifier.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/tutorials/add-openfeature-provider.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Enforce in GitHub Actions](/docs/tutorials/enforce-in-github-actions/)
