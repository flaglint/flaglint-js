<p align="center">
  <img src="docs/assets/logo.png" alt="FlagLint" width="400" />
</p>

<p align="center">
  <strong>Standardize LaunchDarkly usage on OpenFeature.</strong>
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

# FlagLint

**The argument-order difference between LaunchDarkly and OpenFeature 
silently breaks flag evaluations in production. FlagLint catches it.**

FlagLint inventories direct LaunchDarkly Node.js SDK calls, generates reviewable migration plans,
and prevents new vendor-coupled flag access from entering your codebase.
LaunchDarkly remains your provider. OpenFeature becomes the evaluation API your application code calls.

**[Documentation](https://flaglint.dev/docs)** · **[Quickstart](https://flaglint.dev/docs/quickstart)** · **[Enterprise Demo](https://flaglint.dev/docs/enterprise-demo)** · **[npm](https://npmjs.com/package/flaglint)** · **[Issues](https://github.com/flaglint/flaglint/issues)**

![FlagLint demo](./flaglint-demo.gif)

---

## Quick start

```bash
npx flaglint audit ./src
```

```
✓ Audit complete: 13 flags — 3 high risk, 10 medium risk

→ Run flaglint scan ./src for detailed file-level inventory
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
| 1 | `flaglint audit ./src` | Risk-ranked overview of direct LD Node server SDK usage |
| 2 | `flaglint scan ./src` | Detailed file-level inventory for automation |
| 3 | `flaglint migrate --dry-run` | Reviewable before/after diffs; inline provider setup guidance |
| 4 | `flaglint migrate --apply` | Rewrites only guarded, provably automatable call-sites |
| 5 | `flaglint validate --no-direct-launchdarkly` | CI gate: exit 1 if direct LD evaluation calls remain |

---

### `flaglint audit [dir]`

Generates a local flag debt audit report. No API keys or credentials needed.

```bash
flaglint audit ./src
flaglint audit ./src --format html --output audit.html
flaglint audit ./src --format json
```

Produces a risk-scored inventory of every LaunchDarkly flag in your codebase — sorted by risk level (high / medium / low) with the reasons for each rating. Useful for planning migration scope before running `migrate --dry-run`.

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

Node.js 20 or newer. No LaunchDarkly SDK key or credentials required for audit, scan, migrate, or validate.

---

## Local analysis

FlagLint runs entirely on your machine. No source code, flag keys, or file paths are
transmitted to FlagLint-owned infrastructure.

---

## Links

[Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md) · [License](./LICENSE) · [Full docs](https://flaglint.dev/docs)
