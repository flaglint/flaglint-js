---
name: flaglint-release
description: Prepare and verify a FlagLint release, package, or version change without publishing it. Use for release readiness, npm package checks, changelog work, or dry-run packaging; not for ordinary feature development.
---

# FlagLint Release

Produce a release candidate the user can inspect and publish manually.

## Workflow

1. Read `AGENTS.md`, `package.json`, `CHANGELOG.md`, and release-related scripts.
2. Confirm the intended version and scope from the user; do not infer a release bump.
3. Run focused tests first, then `npm test`, `npm run typecheck`, and `npm run build`.
4. Run `npm pack --dry-run` and inspect the package contents for missing artifacts or private files.
5. Check that documentation, changelog entries, package metadata, and generated CLI help agree.
6. Summarize the candidate, commands run, package contents, and unresolved risks.

## Guardrails

- Never run `npm publish`, create a GitHub release, push a tag, or merge without explicit authorization.
- Do not include ignored or non-public files in the package or commit.
- Keep package and JSON schema changes backward-compatible unless the user approves otherwise.
