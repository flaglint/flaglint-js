---
title: Changelog
description: Recent FlagLint releases and what changed.
lastUpdated: 2026-06-22
tableOfContents: false
---

import { LinkCard } from '@astrojs/starlight/components';

## [1.0.0] — 2026-06-22

### Summary
v1.0.0 is the CI-readiness release. The core scanner and migrator are stable. This release adds stable finding fingerprints, baseline-aware CI enforcement, and the documented safety model that makes FlagLint adoptable by platform teams without needing to fix all existing debt first.

### Added
- **Stable finding fingerprints** — each finding now carries a `fingerprint: string` field (`launchdarkly:callType:flagKey:normalizedFilePath`) that remains stable across line-number changes. Fingerprints are the foundation for baseline mode and SARIF result identity.
- **Baseline mode** — `flaglint audit --write-baseline <file>` captures current debt fingerprints. `flaglint validate --baseline <file> --fail-on-new` fails CI only for findings not in the baseline, enabling day-one CI adoption without requiring teams to fix all historical debt first.
- **Safety model docs** — `/docs/concepts/safety-model/` documents what FlagLint will and will not auto-rewrite, and why safety takes precedence over coverage.
- **JSON output contract** — documented v1.x compatibility promise: existing fields will not be renamed, removed, or retyped within v1.x; new fields may be added additively only.
- **Stable exit codes** — documented 0/1/2/3 contract: 0=success, 1=policy failure, 2=invalid input, 3=internal error.
- **ADR 007** — stable finding fingerprint schema.
- **ADR 008** — baseline mode design, file format, and edge case behavior.
- **Expanded fixture coverage** — golden fixtures for bulk methods, detail methods, and false-positive guards.

### Scope (v1.x)
- **Supported:** LaunchDarkly Node.js server SDK (`@launchdarkly/node-server-sdk`, `launchdarkly-node-server-sdk`)
- **Out of scope:** Browser SDK, React SDK, Go, Python, Java — see safety model docs

---

## [0.9.0] — 2026-06-20

### Added

- **GitHub Actions composite action** — `uses: flaglint/flaglint@v0.9.0` runs
  `npx flaglint@latest audit` in CI without any additional setup. Documented in
  [GitHub Actions integration](/docs/integrations/github-actions/).
- **Risk taxonomy: Automatable tier** — medium-risk flags that are safely
  automatable via `flaglint migrate` now display as **Automatable** (teal badge)
  in terminal, markdown, and HTML reports. JSON output gains an additive
  `displayTier` field (`"high"` | `"medium"` | `"automatable"` | `"low"`).
- **Zero-staleness explanation** — when no staleness signals fire, the audit
  report now shows which signals were checked and why git-history staleness
  requires metadata unavailable in a static scan.
- **CJS destructured import detection** — `const { boolVariation } = require('launchdarkly-node-server-sdk')` patterns now detected by the scanner.
- **[Product Contract](/docs/product-contract/)** — seven permanent promises
  FlagLint makes to every user (free CLI forever, runs locally, no telemetry,
  static analysis only, safety over coverage, stable JSON output, OpenFeature
  migration target).
- **Weekly metrics report script** (`npm run metrics:report`) — prints npm
  download trends and GitHub star/fork/issue history from local collected data.
- **ADR 004 — React/browser SDK detection** (PROPOSED) — design for detecting
  `launchdarkly-react-client-sdk` and `launchdarkly-js-client-sdk` usage;
  adds `sdkSurface` and `flagKeyIsCamelCased` fields to `FlagUsage`.
- **ADR 004 — Policy-as-code** (PROPOSED) — `.flaglintpolicy.yaml` governance
  layer with exception registry, expiry enforcement, and SARIF rule IDs.
- **ADR 005 — Cleanup command** (DEFERRED) — documents the safe path for
  automated branch removal via `--assume`/`--flag-values`; deferred until
  `--assume` mechanism is designed.
- **ADR 006 — Go language support** (PROPOSED) — tree-sitter-go parser design,
  import tracing for `go-server-sdk`, go.mod boundary handling, 6-phase plan.

### Fixed

- Audit report risk badges are now consistent: safely-automatable medium calls
  no longer show `🟡 Medium`, eliminating the contradiction for a manager
  reading a screenshot.

### Documentation

- FAQ expanded with config file formats, wrapper detection, and CI usage.
- Why FlagLint page rewritten to sharpen positioning around flag debt and the
  OpenFeature migration path.
- Homepage reframed around "feature flag debt" rather than point-in-time audit.

