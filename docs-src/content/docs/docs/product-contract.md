---
title: Product Contract
description: Seven promises FlagLint makes to every user — what it will always be, and what it will never become.
lastUpdated: 2026-06-20
---

Some tools say they're safe. FlagLint commits to it in writing.

These seven promises define what FlagLint is and what it will never become. They are not marketing copy — they are constraints that govern every decision about this tool. If any version of FlagLint violates one of them, that is a bug.

## 1. Free CLI Forever

FlagLint will always be free to install and run. No feature tiers. No account required. No rate limits on local usage. If you can run `npx`, you can use FlagLint — completely, without restriction.

## 2. Runs Locally

FlagLint runs entirely on your machine. Your source code is never uploaded, streamed, or transmitted anywhere. No cloud analysis. No server-side processing. Nothing leaves your environment.

## 3. No Telemetry

FlagLint collects zero usage data. No analytics. No crash reporting. No flag key logging. No network requests at runtime. You can verify this by running FlagLint with your network blocked — it works exactly the same.

## 4. Static Analysis Only

FlagLint will never require you to run your code, call an API, or evaluate flags at runtime. It reads source files. It never executes them. This means FlagLint is safe to run in air-gapped environments, CI pipelines, and any context where executing untrusted code is not acceptable.

## 5. Safety Over Coverage

If FlagLint cannot prove a rewrite is safe, it will not generate that rewrite — even if that means a lower automation rate on your codebase. A wrong rewrite is worse than no rewrite.

This is why the `--apply` flag can be trusted: it only applies what was already proven safe in `--dry-run`. Dynamic keys, detail evaluations, and calls without a verified OpenFeature client in scope are always routed to manual review, never silently rewritten.

## 6. Stable JSON Output

Fields in FlagLint's JSON output schema are never renamed, removed, or retyped between minor versions. New fields are always optional and additive. If you build a pipeline on `flaglint scan --format json` today, that pipeline will not break when FlagLint is updated.

Breaking changes to the schema require a major version bump and a migration guide.

## 7. OpenFeature Migration Target

FlagLint generates OpenFeature rewrites. It will never generate rewrites that lock you into a different vendor. The migration target is always the vendor-neutral [OpenFeature](https://openfeature.dev/) standard — not a replacement SaaS, not a different SDK, not a proprietary abstraction.

Your LaunchDarkly account, flag configuration, and targeting rules are untouched. Only the call-site evaluation API changes.

---

## What These Promises Mean in Practice

- FlagLint will refuse to rewrite a call it cannot statically prove is safe, even if that produces a 60% automation rate instead of 90%.
- FlagLint will never add a `--upload` flag, a login flow, or an API key requirement to core scanning functionality.
- FlagLint will never be freemium. The free CLI is the product, not a trial of something else.
- FlagLint will never make breaking changes to the JSON schema without a major version bump and a documented migration path.

## Reporting a Violation

If any version of FlagLint violates these promises, please open an issue on GitHub. These are constraints, not aspirations — violations should be reported like bugs.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/product-contract.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Security](/docs/trust/security/)
