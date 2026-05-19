# FlagLint — Agent Instructions

Read CONTEXT.md first. It defines all domain terms. Use them exactly.
Read docs/adr/ for every past architectural decision before proposing changes.

## What this repo is

FlagLint is a TypeScript CLI tool that scans JavaScript/TypeScript codebases for
LaunchDarkly SDK usage, detects flag debt, and generates OpenFeature migration plans.

npm package: `flaglint`
Commands: `flaglint scan [dir]` | `flaglint migrate [dir]`

## Tech stack (FINAL — do not change without an ADR)

- TypeScript 5+ strict mode, ESM
- Commander.js (CLI framework)
- @typescript-eslint/typescript-estree (AST parsing)
- fast-glob (file discovery)
- chalk + ora (terminal UX)
- Zod (config validation)
- tsup (build)
- Vitest (tests)
- GitHub Actions CI (Node 20/22)

## Build commands

```bash
npm run build      # tsup build
npm test           # vitest run (57 tests, all must pass)
npm run typecheck  # tsc --noEmit
```

## Current version: v0.1.0

Status: BUILT AND VERIFIED. All 57 tests passing.
Do not refactor core scanner or migrator logic without an ADR.

## Architectural rules

1. All file I/O is async/await — no sync fs calls
2. Path traversal protection is in place — do not remove it
3. staleCount counts unique flags, not usages — do not change this
4. --format validation exits with code 2 on invalid format — preserve this
5. SIGINT exits with code 130 — preserve this
6. Source maps are disabled in production build — do not enable
7. OpenFeature calls use await — do not remove async/await
8. useFlag() placeholder must never use '*' as a real flag key

## What NOT to do

- Do not suggest switching to a different AST parser
- Do not add runtime flag evaluation — FlagLint is a static analysis tool
- Do not add vendor-specific logic for any vendor other than LaunchDarkly
- Do not change the CLI command names or flag names without approval
- Do not publish to npm — always ask the human to do this

## Agent skills available

See docs/agents/ for issue tracker config and triage labels.
Read docs/adr/ before any architectural change.

## File layout

```
bin/
  flaglint.ts          # entrypoint (imports cli.ts)
src/
  cli.ts               # Commander program setup
  types.ts             # shared interfaces (FlagUsage, ScanResult, etc.)
  config.ts            # .flaglintrc loader + Zod schema
  scanner/
    index.ts           # scan() — AST-based LD usage detection
    tests/
      scanner.test.ts
      fixtures/        # ld-basic.ts, ld-react.tsx, ld-stale.ts, ld-dynamic.ts, …
  reporter/
    index.ts           # formatReport() — markdown | json | html
    tests/
      reporter.test.ts
  migrator/
    index.ts           # analyze() + formatMigrationReport()
  commands/
    scan.ts            # registerScanCommand()
    migrate.ts         # registerMigrateCommand()
  config/
    tests/
      config.test.ts
```
