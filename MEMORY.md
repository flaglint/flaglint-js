# FlagLint — Decisions Log

Append-only. One entry per decision. Never edit past entries.
Format: ## [DATE] TITLE followed by bullet points.

---

## [2025-01] Foundation decisions

- Product name: FlagLint (final, not changing)
- Primary domain: flaglint.dev (.com redirects to .dev)
- Legal entity: Runtime Logic Labs LLC (not yet incorporated)
- GitHub org: github.com/flaglint
- npm package name: flaglint
- Positioning: vendor-neutral migration intelligence — the exit ramp no vendor will build
- Distribution: OSS CLI first → audience → SaaS (not SaaS-first)
- Tech stack locked: TypeScript 5+ ESM strict, Commander.js, typescript-estree, tsup, Vitest

## [2025-01] v0.1.0 architecture decisions

- staleCount counts unique flags (not usages) — prevents inflation of debt metrics
- staleThreshold is a config field (not hardcoded) — teams have different release cadences
- --format validation exits code 2 (not 1) — distinguishes user error from runtime error
- SIGINT exits code 130 — POSIX standard, important for CI pipelines
- Source maps disabled in production — reduces package size, not a debugging tool
- Path traversal protection added — security baseline for a CLI that accepts user-supplied dirs
- OpenFeature SDK calls are async/await — SDK 0.4+ is fully async, sync calls would be wrong
- withOpenFeature() HOC removed from migration output — does not exist in SDK 0.4+
- useFlag() placeholder uses specific flag key, not '*' wildcard — wildcard was a silent bug

## [2025-01] What v0.1.0 does NOT do (by design)

- Does not call LaunchDarkly API at runtime (static analysis only)
- Does not support .vue / .svelte files
- Does not evaluate flags at runtime
- Does not add vendors other than LaunchDarkly as scan targets

## [2026-05-19] Session decisions

- Test entry from agent setup
