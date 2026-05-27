# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [0.5.1] - 2026-05-27

### Fixed

- Corrected `migrate --dry-run` messaging when all previewed diffs use proven
  OpenFeature client bindings. Dry-run output no longer claims placeholder
  provider/client setup is required when configured imported bindings, aliases,
  or local `OpenFeature.getClient()` bindings are already present.
- Clarified README and docs scope wording for both supported LaunchDarkly Node.js
  server SDK package names: current `@launchdarkly/node-server-sdk` and legacy
  `launchdarkly-node-server-sdk`.
- Corrected OpenTelemetry feature-flag semantic-convention guidance to use the
  current `feature_flag.evaluation` event model and current attribute names.
- Corrected homepage release-state and lower CTA messaging now that `flaglint@0.5.0`
  is published.
- Narrowed broad flag-debt wording where it could imply comprehensive unused-flag
  lifecycle analysis rather than direct SDK coupling and migration review work.

## [0.5.0] - 2026-05-26

### Added

- **Configured imported OpenFeature client bindings** (`openFeatureClientBindings` in `.flaglintrc`):
  Declare shared OpenFeature client exports by import name and glob module pattern.
  `migrate --apply` recognises these imports as proven bindings without requiring every
  service file to call `OpenFeature.getClient()` locally.
  ```json
  {
    "openFeatureClientBindings": [
      { "importName": "openFeatureClient", "modulePatterns": ["**/platform/feature-flags"] }
    ]
  }
  ```

- **TypeScript ESM `.js` import compatibility**: `modulePatterns` globs now match TypeScript
  source imports that carry a `.js` extension at the specifier level
  (`import { openFeatureClient } from "../platform/feature-flags.js"`) even when the
  configured pattern omits the extension (`**/platform/feature-flags`).

- **`validate --format sarif`**: `flaglint validate --no-direct-launchdarkly --format sarif
  --output flaglint.sarif` emits SARIF 2.1.0 with rule id `flaglint.direct-launchdarkly`
  and level `error`. Designed for GitHub Code Scanning upload — each direct LaunchDarkly
  evaluation call produces a PR annotation. Zero violations produces a valid SARIF document
  that GitHub Code Scanning interprets as "all clear".

- **Enterprise HTML audit report**: `flaglint scan --format html` now includes an Executive
  Summary (total call-sites, unique flags, auto-migratable vs. manual-review breakdown),
  Findings by Directory table, Recommended Next Steps workflow, and a Copy Markdown Summary
  clipboard button.

- **Enterprise OpenFeature migration demo** (`examples/enterprise-checkout-service/`): end-to-end
  walkthrough across five Node.js services (checkout, pricing, analytics, product, flags-wrapper).
  Includes `before/`/`after/` snapshots, `after-complete/` (fully migrated, passes hard gate),
  generated reports, `.flaglintrc` config, and a sample GitHub Actions CI workflow.

- **Docs site** (`www/docs/`): nine documentation pages covering getting started, all three
  commands, supported scope, OpenFeature provider setup, CI/GitHub Actions integration,
  OpenTelemetry observability guidance, safety model, and the enterprise demo.

- **Enterprise trust documentation**: `SECURITY.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md`
  with SARIF rule-ID reference for the `flaglint.direct-launchdarkly` policy rule.

- **OpenFeature + OpenTelemetry observability guidance** (`www/docs/opentelemetry.html`):
  documents how to instrument OpenFeature flag evaluations with OpenTelemetry using the
  OpenFeature hooks API. FlagLint does not emit runtime telemetry; this page explains the
  complementary integration pattern.

### Fixed

- **Deterministic test execution from clean checkout**: `vitest` configuration no longer
  relies on `process.env.INIT_CWD` for test file discovery, ensuring the test suite
  is reproducible on first-time `npm ci && npm test` runs.

### Changed

- Reposition README and homepage messaging around standardizing LaunchDarkly usage on
  OpenFeature while keeping LaunchDarkly as the provider.
- Document the focused automation scope: LaunchDarkly Node.js server-side evaluation calls
  in TypeScript and JavaScript, with dynamic keys, detail evaluations, bulk calls, browser
  SDKs, React usage, and ambiguous patterns reported for manual review.
