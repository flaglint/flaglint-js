# ADR 001 — TypeScript ESM Strict Mode

Date: 2025-01
Status: ACCEPTED

## Decision
Use TypeScript 5+ with strict mode enabled and ESM module format.

## Reasoning
- Strict mode catches entire classes of bugs at compile time
- ESM is the modern standard; avoids dual CJS/ESM complexity
- tsup handles the build; no manual rollup config needed

## Consequences
- All imports must include file extensions (.js in source for ESM compatibility)
- No CommonJS require() calls
