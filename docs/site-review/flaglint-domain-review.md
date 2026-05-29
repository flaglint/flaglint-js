# FlagLint Domain Review Package

This document provides information to support a web-filtering category review for
`flaglint.dev`. It is intended for use with URL-categorization tools such as Zscaler
Site Review, Symantec WebPulse, or similar services.

---

## Domain

**`flaglint.dev`**

---

## Product summary

FlagLint is an open-source, MIT-licensed command-line tool for Node.js developers.
It statically analyzes JavaScript and TypeScript source files to inventory direct
LaunchDarkly Node.js server SDK calls, generate reviewable OpenFeature migration plans,
and enforce OpenFeature migration policy in CI pipelines.

FlagLint is a **developer productivity and migration tooling product**. It is not a web
application, proxy, VPN, download mirror, advertising network, or entertainment site.

---

## Intended audience

Software developers and platform engineering teams using Node.js who are migrating
LaunchDarkly SDK usage to the OpenFeature standard API.

---

## Suggested categorization

**Developer Tools** / Software Development / Technical Reference

Alternative acceptable categories: Open Source Software, Computer and Internet Info,
Technical Documentation.

---

## Site content

| Page | URL | Content type |
|------|-----|-------------|
| Homepage | https://flaglint.dev/ | Product overview, CLI demonstration, installation instructions |
| Documentation | https://flaglint.dev/docs/ | Technical reference for CLI commands, configuration, and integrations |
| Quickstart | https://flaglint.dev/docs/quickstart | Step-by-step installation and first-scan guide |
| Enterprise Demo | https://flaglint.dev/docs/enterprise-demo | Annotated migration walkthrough with real code examples |
| Security & Trust | https://flaglint.dev/trust | Trust statement, data handling, security reporting |
| Privacy | https://flaglint.dev/privacy | Privacy disclosure (no analytics, no cookies, local-only CLI) |
| GitHub Repository | https://github.com/flaglint/flaglint | Source code (MIT license) |
| npm Package | https://www.npmjs.com/package/flaglint | Published npm package |

---

## What this site is

- A **developer documentation and product homepage** for an open-source CLI tool
- **Static HTML pages** — no server-side execution, no user-generated content, no dynamic forms
- **No tracking scripts** — no Google Analytics, Plausible, Mixpanel, or equivalent
- **No cookies** set by flaglint.dev
- Hosted on **Cloudflare Pages** (static file hosting)

---

## What this site is not

- ❌ Not a download mirror or file-sharing site
- ❌ Not an advertising network or ad-supported site
- ❌ Not a proxy, anonymization service, or VPN
- ❌ Not a gambling, adult, or entertainment site
- ❌ Not a social media or user-generated-content platform
- ❌ Not a phishing, malware, or suspicious-content site
- ❌ Not a cryptocurrency exchange or financial service

---

## Repository and provenance

| Property | Value |
|----------|-------|
| Source repository | https://github.com/flaglint/flaglint |
| License | MIT — https://github.com/flaglint/flaglint/blob/main/LICENSE |
| npm package | https://www.npmjs.com/package/flaglint |
| Security policy | https://github.com/flaglint/flaglint/blob/main/SECURITY.md |
| Security contact | https://github.com/flaglint/flaglint/security/advisories/new |
| security.txt | https://flaglint.dev/.well-known/security.txt |
| Changelog | https://github.com/flaglint/flaglint/blob/main/CHANGELOG.md |
| Current version | 0.5.3 (from `package.json` as of this document) |
| Runtime requirement | Node.js 20 or newer |
| Deployment | Cloudflare Pages (static) |

---

## Security and data handling summary

From https://flaglint.dev/trust:

- FlagLint is a **local CLI**. Source code is analyzed on the developer's machine only.
- **No source code, flag keys, or file paths are transmitted to any server** during CLI operation.
- The CLI makes no outbound network connections during scan or migration.
- No LaunchDarkly SDK key is required for scan or migration commands.
- The website contains no analytics scripts and sets no cookies.

---

## Deployment date

The domain `flaglint.dev` has been in active development since May 2026.
First public documentation deployment: May 2026.

---

## Contact

For questions about this categorization request, open a GitHub Issue at:
https://github.com/flaglint/flaglint/issues

For security concerns, use GitHub Security Advisories:
https://github.com/flaglint/flaglint/security/advisories/new

---

## Instructions for submitters

**Do not submit this form automatically.** This document is provided for manual reference
when completing a URL-category review submission (e.g., Zscaler Site Review at
https://sitereview.zscaler.com/). A human reviewer should copy the relevant fields
into the submission form.

This document does not claim or imply approval from Zscaler, Fidelity, or any employer
web-filtering policy. Domain categorization is at the discretion of the reviewing service.
Corporate policy may restrict access to a category even after reclassification.
