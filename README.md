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

Standardize LaunchDarkly usage on OpenFeature.

FlagLint inventories direct LaunchDarkly Node.js SDK calls, generates reviewable migration
plans, and prevents new vendor-coupled flag access from entering your codebase.

**LaunchDarkly remains your provider. OpenFeature becomes the evaluation API your application code calls.**

---

## Workflow

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `flaglint scan` | AST inventory of every direct LD Node server SDK call |
| 2 | `flaglint migrate --dry-run` | Reviewable before/after diffs with provider setup guidance |
| 3 | `flaglint migrate --apply` | Apply only guarded, provably automatable transformations |
| 4 | `flaglint validate --no-direct-launchdarkly` | CI gate: exit 1 if direct LD calls remain |

---

## Quick start

```bash
npx flaglint scan ./src
```

Example output:

```text
✓ 15 flag usages found across 6 unique flags (48ms)
ℹ  1 dynamic flag key(s) require manual review
```

Markdown report excerpt:

```markdown
## Flag Inventory
| Flag Key | Usages | Files | Call Types |
|----------|--------|-------|------------|
| checkout-v2 | 3 | 2 | boolVariation |
| color-theme | 1 | 1 | stringVariation |
| timeout-ms  | 1 | 1 | numberVariation |
```

### JSON output (`--format json`)

Pipe-friendly. Every usage includes file, line, call type, and staleness signals:

```json
{
  "flagKey": "checkout-v2",
  "isDynamic": false,
  "file": "src/services/checkout.ts",
  "line": 14,
  "callType": "boolVariation",
  "stalenessSignals": []
}
```

---

## Installation

```bash
npm install -g flaglint
# or use without installing
npx flaglint
```

Requires Node.js 20 or newer. CI validates FlagLint on Node.js 20 and 22.

---

## Commands

### `flaglint scan [dir]`

AST-based inventory of direct LaunchDarkly Node.js server SDK calls.

```bash
flaglint scan ./src
flaglint scan --format json --output report.json
flaglint scan --format html --output report.html
flaglint scan --format sarif --output flaglint.sarif
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format` | `markdown` | Output format: `json`, `markdown`, `html`, `sarif` |
| `--output` | stdout | Write report to file |
| `--config` | auto-detect | Path to a config file |
| `--exclude-tests` | — | Exclude test files from scan results |

Exit code `0` when no staleness signals detected, `1` when staleness signals are present —
enabling CI visibility into flag usage patterns.

---

### `flaglint migrate [dir]`

Analyzes migration readiness and generates an OpenFeature migration plan.

```bash
flaglint migrate ./src                     # write MIGRATION.md
flaglint migrate --dry-run                 # reviewable diffs to stdout
flaglint migrate --apply                   # guarded: apply only provably automatable transformations in-place
flaglint migrate --apply --allow-dirty     # apply even on a dirty working tree
flaglint migrate --output plan.md          # write to custom file
flaglint migrate --exclude-tests           # skip test and spec files
```

| Option | Default | Description |
|--------|---------|-------------|
| `--output` | `MIGRATION.md` | Write migration plan to file |
| `--dry-run` | — | Print reviewable diffs to stdout; includes provider setup guidance |
| `--apply` | — | Apply automatable transformations in-place (requires clean git tree) |
| `--allow-dirty` | — | Override dirty-tree guard for `--apply` |
| `--config` | auto-detect | Path to a config file |
| `--exclude-tests` | — | Skip `*.test.*`, `*.spec.*`, `__tests__/`, `tests/` |

**`--apply` safety contracts:**
- Refuses on a dirty git working tree unless `--allow-dirty`
- Skips any file that does not already contain a proven `openFeatureClient` binding
  (`openFeatureClient = OpenFeature.getClient()` from `@openfeature/server-sdk`)
- Never touches detail methods, dynamic keys, unknown fallbacks, or bulk calls
- Preserves `await` and original call arguments exactly
- Idempotent: re-running with the same analysis has no effect

---

### `flaglint validate [dir]`

Validates that your codebase complies with feature flag policy rules.
Designed for CI enforcement after migration is complete.

```bash
flaglint validate                           # report usages, always exits 0
flaglint validate --no-direct-launchdarkly  # exit 1 on any direct LD eval call
flaglint validate --no-direct-launchdarkly \
  --bootstrap-exclude src/provider/setup.ts # allow specific bootstrap file
flaglint validate --no-direct-launchdarkly \
  --bootstrap-exclude "src/provider/**"     # allow all provider-directory files
```

