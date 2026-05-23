# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
