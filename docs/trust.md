# FlagLint — Trust and Provenance

This document describes FlagLint's security posture, data handling, safety
boundaries, release provenance, and test coverage. Every claim below is
grounded in the source code or CI configuration — references are provided.

---

## Runs locally — no data leaves your machine

FlagLint is a local CLI. When you run `flaglint scan` or `flaglint migrate`,
the tool reads source files from the directory you specify, performs static
analysis in-process, and writes the report or transformed files to disk.

**Verification:** The `src/` directory contains no HTTP client imports (`fetch`,
`http`, `https`, `axios`, `got`, or equivalent). URL strings that appear in
`src/reporter/index.ts` and `src/validator/index.ts` are documentation
hyperlinks embedded in generated SARIF output, not outbound requests. See:

- `src/commands/scan.ts` — reads files, writes report to stdout or disk
- `src/commands/migrate.ts` — reads files, applies AST transforms locally
- `src/scanner/local-source.ts` — `LocalFileSource` wraps `fs/promises`

No source code, flag keys, or file paths are transmitted to any external service.

---

## No LaunchDarkly SDK key required

`flaglint scan` and `flaglint migrate` operate entirely on source text using
AST parsing. They do not call the LaunchDarkly REST API, do not evaluate
flags at runtime, and do not require an SDK key or any credentials.

**Verification:** `src/commands/scan.ts` and `src/commands/migrate.ts` accept
no API key options. The scanner (`src/scanner/index.ts`) uses
`@typescript-eslint/typescript-estree` to parse source files — no network calls.

---

## Auto-apply safety boundaries

`flaglint migrate --apply` rewrites call sites in-place. The following guards
are enforced before any file is written:

| Guard | Where enforced |
|---|---|
| Dirty-tree guard: refuses if git working tree has uncommitted changes (override with `--allow-dirty`) | `src/migrator/apply.ts` — `defaultIsWorkingTreeDirty()` runs `git status --porcelain` |
| OpenFeature client binding required: skips any file without a proven local `OpenFeature.getClient()` binding or configured imported shared client allowlisted with `openFeatureClientBindings` | `src/migrator/apply.ts` — `getOpenFeatureClientBindingName()` |
| AST-grounded replacement: ranges are verified against the original call expression text before writing | `src/migrator/apply.ts` — `buildReplacement()` stale-analysis guard |
| Skips detail methods, dynamic keys, unknown fallbacks, and bulk calls | `src/migrator/apply.ts` — `buildReplacement()` |
| Idempotent: re-running on already-transformed files makes no changes | Range-content guard in `buildReplacement()` |

Auto-apply only rewrites the four typed variation methods
(`boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`) where
the flag key, fallback value, evaluation context, and OpenFeature client binding
are all statically verifiable.

Configured imported shared-client bindings use glob-safe `modulePatterns`.
Aliased imports preserve the local identifier, TypeScript ESM `.js` runtime
import specifiers are recognized, and ambiguous or unconfigured imports skip
safely. Provider/bootstrap setup is never inserted automatically.

---

## Path-traversal protection

The scanner resolves all file paths relative to the scan root and rejects paths
that escape the root directory. This is enforced in `src/scanner/index.ts`.

---

## Supported Node.js versions

| Node.js | Supported |
|---------|-----------|
| 20.x    | Yes       |
| 22.x    | Yes       |
| Older   | No        |

Source: `package.json` `engines.node` field (`>=20`).
CI validates both Node 20 and Node 22 on every push to `main` and on every
pull request (`.github/workflows/ci.yml`, `.github/workflows/pr-checks.yml`).

---

## Release provenance

The project release workflow is configured to publish to npm through GitHub
Actions using npm Trusted Publishing/OIDC. The publish job uses Node 24 because
npm Trusted Publishing has stricter runtime requirements; FlagLint runtime
support remains Node.js >=20.

npm-side Trusted Publisher configuration must be completed before the first
OIDC-based publication unless it has already been configured and verified. This
document does not claim that historical releases were OIDC-published or that no
maintainer has ever published locally.

The release pipeline (`.github/workflows/release.yml`) enforces these steps in order:

1. **Verify** — runs `npm run build`, `npm run typecheck`, and `npm run test:run`
   on Node 20 AND Node 22 before publishing.
2. **Tag check** — confirms the git release tag matches the `version` field in
   `package.json`; mismatches fail the job before any publish step.
3. **Publish** — uses `npm publish --access public` through npm
   [Trusted Publishing / OIDC](https://docs.npmjs.com/trusted-publishers)
   (`id-token: write` permission), once npm-side Trusted Publisher configuration
   is complete.

The `publish` job requires the `verify` job to succeed first.
A failed test or type error on either Node version blocks publication.

---

## CodeQL static analysis

GitHub CodeQL runs on every push to `main` and every pull request targeting `main`,
scanning TypeScript source for common vulnerability patterns
(`.github/workflows/codeql.yml`).

---

## Test coverage

FlagLint uses Vitest with the `@vitest/coverage-v8` coverage provider.
Coverage is collected on every CI run (`npm run test:coverage`) and uploaded
as a build artifact.

The test suite covers:

- AST scanner: flag detection, typed methods, aliased clients, false-positive
  patterns, dynamic keys, CJS and ESM import styles, custom wrapper functions
- Reporter: JSON, Markdown, HTML, SARIF output formats
- Migrator: evidence-based reporting, dry-run diffs, `--apply` transformations,
  dirty-tree guard, OpenFeature client binding detection
- Validator: `--no-direct-launchdarkly` rule, `--bootstrap-exclude` glob matching
- Config loader: Zod schema validation, config file search order
- CLI commands: exit codes, argument validation, SIGINT handling

Precision and recall claims in the README ("100% precision and recall for the
120 tested benchmark cases") are bounded explicitly to those test cases and to
the LaunchDarkly Node.js server-side SDK call patterns listed in the supported
API matrix. Claims beyond those cases are not made.

Core behavior is covered by automated tests executed in CI on supported Node
versions. Avoid treating a local ad hoc test count as a long-lived trust claim;
the authoritative signal is the CI run for the branch or release being reviewed.

---

## Enterprise demo

The [enterprise checkout service demo](../examples/enterprise-checkout-service)
shows a realistic migration workflow:

- scan inventory;
- exact `migrate --dry-run` preview;
- guarded `migrate --apply`;
- migration-in-progress advisory findings;
- completed-state `validate --no-direct-launchdarkly` hard gate.

---

## License

MIT — see [LICENSE](../LICENSE).

Copyright (c) 2026 FlagLint Contributors.

---

## Reporting a false positive or unsupported pattern

If FlagLint reports a call site it should not (false positive) or misses one
it should detect, open an issue using the "Unsupported pattern" template:

https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml

---

## Contact

For security vulnerabilities, see [SECURITY.md](../SECURITY.md).
For bugs or feature requests, see [GitHub Issues](https://github.com/flaglint/flaglint/issues).

SARIF enforcement and rule ID

For CI-based policy enforcement, run:

  flaglint validate --no-direct-launchdarkly --format sarif --output policy-report.sarif

The SARIF output includes a policy rule with the id "flaglint.direct-launchdarkly" which can be consumed by code-scanning or policy tooling to gate merges.
