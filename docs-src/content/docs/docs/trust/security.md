---
title: Security
description: Local execution model, trust boundaries, vulnerability reporting, and CI behavior for FlagLint.
lastUpdated: 2026-06-06
---

FlagLint runs locally against your source files. It does not send source code, flag keys, reports, or migration results to a hosted FlagLint service.

## Trust Summary

**Local execution — no source upload**
FlagLint performs AST analysis entirely in the Node.js process on your machine or CI runner. No file content or flag inventory leaves your environment.

**No API key required**
`flaglint audit`, `flaglint scan`, and `flaglint migrate` do not contact LaunchDarkly or any external API. Classification is based on static source analysis only.

**npm Trusted Publishing**
Releases are published to npm through GitHub Actions using npm Trusted Publishing (OIDC). There are no long-lived npm tokens in the repository or CI environment.

**CI and SARIF behavior**
`flaglint validate` generates SARIF from local source analysis. The SARIF file is written to disk only where you configure it. Keep provider credentials out of reports and source fixtures — they may appear in scan output if embedded in source.

**Vulnerability reporting**
Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/flaglint/flaglint/security/advisories/new). Do not open a public issue for a security vulnerability.

**Privacy and telemetry**
FlagLint collects no telemetry. The CLI does not phone home. See [Privacy](/docs/trust/privacy/) for flaglint.dev website data practices.

## Runtime and CI Details

- Node.js 20 or newer is required and validated in CI.
- CI validates supported Node.js versions (20, 22) on every pull request.
- Policy SARIF uses rule id `flaglint.direct-launchdarkly`.
- Repository security policy: [SECURITY.md](https://github.com/flaglint/flaglint/blob/main/SECURITY.md)
- Trust documentation: [docs/trust.md](https://github.com/flaglint/flaglint/blob/main/docs/trust.md)

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/docs/trust/security.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
