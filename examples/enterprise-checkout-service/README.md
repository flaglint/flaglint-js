# Enterprise Checkout Service — FlagLint Demo

A realistic end-to-end demo showing how a mid-sized SaaS platform team
migrates from direct LaunchDarkly Node.js server SDK evaluations to OpenFeature,
keeping LaunchDarkly as the provider.

---

## Scenario

**AcmePay** is a SaaS checkout platform with four Node.js services using direct
LaunchDarkly SDK calls: `checkout.ts`, `pricing.ts`, `analytics.ts`, and `product.ts`.
The platform team has also built a shared internal `flags-wrapper.ts`.

The platform team wants to:
1. Inventory every direct LaunchDarkly SDK call across services
2. Safely migrate the automatable ones to OpenFeature
3. Identify calls that require manual review (detail methods, dynamic keys, wrappers)
4. Enforce in CI that no new direct LD calls land after migration and manual review are complete

**LaunchDarkly remains the feature flag provider throughout.**
Only the application-facing call-site API changes: `ldClient.*Variation()` becomes
`openFeatureClient.get*Value()`.

---

## File Structure

```
enterprise-checkout-service/
  platform/
    feature-flags.ts      # bootstrap/provider file — excluded from CI enforcement
  src/
    checkout.ts           # boolVariation, stringVariation — safely automatable
    pricing.ts            # numberVariation, jsonVariation — safely automatable
    analytics.ts          # variationDetail, boolVariationDetail — manual review
    flags-wrapper.ts      # shared internal LD wrapper — manual review
    product.ts            # dynamic key + 2 static keys (partial auto-migration)
  before/                 # snapshot of src/ before migration
  after/                  # snapshot of src/ after flaglint migrate --apply (auto-migrated)
  after-complete/         # snapshot of src/ after full migration including manual review
  generated-reports/
    inventory-report.md   # sample output of flaglint scan --format markdown
    migration-plan.md     # sample output of flaglint migrate --dry-run
    flaglint.sarif        # SARIF for GitHub Code Scanning (validate --format sarif)
  .github/
    workflows/
      flaglint.yml        # sample CI workflow for an adopting repository
  .flaglintrc             # config with openFeatureClientBindings
```

---

## Automatable vs. Manual Review

| File | Call Type | Automatable |
|------|-----------|-------------|
| `src/checkout.ts` | boolVariation, stringVariation | Yes — 4 usages |
| `src/pricing.ts` | numberVariation, jsonVariation | Yes — 4 usages |
| `src/product.ts` | stringVariation, boolVariation (static keys) | Yes — 2 usages |
| `src/product.ts` | boolVariation (dynamic key) | No — dynamic key |
| `src/analytics.ts` | variationDetail, boolVariationDetail | No — detail methods |
| `src/analytics.ts` | allFlagsState | No — bulk call |
| `src/flags-wrapper.ts` | wrapper functions | No — shared wrapper |

---

## Walkthrough

### Two ways to run this demo

**A. Repository contributor mode** — runs FlagLint from the local build.
Verified against the current source in this repository.

```bash
# From the repository root
npm ci
npm run build

# Then use node ./dist/bin/flaglint.js instead of npx flaglint
# Example: node ./dist/bin/flaglint.js scan ./examples/enterprise-checkout-service/src ...
```

All commands in the steps below are shown in contributor mode.

**B. Published-package evaluator mode** — uses the npm-published package.

```bash
# From within this directory
cd examples/enterprise-checkout-service
npm install
# Then use: npx flaglint scan ./src ...
```

