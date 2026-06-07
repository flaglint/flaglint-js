<p align="center">
  <img src="docs/assets/logo.png" alt="FlagLint" width="400" />
</p>

<p align="center">
  <strong>Find every direct LaunchDarkly SDK call. Migrate safely. Enforce the boundary.</strong>
</p>

<p align="center">
  <a href="https://github.com/flaglint/flaglint/actions/workflows/ci.yml">
    <img src="https://github.com/flaglint/flaglint/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://www.npmjs.com/package/flaglint">
    <img src="https://img.shields.io/npm/v/flaglint.svg" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/flaglint">
    <img src="https://img.shields.io/npm/dm/flaglint.svg" alt="downloads" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License" />
  </a>
</p>

---

Most teams do not know how many direct LaunchDarkly SDK calls are in their codebase, which ones are safe to migrate, or which ones will silently break if migrated naively. FlagLint answers all three questions before you touch a line of code.

```bash
npx flaglint audit ./src
```

```
✓ Audit complete: 13 flags — 3 high risk, 10 medium risk

| Flag Key            | Risk   | Usages | Reasons                           |
|---------------------|--------|--------|-----------------------------------|
| <dynamic key>       | High   | 7      | key cannot be resolved statically |
| checkout-experiment | High   | 1      | detail evaluation                 |
| *                   | High   | 1      | bulk call                         |
| checkout-v2         | Medium | 1      | safely automatable                |
```

No API key. No source upload. LaunchDarkly stays your provider — OpenFeature becomes the evaluation API your application calls.

**[Documentation](https://flaglint.dev/docs)** · **[Quickstart](https://flaglint.dev/docs/quickstart)** · **[npm](https://npmjs.com/package/flaglint)**

---

## The problem FlagLint solves

The OpenFeature `getBooleanValue(key, defaultValue, context)` API takes arguments in a different order from LaunchDarkly's `boolVariation(key, context, defaultValue)`. A naive find-and-replace silently swaps your fallback and context, producing valid-looking code that evaluates flags incorrectly in production.

FlagLint's static analysis proves — before rewriting anything — that the flag key is static, the fallback value and type are known, and a verified OpenFeature client binding is present. If any condition cannot be proven, the call is reported for manual review and left untouched.

---

## Workflow

| Step | Command | What it does |
|------|---------|--------------|
| 1 | `flaglint audit ./src` | Risk-ranked overview. High / medium / low per flag. No API key needed. |
| 2 | `flaglint scan ./src` | Detailed file-level structured inventory for automation or review. |
| 3 | `flaglint migrate ./src --dry-run` | Reviewable before/after diffs. Shows exactly what will change. |
| 4 | `flaglint migrate ./src --apply` | Rewrites only calls with proven static inputs and a verified OpenFeature binding. |
| 5 | `flaglint validate ./src --no-direct-launchdarkly` | CI gate — exits 1 if any direct LD evaluation call remains. |

---

## Before and after

```diff
--- a/src/routes/checkout.ts
+++ b/src/routes/checkout.ts
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);

-  return ldClient.stringVariation("payment-provider", ctx, "stripe");
+  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);

--- a/src/services/pricing.ts
+++ b/src/services/pricing.ts
-  return ldClient.numberVariation("discount-percentage", ctx, 0);
+  return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);
```

Flag key, fallback value, evaluation context, and `await` are preserved exactly. The LaunchDarkly packages stay — the OpenFeature provider depends on them at runtime.

---

## What is never auto-rewritten

FlagLint is intentionally conservative. These are always skipped and reported for manual review:

- **Dynamic keys** — `ldClient.boolVariation(getFlagKey(user), ctx, false)`
- **Detail evaluations** — `boolVariationDetail`, `variationDetail`
- **Bulk calls** — `allFlags()`, `allFlagsState()`
- **Unknown fallback types**
- **Configured wrappers**
- **Ambiguous OpenFeature client bindings**
- **Browser SDKs, React SDKs, non-Node SDKs**

---

## Supported scope

LaunchDarkly Node.js server-side SDK calls from `@launchdarkly/node-server-sdk` and `launchdarkly-node-server-sdk`. Both ESM and CommonJS. Node.js 20 or newer.

Full coverage table: [Supported Scope](https://flaglint.dev/docs/reference/supported-scope)

---

## Provider setup (one-time, manual)

Before `migrate --apply`, complete provider bootstrap once:

```ts
import { OpenFeature } from "@openfeature/server-sdk";
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

await OpenFeature.setProviderAndWait(
  new LaunchDarklyProvider(process.env.LD_SDK_KEY!)
);
export const openFeatureClient = OpenFeature.getClient();
```

Evaluation context accepts either `targetingKey` (OpenFeature-native) or an existing LaunchDarkly `key`. Do not remove LaunchDarkly packages — the OpenFeature provider depends on them at runtime.

Full instructions: [OpenFeature Provider Setup](https://flaglint.dev/docs/tutorials/add-openfeature-provider)

---

## Local analysis

FlagLint runs entirely on your machine. No source code, flag keys, or file paths leave your environment. No LaunchDarkly API key or credentials are required for `audit`, `scan`, `migrate`, or `validate`.

---

## Links

**[Docs](https://flaglint.dev/docs)** · **[Quickstart](https://flaglint.dev/docs/quickstart)** · **[Blog](https://flaglint.dev/blog)** · [Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md) · [License](./LICENSE)
