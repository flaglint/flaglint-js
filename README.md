# FlagLint

**Standardize LaunchDarkly usage on OpenFeature.**

FlagLint inventories direct LaunchDarkly Node.js SDK calls, generates reviewable migration plans,
and prevents new vendor-coupled flag access from entering your codebase.
LaunchDarkly remains your provider. OpenFeature becomes the evaluation API your application code calls.

**[Documentation](https://flaglint.dev/docs/quickstart)** · **[Quickstart](https://flaglint.dev/docs/quickstart)** · **[Enterprise Demo](https://flaglint.dev/docs/enterprise-demo)** · **[npm](https://npmjs.com/package/flaglint)** · **[Issues](https://github.com/flaglint/flaglint/issues)**

---

## Quick start

```bash
npx flaglint scan ./src
```

```
✔ Scanning 5 files...
✔ Found 20 direct LaunchDarkly Node SDK calls across 11 unique flags
⚡ 6 dynamic flag keys — manual review required
↳ 2 detail method calls — manual review required

→ Run flaglint migrate --dry-run for a reviewable migration diff
```

Preview the migration before changing anything:

```bash
npx flaglint migrate ./src --dry-run
```

---

## Workflow

| Step | Command | What happens |
|------|---------|-------------|
| 1 | `flaglint scan ./src` | AST inventory of every direct LD Node server SDK call |
| 2 | `flaglint migrate --dry-run` | Reviewable before/after diffs; inline provider setup guidance |
| 3 | `flaglint migrate --apply` | Rewrites only guarded, provably automatable call-sites |
| 4 | `flaglint validate --no-direct-launchdarkly` | CI gate: exit 1 if direct LD evaluation calls remain |

---

## Before → After (real output from enterprise demo)

```diff
--- a/checkout.ts
+++ b/checkout.ts
-  return ldClient.boolVariation("checkout-v2", ctx, false);
+  return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);

-  return ldClient.stringVariation("payment-provider", ctx, "stripe");
+  return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);

--- a/pricing.ts
+++ b/pricing.ts
-  return ldClient.numberVariation("discount-percentage", ctx, 0);
+  return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);
```

Flag key, fallback value, `await`, and evaluation context are preserved exactly.

---

## Supported scope

LaunchDarkly Node.js server-side SDK calls from `launchdarkly-node-server-sdk` and
`@launchdarkly/node-server-sdk`. Both ESM import and CJS `require()` forms.

`--apply` rewrites `boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`
where the flag key, fallback, and OpenFeature client binding are statically explicit.
Detail methods, dynamic keys, bulk calls, and unknown fallback types are reported for manual review.
Browser SDKs, React SDKs, and non-LaunchDarkly providers are outside current scope.

Full coverage table: [Supported Scope](https://flaglint.dev/docs/reference/supported-scope)

---

## Provider setup (one-time, manual)

Before `--apply`, complete bootstrap setup once. Full instructions:
[OpenFeature Provider Setup](https://flaglint.dev/docs/integrations/openfeature-provider)

Key points:
- `new LaunchDarklyProvider(process.env.LD_SDK_KEY!)` — SDK key constructor
- Evaluation context accepts either `targetingKey` (OpenFeature-native) or an existing LaunchDarkly `key`
- **Do not remove LaunchDarkly packages** — the OpenFeature provider depends on them at runtime

---

## Requirements

Node.js 20 or newer. No LaunchDarkly SDK key or credentials required for scan or migrate.

---

## Local analysis

FlagLint runs entirely on your machine. No source code, flag keys, or file paths are
transmitted to any external service. No outbound network connections during scan or migration.

---

## Links

[Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md) · [License](./LICENSE) · [Full docs](https://flaglint.dev/docs/quickstart)
