# Contributing to FlagLint

Thank you for your interest in contributing.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
git clone https://https://github.com/flaglint/flagkit-cli.git
cd flaglint
npm install
npm run build
npm test
```

## Development

```bash
npm run dev        # tsup --watch, rebuilds on file changes
npm run typecheck  # TypeScript strict-mode check without emitting
```

## Testing

```bash
npm test           # Vitest in watch mode
npm run test:run   # Single pass, no watch
npm run test:coverage  # Single pass with v8 coverage report
```

All tests must pass and coverage must meet the configured thresholds (75% lines/functions, 70% branches) before a PR will be merged.

## Code style

- TypeScript strict mode — no `any`, no `@ts-ignore`
- Prefer `const` over `let`; avoid `var`
- Meaningful variable names — avoid single-letter names outside loop indices
- No comments that restate what the code already says
- Keep functions small and single-purpose

## Adding a new detection pattern

1. Add the detection logic in `src/scanner/index.ts` inside `detectUsages()`
2. Add a corresponding fixture file in `src/scanner/tests/fixtures/`
3. Add test cases in `src/scanner/tests/scanner.test.ts`
4. Update the README detection list

## PR process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Ensure `npm run test:run` and `npm run typecheck` both pass
5. Open a PR with a clear description of the change and why

## Commit format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Unleash SDK detection patterns
fix: handle template literal flag keys with expressions
docs: update README migration table
test: add variationDetail fixture
chore: bump @typescript-eslint to 8.x
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`