- Align supported runtime documentation and package metadata to Node.js `>=20`.
  Resolves the Node.js engine metadata mismatch in `flaglint@0.4.1` (published as `>=22`).

### Security

- Add Node.js 20/22 CI coverage, CodeQL analysis, Dependabot configuration, and vulnerability
  reporting instructions.
- Update npm release workflow for Trusted Publishing/OIDC without long-lived npm publish tokens.

### Scope boundaries (non-claims)

The following are explicitly out of scope for this release:
- LaunchDarkly replacement — LaunchDarkly remains the feature flag provider throughout.
- Automatic provider/bootstrap setup — `migrate --apply` never generates bootstrap files.
- Flag deletion or billing reduction — FlagLint does not evaluate live flag values.
- Built-in runtime OpenTelemetry instrumentation — see `www/docs/opentelemetry.html` for
  the complementary integration pattern using OpenFeature hooks.

## [0.4.1] - 2026-05-25

### Fixed

- Detail evaluation methods are classified as manual review and excluded from safe auto-transform counts.
- Generated LaunchDarkly OpenFeature provider setup now uses the SDK key constructor correctly.
- Evaluation-context guidance now states that either OpenFeature `targetingKey` or existing LaunchDarkly `key` is accepted.
- Default one-file flags no longer trigger staleness solely because they occur in one file; explicit `minFileCount: 1` remains available.
- Reporter output now says `Flags with review signals` instead of implying flags are safe to remove.
- Public early-preview messaging now states the Node.js server-side migration scope and review/testing requirement.

## [0.4.0] - 2026-05-24

### Added

- Release preparation: bump package version to 0.4.0, normalize repository URL, and adjust release workflow to publish only from manual GitHub Releases. No publish or tag created by this change.

### Added

- **`flaglint migrate --dry-run`**: Generates reviewable before/after diffs for every automatable
  call-site, including inline provider setup guidance (packages, bootstrap file, `targetingKey`
  context requirement). Does not write any files; output is to stdout.

- **Docs**: Repositioned public copy and website messaging to explicitly state scope (LaunchDarkly Node.js server SDK only), clarify that `--apply` is guarded, confirm provider/bootstrap setup is manual, and limit precision/recall claims to the 120 deterministic benchmark cases within that supported scope.

- **`flaglint migrate --apply`**: Applies only guarded, provably automatable transformations
  in-place. Safety contracts: refuses on a dirty git working tree (override with `--allow-dirty`);
  skips any file without a proven `openFeatureClient = OpenFeature.getClient()` binding from
  `@openfeature/server-sdk` (AST-grounded, not regex); never rewrites detail methods, dynamic
  keys, unknown fallbacks, or bulk calls; preserves `await` and all call arguments exactly;
  idempotent (re-running a stale analysis is a no-op via range-content guard).

- **`flaglint validate [dir]`**: New command for CI enforcement.
  - Without `--no-direct-launchdarkly`: reports usages, always exits 0.
  - `--no-direct-launchdarkly`: exits 1 if any direct LaunchDarkly Node server evaluation call
    is found (static, dynamic, detail, or bulk — all count as violations).
  - `--bootstrap-exclude <glob>` (repeatable): exclude provider bootstrap files from violations.
    Supports exact paths, `*` (within one directory), `**` (across directories), and `?` wildcards.
  - Never claims flags are stale or safe to delete.

### Scope clarification

Current scope: **LaunchDarkly Node.js server-side SDK** (`launchdarkly-node-server-sdk`).
React hooks, HOC, and client-side SDK patterns are detected by `scan` but are not automatically
migrated by `--apply`.

## [0.3.0] - 2026-05-23

### Added

- **SARIF output**: `flaglint scan --format sarif --output flaglint.sarif` now emits SARIF 2.1.0 for GitHub Code Scanning / PR annotations.
- **Persistent scan metadata**: `ScanResult` now includes `scannedAt` and `scanRoot`, giving JSON/SARIF/HTML reports a stable scan timestamp and source-root context.

### Fixed

