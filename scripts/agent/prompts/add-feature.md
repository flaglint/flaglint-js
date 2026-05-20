# Add Feature

1. Read CONTEXT.md — use domain terms exactly
2. Read CLAUDE.md — respect all architectural rules
3. Read docs/adr/ for every relevant past decision
4. Propose the design in plain text before writing any code — stop and wait for approval
5. After approval: implement with tests (maintain 75%+ line/function coverage)
6. Verify: `npm run build && npm run test:run && npm run typecheck`
7. If this introduces an architectural decision, write an ADR in docs/adr/
8. Do NOT touch existing passing tests or refactor unrelated code