| Option | Default | Description |
|--------|---------|-------------|
| `--no-direct-launchdarkly` | — | Exit 1 if any direct LD Node server evaluation calls found |
| `--bootstrap-exclude <glob>` | — | Repeatable glob; matching files excluded from violations |
| `--config` | auto-detect | Path to a config file |

Exit codes: `0` = passed, `1` = violations found, `130` = SIGINT.

**Example pass output:**
```
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 42 file(s).
```

**Example fail output:**
```
✗ validate --no-direct-launchdarkly: 2 direct LaunchDarkly evaluation call(s) found.

  src/services/checkout.ts:42:8 — boolVariation("checkout-v2")
  src/services/pricing.ts:17:4 — boolVariation(dynamic key — manual review required)

These files must migrate to OpenFeature before this rule passes.
Run `flaglint migrate --dry-run` to review the migration plan.
```

---

## Focused scope for safe automation

Automatic migration currently supports LaunchDarkly Node.js server-side evaluation calls in
TypeScript and JavaScript. That narrow scope is intentional: FlagLint only rewrites call sites
where the value type, static flag key, fallback, evaluation context, and OpenFeature client
binding are explicit enough to preserve.

Dynamic keys, detail evaluations, bulk flag-state calls, browser SDKs, React usage, and ambiguous
patterns are reported for manual review. They are inventoried so teams can plan the migration,
but they are not automatically transformed.

## Supported API matrix

**Scope: LaunchDarkly Node.js server-side SDK** (`launchdarkly-node-server-sdk`).

| LaunchDarkly call | Automatable | OpenFeature equivalent |
|---|---|---|
| `ldClient.boolVariation(key, ctx, false)` | ✓ | `openFeatureClient.getBooleanValue(key, false, ctx)` |
| `ldClient.stringVariation(key, ctx, "")` | ✓ | `openFeatureClient.getStringValue(key, "", ctx)` |
| `ldClient.numberVariation(key, ctx, 0)` | ✓ | `openFeatureClient.getNumberValue(key, 0, ctx)` |
| `ldClient.jsonVariation(key, ctx, {})` | ✓ | `openFeatureClient.getObjectValue(key, {}, ctx)` |
| `ldClient.*VariationDetail(...)` | ✗ manual | Detail result shapes differ — requires manual review |
| Dynamic flag key | ✗ manual | Key must be a static string literal |
| `ldClient.allFlags()` / `allFlagsState()` | ✗ manual | Bulk calls — no single-flag codemod |
| Unknown fallback type | ✗ manual | Fallback type must be determinable statically |

`flaglint scan` and `flaglint migrate --dry-run` report detected LaunchDarkly Node.js server-side SDK patterns, including manual-review cases.
`flaglint migrate --apply` rewrites only the ✓ rows above.

---

## Provider setup (one-time manual step)

`flaglint migrate --dry-run` includes this guidance inline. **Complete provider setup in
one dedicated file before running `--apply`.**

```bash
npm install @openfeature/server-sdk \
            @launchdarkly/node-server-sdk \
            @launchdarkly/openfeature-node-server
```

Bootstrap file (do not apply automatically — bootstrap is intentionally manual):

```typescript
import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";
import { OpenFeature } from "@openfeature/server-sdk";

const ldProvider = new LaunchDarklyProvider(process.env.LD_SDK_KEY!);
await OpenFeature.setProviderAndWait(ldProvider);

// Evaluation context needs a targeting key.
// Use OpenFeature `targetingKey` or keep an existing LaunchDarkly `key`:
// { targetingKey: user.id } or { key: user.id }
export const openFeatureClient = OpenFeature.getClient();
```

**Do not remove any LaunchDarkly packages.** LaunchDarkly remains your feature flag provider;
`@openfeature/server-sdk` becomes the evaluation interface your application code calls.

---

## Using an existing shared OpenFeature client

If your platform team already exports an OpenFeature client from a shared internal module
(e.g. `platform/feature-flags.ts`), FlagLint can use that import as the proven binding for
`--apply` — no local `OpenFeature.getClient()` call is required in every file.

Declare the allowed import in `.flaglintrc`:

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

`modulePatterns` are **glob patterns** matched against the module import specifier
(leading `./` and `../` traversal is stripped before matching). A pattern of
`"**/platform/feature-flags"` matches `"../platform/feature-flags"` and
`"../../shared/platform/feature-flags"`, but **not** `"../platform/feature-flags-legacy"` or
`"../other/platform/feature-flags-backup"`.

**Before:**
```typescript
// services/checkout.ts
import { openFeatureClient } from "../platform/feature-flags";
import LaunchDarkly from "launchdarkly-node-server-sdk";

const enabled = ldClient.boolVariation("checkout-v2", { key: user.id }, false);
```