- **Config mutation**: `--exclude-tests` no longer mutates the loaded config object in both `scan` and `migrate` commands — uses spread instead of `push()` so the original config is never modified.
- **Typed scan warnings**: `ScanResult.warnings` is now a typed `ScanWarning` union (`read-failure` | `parse-failure`) instead of opaque strings, preserving structured data at the domain boundary.
- **StalenessEvaluator wired**: The `StalenessEvaluator` interface now has a call site in `scan()` — pass an `evaluator` to inject API-based staleness signals without touching core scanner logic.
- **ScanConfig boundary**: `scan()` now accepts `ScanConfig` (scan-relevant fields only) rather than the full `FlagLintConfig`, decoupling the scanner from CLI output concerns (`reportTitle`, `outputDir`).
- **Report count consistency**: Markdown and HTML stale candidate counts now exclude wildcard (`*`) usages, matching the CLI summary.

## [0.2.1] - 2026-05-23

### Fixed

- **Parse failure on generic TypeScript arrow functions** — `flagPredicate = <T>(...)` and similar generic arrows in `.ts` files now parse correctly. Root cause: `@typescript-eslint/typescript-estree` wasn't receiving a `filePath`, so it couldn't apply TypeScript's extension-based JSX rules. Adding `filePath` tells the compiler to treat `.ts` files as non-JSX (generics parse cleanly) and `.tsx` as JSX (LDProvider detection still works). Validated against LaunchDarkly's own docs codebase.

### Added

- **`wrappers` config option** — detect custom wrapper functions as flag usages. Add your wrapper names to `.flaglintrc`:
  ```json
  { "wrappers": ["flagPredicate", "useFlag", "getFlag", "isEnabled"] }
  ```
  FlagLint will treat calls to these functions as `variation`-equivalent. Supports static and dynamic flag keys. Default is `[]` — no behaviour change for existing users.

## [0.2.0] - 2026-05-22

### Breaking Changes

- **`FlagUsage.isStale: boolean` replaced with `stalenessSignals: StalenessSignal[]`**
  The boolean had no provenance — you could not tell which signal (keyword, path, file-count, future LD API age) caused a flag to be marked stale. Replaced with a typed union array that records every signal that fired and why.

  **Migration:** Replace `usage.isStale` checks with the exported helper:
  ```typescript
  import { isStale } from "flaglint";
  if (isStale(usage)) { ... }
  ```
  JSON report consumers: the `usages[].isStale` field is gone. Use `usages[].stalenessSignals.length > 0` or the `isStale()` helper. Reports now include staleness provenance (source + keyword/pattern/count).

- **Renamed config field: `staleThreshold` → `minFileCount`**
  The field was previously documented as "days before a flag is considered stale" but was actually implemented as a file-count threshold (a flag is stale if it appears in ≤ N files). The rename makes the actual behavior honest.

  **Migration:** In your `flaglint.config.json` or `.flaglintrc`, rename the field:
  ```json
  // Before
  { "staleThreshold": 5 }
  // After
  { "minFileCount": 5 }
  ```

### Changed

- Extracted shared stale detection logic (`STALE_KEYWORDS`, `checkStale`, `staleReason`) into `src/stale.ts` — single source of truth, eliminates duplicate keyword lists between scanner and reporter

### Roadmap

- `v0.3`: Replace `minFileCount` with real date-based staleness detection via `git log` integration

## [0.1.5] - 2026-05-21

### Fixed

- Corrected the README CI badge URL.

## [0.1.0] - 2026-05-18

### Added

- `flaglint scan` command — scans codebase for LaunchDarkly SDK usage and reports flag inventory
- `flaglint migrate` command — analyzes migration readiness and generates an OpenFeature migration plan
- Detects `variation()`, `variationDetail()`, `allFlags()`, React hooks (`useFlags`, `useLDClient`), HOC (`withLDConsumer`), and Provider (`LDProvider`) patterns
- Markdown, JSON, and HTML report formats
- HTML reports include filterable flag table and light/dark mode support
- Stale flag detection heuristics based on key names (`old`, `deprecated`, `legacy`, `temp`, `tmp`, `test`, `demo`) and file paths
- Dynamic flag key identification — flags whose keys are determined at runtime
- Migration readiness score (0–100) with per-pattern deductions
- Automatic OpenFeature equivalent mapping for all detected call types
- `.flaglintrc` config file support with Zod validation and clear error messages
- `--dry-run` flag for `migrate` command
- Exit code `1` when stale flags found (enables CI blocking)
- GitHub Actions CI integration across Node.js 18, 20, and 22
- Test suite with 57 tests and ≥75% coverage across scanner, reporter, and config modules
