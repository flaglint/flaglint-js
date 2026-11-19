---
name: flaglint-architecture
description: Evaluate or document architectural changes to FlagLint. Use for parser, scanner, migrator, public schema, service-boundary, or major dependency decisions that may require an ADR.
---

# FlagLint Architecture

Keep architectural decisions consistent with FlagLint's accepted constraints.

## Workflow

1. Read `AGENTS.md` and every file in `docs/adr/`.
2. Trace the current implementation and tests before proposing a change.
3. State the problem, constraints, alternatives, trade-offs, compatibility impact,
   and validation strategy.
4. If the decision changes an accepted constraint, create a new numbered ADR; never
   rewrite an accepted ADR.
5. Keep proposals separate from implementation unless the user asks for both.

## Non-Negotiable Boundaries

- Keep TypeScript strict, ESM, and the current AST parser unless superseded by an ADR.
- Preserve static analysis; do not add runtime flag evaluation.
- Migrate toward OpenFeature, not another proprietary vendor.
- Keep changes within the documented public CLI scope unless an accepted ADR expands it.
- Treat public CLI and JSON changes as compatibility decisions, not incidental refactors.
