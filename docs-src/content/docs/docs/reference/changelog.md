---
title: Changelog
description: Recent FlagLint releases and what changed.
lastUpdated: 2026-06-02
tableOfContents: false
---

import { LinkCard } from '@astrojs/starlight/components';

## [0.6.0] — 2026-06-02

### Added

- **`flaglint audit [dir]`** — new command that generates a local flag debt audit report.
  Classifies every detected flag as high, medium, or low risk based on call type
  (dynamic key, detail evaluation, bulk call, React hook), staleness signals, and
  migration complexity. Supports `--format json`, `--format markdown`, and
  `--format html`. No LaunchDarkly API key or credentials required.
- **`openFeatureClientBindings` in `ScanConfig`** — binding configuration is now
  included in `ScanConfig` for future FlagLint Cloud integrations.

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

- `StalenessEvaluator` injectable interface — enables FlagLint Cloud to pass an
  API-backed evaluator without touching scanner logic.

---

## [0.2.0] — 2026-05-14

### Changed

- `staleThreshold` renamed to `minFileCount` (breaking change).

---

[View the full CHANGELOG.md on GitHub →](https://github.com/flaglint/flaglint/blob/main/CHANGELOG.md)

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/reference/changelog.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