### Infrastructure

- DCO check now skips `dependabot[bot]` and `github-actions[bot]` commits.
- npm `files` array no longer publishes `bin/` TypeScript source — only `dist/`.
- Repository governance checks added (#120).

---

## [0.8.0] — 2026-06-13

### Breaking

- **`--cost-estimate` renamed to `--effort-estimate`** — the flag outputs hours, not
  dollars; "effort" is more accurate. Update any scripts or CI pipelines that use
  `--cost-estimate`. The `--hourly-rate` flag is unchanged.

### Fixed

- Homepage email-capture / Loops signup section removed.
- Homepage version now read from `package.json` at build time — can no longer drift
  from the published npm version.
- `robots.txt` sitemap URL corrected to `/sitemap-index.xml` (was `/sitemap.xml`, 404).
- Audit sample corrected to real fixture output: 13 unique flags across 19 call sites,
  readiness 53/100, estimate 20.8h–40h.

### Infrastructure

- Vitest timeouts raised to 30 s to fix flaky Windows/Node 22 CI runs.
- `npm publish --provenance` re-enabled in release workflow.
- `scripts/metrics/collect.mjs` added for tracking npm downloads and GitHub stats.

---

## [0.7.0] — 2026-06-07

### Added

- **`flaglint audit --effort-estimate`** — directional migration-effort estimate in audit
  output. Produces a low/high hour range from automatable and manual-review call counts.
  Assumptions and disclaimer included in all report formats.
- **`flaglint audit --hourly-rate <rate>`** — engineering cost projection added to the
  estimate (`costLow` / `costHigh`). Requires `--effort-estimate`.
- **Migration readiness score** — `flaglint audit` now prints a 0–100 score and progress
  bar showing the fraction of safely automatable calls, with grade (`ready`, `moderate`,
  `complex`, or `not-applicable`).
- **[Migration Readiness concept page](/docs/concepts/migration-readiness/)** — explains
  the ratio formula, grade thresholds, and the 5 manual-review categories.
- **[Effort Estimation CLI reference](/docs/cli/effort-estimate/)** — documents the algorithm,
  default assumptions, minimum-hours floor, and hourly-rate behavior.

---

## [0.6.0] — 2026-06-02

### Added

- **`flaglint audit [dir]`** — new command that generates a local flag debt audit report.
  Classifies detected LaunchDarkly Node.js SDK usage by migration risk based on call
  type, static analyzability, and migration complexity. Supports `--format json`,
  `--format markdown`, and `--format html`. No LaunchDarkly API key or credentials
  required.
- **`openFeatureClientBindings` in `ScanConfig`** — binding configuration is now
  included in `ScanConfig` for local migration planning and integration code paths.

### Fixed

- `isFeatureEnabled`, React hook (`useFlags`, `useLDClient`), and wrapper function
  call sites are now included in `migrationInventory` after scanning. Previously
  these appeared in scan reports but were invisible to `migrate --dry-run` and
  `migrate --apply`.
- `provider` field removed from `ScanConfig`. The field was accepted but never read
  by the scanner. It remains in `FlagLintConfig` for forward compatibility (v0.7).

### Changed

- README config table updated: `staleThreshold` corrected to `minFileCount`.
- README migration table: `withLDConsumer()(Component)` row updated — `withOpenFeature()`
  does not exist in the OpenFeature SDK.

---

## [0.5.4] — 2026-05-29

### Fixed

- Aliased named imports from the LaunchDarkly SDK (e.g. `import { init as ldInit }`)
  are now correctly detected by the scanner.

---

## [0.5.0] — 2026-05-28

### Changed

- Narrowed scope to LaunchDarkly Node.js server SDK → OpenFeature migration.
  React/browser SDKs explicitly documented as outside current coverage.
- `migrate --apply` guarded rewrite contract hardened: dirty git tree check,
  proven OpenFeature binding requirement, idempotency via range-content guard.

---

## [0.4.0] — 2026-05-22

### Added

- SARIF output via `validate --format sarif` for GitHub Code Scanning integration.
- Scan metadata (duration, file count) in all report formats.

---

## [0.3.0] — 2026-05-18

### Added

- `StalenessEvaluator` injectable interface — enables external evaluators without
  touching scanner logic.

---

## [0.2.0] — 2026-05-14

### Changed

- `staleThreshold` renamed to `minFileCount` (breaking change).

---

[View the full CHANGELOG.md on GitHub →](https://github.com/flaglint/flaglint/blob/main/CHANGELOG.md)

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/reference/changelog.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
