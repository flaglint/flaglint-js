---
name: flaglint-docs-sync
description: Synchronize FlagLint documentation with the implemented CLI. Use for documentation drift checks, release documentation, command-reference updates, or validation of code samples.
---

# FlagLint Docs Sync

Make the documentation accurately describe the current product.

## Authority Order

1. Accepted ADRs and explicit product contracts.
2. Current source and generated CLI help.
3. Tests and runnable examples.
4. Existing prose documentation.

## Workflow

- Compare generated `--help` output with command documentation and README examples.
- Run code samples in temporary directories when practical; never assume they work.
- Verify report formats, exit codes, supported SDK scope, limitations, and changelog pages.
- Build the docs after edits and report any examples that cannot be executed.
- Keep terminal output real and current; do not invent screenshots or command results.

Do not broaden product claims to make the docs read better. Document limitations plainly.
