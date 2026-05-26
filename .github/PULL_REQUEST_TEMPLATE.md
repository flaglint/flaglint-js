# Pull Request

## Summary

<!-- What does this PR do? Why is this change needed? -->

## Changes

<!-- List the key changes made. -->

---

## Checklist

### For all changes

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run build` succeeds
- [ ] `npm test -- --run` passes (all tests green)
- [ ] `git diff --check` shows no whitespace errors

### For behavior changes (scanner, migrator, validator, reporter, config)

- [ ] New or updated tests cover the changed behavior
- [ ] Fixtures added or updated in `src/scanner/tests/fixtures/` if scanner patterns changed
- [ ] README updated if any command, option, or supported-API-matrix row changed
- [ ] CHANGELOG.md entry added (Unreleased section)

### For `flaglint migrate --apply` changes

- [ ] Safety contracts in `src/migrator/apply.ts` are preserved (dirty-tree guard,
  binding check, range-content guard, idempotency)
- [ ] No change increases the scope of automatic rewriting beyond what is listed in
  the Supported API matrix without explicit review

### For documentation or trust claims

- [ ] Every claim in `docs/trust.md` or `SECURITY.md` is verifiable from source code
  or CI configuration (cite the file and function)
- [ ] No unverified claims added

---

## Related issues

<!-- Closes #NNN or Relates to #NNN -->

## Testing notes

<!-- How did you verify this? What edge cases did you test? -->
