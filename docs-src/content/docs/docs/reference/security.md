---
title: Security
description: Security reporting and local-analysis trust boundary.
lastUpdated: 2026-05-28
---

FlagLint runs locally against source files. It does not send source code or flag keys to a hosted FlagLint service.

## Vulnerability Reporting

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/flaglint/flaglint/security/advisories/new). Do not open a public issue for a security vulnerability.

## CI Trust Boundary

Validation SARIF is generated from local source analysis. Review generated findings and keep provider credentials out of reports and source fixtures.

## Feedback

- [Edit this page on GitHub](https://github.com/flaglint/flaglint/edit/main/docs-src/content/docs/reference/security.md)
- [Report an unsupported pattern](https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml)
- Next: [FAQ](/docs/reference/faq/)
