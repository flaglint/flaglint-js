# FlagLint — Domain Language

A shared vocabulary for all agents and contributors. Use these terms exactly.
Do not invent synonyms.

## Core Terms

**Flag debt** — LaunchDarkly feature flags that are stale, unused, or removable.
  Avoid: "old flags", "unused flags", "technical debt"

**Flag scan** — The process of statically analyzing source code to detect LD SDK usage.
  Avoid: "analysis", "check", "audit" (use "scan")

**Migration plan** — The generated set of code changes to replace LD SDK calls with OpenFeature.
  Avoid: "migration guide", "refactor plan"

**Stale flag** — A flag not modified/evaluated beyond the configured staleThreshold (default 90 days).
  Avoid: "old flag", "dead flag"

**Dynamic flag** — A flag whose key is computed at runtime (e.g. `ld.variation(flagKey, ...)`).
  Cannot be statically resolved; flagged as a warning.
  Avoid: "variable flag", "runtime flag"

**Flag usage** — A single call-site in source code where an LD SDK method is invoked.
  Avoid: "flag reference", "flag call"

**OpenFeature** — The CNCF-standard feature flag API that FlagLint migrates teams toward.
  Never: "open feature" (two words), "OF"

**LD / LaunchDarkly** — The vendor FlagLint scans. Always "LaunchDarkly" in user-facing copy.
  "LD" is acceptable in code and internal docs only.

**Report** — The output of `flaglint scan`: JSON, Markdown, or HTML format.
  Avoid: "output", "result", "analysis"

**CLI** — The `flaglint` npm package / command-line tool. This is the v0.1 product.

**FlagLint Cloud** — The future SaaS platform (Phase 3+). Do not conflate with the CLI.

**staleThreshold** — Config field (number of days) controlling what counts as stale.
  Exact spelling: camelCase. Do not rename.

**flaglint.config.json** — The project-level config file. Exact filename.

## Commands

`flaglint scan [dir]`   — Scans for LD usage and produces a report.
`flaglint migrate [dir]` — Generates an OpenFeature migration plan.

## What FlagLint is NOT

- Not a LaunchDarkly replacement (yet)
- Not a runtime flag evaluation library
- Not a testing tool
- Not vendor-specific (this is the moat)