> Published-package commands become available once this capability ships in the
> next release. Check [flaglint on npm](https://www.npmjs.com/package/flaglint) for the current version.

---

### Step 1: Scan — inventory all LaunchDarkly SDK calls

```bash
# Contributor mode (from repo root)
node ./dist/bin/flaglint.js scan ./examples/enterprise-checkout-service/src \
  --format markdown \
  --config ./examples/enterprise-checkout-service/.flaglintrc
```

```bash
# Published-package mode (from examples/enterprise-checkout-service)
npx flaglint scan ./src --format markdown
```

This outputs a Markdown report showing every direct LaunchDarkly call across all service files.
A committed snapshot is at `generated-reports/inventory-report.md`.

Expected output:
```
✓ 20 flag usages found across 11 unique flags
ℹ  1 dynamic flag key(s) require manual review
```

You can also produce a SARIF file for GitHub Code Scanning:
```bash
# Contributor mode
node ./dist/bin/flaglint.js validate ./examples/enterprise-checkout-service/src \
  --no-direct-launchdarkly \
  --bootstrap-exclude "platform/feature-flags.ts" \
  --format sarif \
  --output ./examples/enterprise-checkout-service/generated-reports/flaglint.sarif \
  --config ./examples/enterprise-checkout-service/.flaglintrc
```

A committed snapshot is at `generated-reports/flaglint.sarif` (20 findings from `src/`).

### Step 2: Review — generate the migration plan

```bash
# Contributor mode (from repo root)
node ./dist/bin/flaglint.js migrate ./examples/enterprise-checkout-service/src \
  --dry-run \
  --config ./examples/enterprise-checkout-service/.flaglintrc
```

```bash
# Published-package mode (from examples/enterprise-checkout-service)
npx flaglint migrate ./src --dry-run
```

This prints reviewable before/after diffs to stdout and identifies:
- 10 transformations with proven OpenFeature client bindings
- 9 call sites requiring manual review, with specific guidance for each

A committed snapshot is at `generated-reports/migration-plan.md`.

### Step 3: Apply — automatically migrate the safe call sites

```bash
# Contributor mode (from repo root)
node ./dist/bin/flaglint.js migrate ./examples/enterprise-checkout-service/src \
  --apply \
  --config ./examples/enterprise-checkout-service/.flaglintrc
```

```bash
# Published-package mode (from examples/enterprise-checkout-service)
npx flaglint migrate ./src --apply
```

This rewrites only the safely automatable transformations in-place:

**src/checkout.ts before:**
```typescript
return ldClient.boolVariation("checkout-v2", ctx, false);
return ldClient.stringVariation("payment-provider", ctx, "stripe");
```

**src/checkout.ts after:**
```typescript
return openFeatureClient.getBooleanValue("checkout-v2", false, ctx);
return openFeatureClient.getStringValue("payment-provider", "stripe", ctx);
```

**src/pricing.ts before:**
```typescript
return ldClient.numberVariation("discount-percentage", ctx, 0);
return ldClient.jsonVariation("discount-config", ctx, fallback);
```

**src/pricing.ts after:**
```typescript
return openFeatureClient.getNumberValue("discount-percentage", 0, ctx);
return openFeatureClient.getObjectValue("discount-config", fallback, ctx);
```

The `before/` and `after/` directories in this demo contain committed snapshots of the
transformation so you can compare without running `--apply`.

`--apply` safety contracts:
- Refuses on a dirty git working tree unless `--allow-dirty`
- Only rewrites files where `openFeatureClient` is proven (via import from `platform/feature-flags`)
- Preserves flag key, fallback value, evaluation context, and `await` exactly
- Never touches detail methods, dynamic keys, bulk calls, or wrapper functions

The `after-complete/` directory shows the fully migrated state — including the manual-review
items hand-migrated to OpenFeature. It has zero direct LaunchDarkly calls.

### Step 4: Enforce in CI

**Advisory gate on `src/` (during migration):**

```bash
# Contributor mode (from repo root)
node ./dist/bin/flaglint.js validate ./examples/enterprise-checkout-service/src \
  --no-direct-launchdarkly \
  --bootstrap-exclude "platform/feature-flags.ts" \
  --config ./examples/enterprise-checkout-service/.flaglintrc
```

This exits 1 while the manual-review examples still contain direct LaunchDarkly
evaluations. That is expected for this demo: `analytics.ts`, `product.ts`, and
`flags-wrapper.ts` intentionally show detail methods, dynamic keys, bulk calls,
and wrapper abstractions that require human migration.

**Expected output before manual review is complete:**
```
✗ validate --no-direct-launchdarkly: 20 direct LaunchDarkly evaluation call(s) found.
```

**Hard gate on `after-complete/` (green-line check):**

```bash
# Contributor mode (from repo root)
node ./dist/bin/flaglint.js validate ./examples/enterprise-checkout-service/after-complete \
  --no-direct-launchdarkly \
  --config ./examples/enterprise-checkout-service/.flaglintrc
```

**Expected output:**
```
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

After the manual-review items in `src/` are resolved, the advisory gate on `src/` also
becomes a hard gate that keeps migration complete.

---

## Provider Configuration

The `.flaglintrc` in this demo configures FlagLint to recognize `openFeatureClient`
imported from `platform/feature-flags` as a proven binding for `--apply` eligibility:

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

This means `--apply` will rewrite any file that imports `openFeatureClient` from
`platform/feature-flags` (or any path matching the glob), without requiring a local
`OpenFeature.getClient()` call in every service file.

---

## The Provider Setup (platform/feature-flags.ts)

```typescript
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";
import { OpenFeature } from "@openfeature/server-sdk";

const ldProvider = new LaunchDarklyProvider(process.env.LD_SDK_KEY!);
await OpenFeature.setProviderAndWait(ldProvider);

export const openFeatureClient = OpenFeature.getClient("checkout-platform");
```

This bootstrap module centralizes the LaunchDarkly OpenFeature provider integration.
Application service code evaluates flags through OpenFeature rather than direct
LaunchDarkly Node.js server SDK evaluation calls.

LaunchDarkly continues to serve the feature flags throughout. All services call
OpenFeature, and LaunchDarkly is wired in as the provider by this single file.

---

## CI Workflow

The `.github/workflows/flaglint.yml` in this demo is a **sample workflow for an adopting repository**.
Copy it to your repository and adapt `./src` to your actual source path.

It runs the full pipeline on Node.js 20 and 22:

1. Scan and upload SARIF to GitHub Code Scanning (PR annotations via `validate --format sarif`)
2. Generate migration plan as a downloadable artifact
3. Advisory enforcement on `src/` — flags violations, `continue-on-error: true`
4. Hard enforcement gate on `after-complete/` — must pass (no `continue-on-error`)

See `generated-reports/` for committed sample outputs from this pipeline.

---

## Related

- [FlagLint README](../../README.md)
- [Supported API matrix](../../README.md#supported-api-matrix)
- [Configuration reference](../../README.md#configuration)
- [CI integration guide](../../README.md#ci-integration)
