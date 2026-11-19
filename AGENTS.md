# FlagLint Agent Guidance

## Scope

These instructions apply to the entire repository. More specific `AGENTS.md`
files may add or override guidance within their directory tree.

FlagLint is a TypeScript CLI that statically scans JavaScript and TypeScript for
LaunchDarkly SDK usage, identifies flag debt, and generates OpenFeature migration
plans. Keep the CLI vendor-neutral at its output boundary: LaunchDarkly is the
current scan source and OpenFeature is the migration target.

## Start Here

- Read every accepted record in `docs/adr/` before proposing an architectural change.
- Never edit an accepted ADR. Add a new ADR that supersedes it.
- Treat ignored and maintainer-supplied non-public material as private.

## Commands

Run the narrowest relevant validation first, then expand when needed:

```bash
npm test
npm run typecheck
npm run build
```

Use `npm pack --dry-run` for package-boundary or release work. Build the docs when
changing documentation or site code.

## Engineering Invariants

- Keep TypeScript strict and ESM-only.
- Use async file I/O; do not introduce synchronous filesystem calls.
- Keep `@typescript-eslint/typescript-estree` as the parser unless a new ADR says otherwise.
- Preserve path-traversal protection.
- Count stale flags by unique flag key, not by usage count.
- Preserve exit code `2` for invalid user input and `130` for `SIGINT`.
- Keep production source maps disabled.
- Keep generated OpenFeature evaluation calls asynchronous.
- Never use `"*"` as a real flag key; it is only a dynamic-key placeholder.
- Keep JSON changes additive unless the user explicitly approves a breaking change.

## Product Boundary

Keep this repository focused on the documented public CLI. Pause and ask before
implementing behavior outside its documented scope.

Do not add runtime flag evaluation. Do not add a proprietary migration target.
Do not rename public CLI commands or options without explicit approval.

## Safety

- Work on a branch; never push directly to `main`.
- Do not publish to npm, merge a PR, post publicly, send email, or change external
  account settings unless the user explicitly authorizes that action.
- Keep drafts and non-public working material in ignored local paths.
- Before staging, inspect the staged diff and exclude all ignored or non-public material.

## Agents And Skills

Tool-neutral agent roles live in `.agents/agents/`:

- `flaglint-engineer`: implementation, debugging, and verification.
- `flaglint-docs`: documentation accuracy and content quality.

Reusable technical workflows live in `.agents/skills/`:

- `flaglint-architecture`: architectural analysis and ADR work.
- `flaglint-docs-sync`: CLI and documentation consistency.
- `flaglint-release`: release-candidate preparation and verification.
- `flaglint-triage`: evidence-based issue, PR, and regression triage.

These files are plain Markdown and must not depend on a particular agent vendor,
model, or hosted service. Use a skill when the request matches its description.
Use subagents only for independent parallel work; keep tightly coupled
implementation in the main thread.