**After (`flaglint migrate --apply`):**
```typescript
// services/checkout.ts
import { openFeatureClient } from "../platform/feature-flags";
import LaunchDarkly from "launchdarkly-node-server-sdk";

const enabled = openFeatureClient.getBooleanValue("checkout-v2", false, { key: user.id });
```

If the import is aliased (e.g. `import { openFeatureClient as flags } from "..."`), FlagLint
previews and applies the transformation using the **local alias name** (`flags.getBooleanValue(...)`).

When two configured bindings both match a file, FlagLint considers the result ambiguous and
**skips that file** rather than guessing. Skipped files are reported in `--dry-run` output.

Provider initialization remains the platform team's responsibility. FlagLint never inserts or
modifies bootstrap/provider setup code.

---

## Example transformation

**Before — direct LaunchDarkly Node.js server SDK:**
```typescript
const enabled = await ldClient.boolVariation("checkout-v2", { key: user.id }, false);
const theme   = await ldClient.stringVariation("color-theme", { key: user.id }, "light");
const timeout = await ldClient.numberVariation("timeout-ms",  { key: user.id }, 5000);
```

**After — OpenFeature via LaunchDarkly provider:**
```typescript
const enabled = await openFeatureClient.getBooleanValue("checkout-v2", false, { targetingKey: user.id });
const theme   = await openFeatureClient.getStringValue("color-theme", "light", { targetingKey: user.id });
const timeout = await openFeatureClient.getNumberValue("timeout-ms",  5000,    { targetingKey: user.id });
```

Flag key, fallback value, `await`, and evaluation context are preserved exactly.
LaunchDarkly continues to serve the flags — only the call-site API changes.

---

## Configuration

Create `.flaglintrc`, `.flaglintrc.json`, or `flaglint.config.json` in your project root:

```json
{
  "include": ["**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "provider": "launchdarkly",
  "minFileCount": 0,
  "reportTitle": "My Project Flag Report"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `include` | `string[]` | `["**/*.{ts,tsx,js,jsx}"]` | Glob patterns to scan |
| `exclude` | `string[]` | `["**/node_modules/**", ...]` | Glob patterns to ignore |
| `provider` | `string` | `"launchdarkly"` | Feature flag provider |
| `minFileCount` | `number` | `0` | Opt-in staleness heuristic. When set above 0, a flag is a staleness candidate if it appears in ≤ N files |
| `wrappers` | `string[]` | `[]` | Function names wrapping LD SDK calls. Example: `["flagPredicate", "useFlag"]` |
| `openFeatureClientBindings` | `{ importName: string; modulePatterns: string[] }[]` | `[]` | Allowlist shared imported OpenFeature client bindings for `--apply` eligibility. See [Using an existing shared OpenFeature client](#using-an-existing-shared-openfeature-client). |
| `reportTitle` | `string` | — | Custom title for generated reports |
| `outputDir` | `string` | `"."` | Default output directory |

FlagLint searches for config in this order: `--config` path → `.flaglintrc` → `.flaglintrc.json` → `flaglint.config.json`.

---

## CI Integration

### Enforce OpenFeature migration: block PRs with direct LD calls

```yaml
- name: Validate — no direct LaunchDarkly evaluations
  run: |
    npx flaglint validate --no-direct-launchdarkly \
      --bootstrap-exclude "src/provider/setup.ts"
  # exits 1 if any direct LD evaluation calls remain outside the bootstrap file
```

### Full migration CI pipeline with SARIF annotations

```yaml
name: FlagLint
on: [pull_request]

jobs:
  flaglint:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Scan for LaunchDarkly SDK usage
        run: npx flaglint scan --format sarif --output flaglint.sarif
        continue-on-error: true

      - name: Upload to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flaglint.sarif

      - name: Enforce OpenFeature migration
        run: |
          npx flaglint validate --no-direct-launchdarkly \
            --bootstrap-exclude "src/provider/setup.ts"
```

Code Scanning alerts show the exact file and line of each direct LD call — reviewers see them in the PR without running anything locally.

---

## Precision

Validated against 120 deterministic benchmark cases within the supported LaunchDarkly Node.js server-side SDK scope. 100% precision and recall are limited to those 120 tested cases and to the Node.js server-side SDK call patterns explicitly listed in the Supported API matrix above.

Detection is AST-based, not regex: client binding patterns, import aliases, and CJS require
forms are resolved before matching.

---

## Enterprise demo

See a realistic end-to-end migration walkthrough — multiple Node.js services,
mixed automatable and manual-review patterns, SARIF output, and CI enforcement:

**[View enterprise demo](./examples/enterprise-checkout-service/README.md)**

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](./LICENSE).
