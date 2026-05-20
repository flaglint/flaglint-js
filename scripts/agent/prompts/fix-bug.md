# Fix Bug

1. Read CONTEXT.md — use domain terms exactly, no synonyms
2. Read CLAUDE.md — all architectural rules are non-negotiable
3. Read the relevant ADR(s) in docs/adr/ before touching core logic
4. Write a failing test that reproduces the bug
5. Fix the bug with the minimal change required — do not refactor unrelated code
6. Verify all 57+ tests still pass: `npm run test:run`
7. If the fix requires an architectural decision, write a new ADR in docs/adr/
8. Report: what was wrong, what changed, which files, which tests cover the fix
