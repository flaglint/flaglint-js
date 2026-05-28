---
title: Security
description: Security and vulnerability reporting for FlagLint.
lastUpdated: 2026-05-28
---

FlagLint is a local CLI that analyzes source files. It does not send repository contents to a hosted service.

For vulnerability reporting instructions, see the repository security policy:

- [SECURITY.md](https://github.com/flaglint/flaglint/blob/main/SECURITY.md)

## Trust Notes

- npm publishing is configured through GitHub Actions and npm Trusted Publishing/OIDC.
- Runtime support is Node.js 20 or newer.
- CI validates supported Node.js versions.
- Policy SARIF uses rule id `flaglint.direct-launchdarkly`.

For implementation details, see:

- [Trust documentation](https://github.com/flaglint/flaglint/blob/main/docs/trust.md)
