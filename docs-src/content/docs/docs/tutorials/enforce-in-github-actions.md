---
title: Enforce in GitHub Actions
description: Use validation SARIF to block new direct LaunchDarkly evaluation calls.
lastUpdated: 2026-05-28
---

Use `scan` for inventory and `validate` for policy enforcement.

## Blocking Validation

```yaml
name: FlagLint
on: [pull_request]

jobs:
  flaglint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx flaglint validate ./src --no-direct-launchdarkly
```

Do not put `continue-on-error: true` on the blocking validation step.

## SARIF Annotations

```yaml
- name: Validate direct SDK policy
  run: |
    npx flaglint validate ./src \
      --no-direct-launchdarkly \
      --bootstrap-exclude "src/provider/setup.ts" \
      --format sarif \
      --output flaglint-validation.sarif

- name: Upload SARIF
  if: always()
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: flaglint-validation.sarif
```

SARIF findings use rule id `flaglint.direct-launchdarkly`.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/tutorials/enforce-in-github-actions.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [Shared Client Architecture](/docs/tutorials/shared-client-architecture/)
