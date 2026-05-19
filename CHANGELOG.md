# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
