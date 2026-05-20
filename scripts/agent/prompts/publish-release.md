# Pre-Publish Checklist

Run these checks before publishing to npm. Verify each passes:

1. `npm run test:run` — all 57+ tests must pass
2. `npm run build` — must succeed with no TypeScript errors
3. `npm run typecheck` — must pass with zero diagnostics
4. Confirm CHANGELOG.md has an entry for the version being released
5. Confirm package.json version is bumped correctly (semver)
6. Append a release entry to MEMORY.md with today's date
7. Run the launch sequence: `npm run agent -- launch <version>`

NEVER run `npm publish` yourself. Print the command and tell the human to run it from their npm account:

  npm publish
