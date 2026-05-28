---
title: FlagLint Documentation
description: Standardize LaunchDarkly Node.js server SDK evaluation calls on OpenFeature while keeping LaunchDarkly as the provider.
lastUpdated: 2026-05-28
---

FlagLint helps platform teams inventory direct LaunchDarkly Node.js server SDK usage, plan a guarded OpenFeature migration, and enforce the new boundary in CI.

```bash
npx flaglint scan ./src
```

<div class="button-grid">
  <a href="/docs/quickstart">Quickstart</a>
  <a href="/docs/tutorials/migrate-a-node-service">Migration Tutorial</a>
  <a href="/docs/cli/scan">CLI Reference</a>
  <a href="/docs/integrations/github-actions">GitHub Actions</a>
</div>

## Choose Your Path

<div class="path-grid">
  <div class="path-card">
    <strong>Trying FlagLint for the first time</strong>
    Run a local scan, inspect the inventory output, and confirm what is inside the supported scope.
  </div>
  <div class="path-card">
    <strong>Migrating an existing Node.js service</strong>
    Configure your OpenFeature client binding, preview the migration plan, then apply only proven rewrites.
  </div>
  <div class="path-card">
    <strong>Enforcing platform standards in CI</strong>
    Use validation SARIF to annotate direct LaunchDarkly policy violations in pull requests.
  </div>
</div>

## Workflow

<div class="workflow-grid">
  <div class="workflow-step">
    <strong>1. Scan</strong>
    <code>flaglint scan ./src</code>
  </div>
  <div class="workflow-step">
    <strong>2. Migration plan</strong>
    <code>flaglint migrate ./src --dry-run</code>
  </div>
  <div class="workflow-step">
    <strong>3. Guarded apply</strong>
    <code>flaglint migrate ./src --apply</code>
  </div>
  <div class="workflow-step">
    <strong>4. CI validation</strong>
    <code>flaglint validate ./src --no-direct-launchdarkly</code>
  </div>
</div>

## What FlagLint Does

- Performs local AST-based source analysis.
- Detects supported LaunchDarkly Node.js server-side evaluation calls from `@launchdarkly/node-server-sdk` and legacy `launchdarkly-node-server-sdk`.
- Generates inventory reports and reviewable migration plans.
- Applies only call-site rewrites with proven static inputs and a proven OpenFeature client binding.
- Emits validation SARIF with rule id `flaglint.direct-launchdarkly`.

## What FlagLint Does Not Do

- It does not replace LaunchDarkly. LaunchDarkly remains the provider.
- It does not generate provider/bootstrap files automatically.
- It does not query LaunchDarkly for flag age, owner, evaluation history, environment configuration, or production usage.
- It does not detect browser SDKs, React SDKs, non-Node SDKs, or non-LaunchDarkly providers.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/index.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Quickstart](/docs/quickstart/)
