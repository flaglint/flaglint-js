# ADR 002 — AST Parser: @typescript-eslint/typescript-estree

Date: 2025-01
Status: ACCEPTED

## Decision
Use @typescript-eslint/typescript-estree for AST parsing of TypeScript source files.

## Reasoning
- Handles TypeScript natively without a separate compilation step
- Same parser used by ESLint ecosystem — well-maintained, battle-tested
- Produces ESTree-compatible AST — familiar node types

## Consequences
- Cannot parse .vue or .svelte files (acceptable for v0.1 scope)
- Must upgrade in sync with @typescript-eslint major versions
