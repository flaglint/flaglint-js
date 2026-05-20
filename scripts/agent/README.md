# FlagLint Dev Agent

A local CLI agent for shipping FlagLint faster. Lives in `scripts/agent/` and is
**never shipped in the npm package**.

Run via: `npm run agent -- <subcommand> [args]`

---

## Subcommands

### `status`
Print the current git branch, package version, and working-tree state.

```bash
npm run agent -- status
```

---

### `launch [version]`
Run the v0.1.0 release sequence with confirmation gates. Safe by design.

```bash
npm run agent -- launch          # uses default version (0.1.0)
npm run agent -- launch 0.2.0   # verify + tag + push v0.2.0
```

Steps (in order):
1. Verify working tree is clean
2. Run all tests (`npm run test:run`)
3. Run build (`npm run build`)
4. Verify `package.json` version matches the argument
5. Prompt `Tag and push v<version>? (y/N)` — only `y` proceeds
6. `git tag v<version>` + `git push origin <branch> --tags`
7. Print the `npm publish` command for the human to run manually

**This command NEVER runs `npm publish`.**
**This command NEVER force-pushes, resets, or deletes branches.**

---

### `parallel <prompts>`
Run multiple Claude Code prompts in parallel, streaming output with colored prefix tags.

```bash
npm run agent -- parallel fix-bug,add-feature
npm run agent -- parallel write-blog-post --isolated
```

Options:
- `--isolated` — each prompt runs in its own git worktree (safe, read-only snapshot)

Ctrl+C sends SIGTERM to all children (SIGKILL after 5 seconds). Exit code 0 if all succeed, 1 if any fail.

---

### `sync-docs`
Append a decision to `MEMORY.md`. Append-only — never edits past entries.

```bash
npm run agent -- sync-docs --decision "Switched build tool to SWC"
npm run agent -- sync-docs --decision "Dropped Node 18" --adr "Drop Node 18 support"
npm run agent -- sync-docs --decision "New invariant" --update-claude
```

Options:
- `--decision <text>` *(required)* — the decision to record
- `--adr <title>` — also create a `docs/adr/NNN-<title>.md` file (NNN auto-increments)
- `--update-claude` — also update `CLAUDE.md` (requires explicit `y` confirmation — CLAUDE.md is sacred)

---

### `prompt [name]`
Print a reusable prompt template from `scripts/agent/prompts/`. Omit `name` to list all.

```bash
npm run agent -- prompt                 # list all prompts
npm run agent -- prompt fix-bug         # print fix-bug.md
npm run agent -- prompt fix-bug --copy  # also copy to clipboard
```

---

## Available prompts

| Name | Purpose |
|------|---------|
| `fix-bug` | Reproduce with a failing test, fix minimally, verify 57+ tests pass |
| `add-feature` | Design first, get approval, then implement with tests |
| `publish-release` | Pre-publish checklist |
| `update-memory` | Append unrecorded session decisions to MEMORY.md |
| `write-blog-post` | dev.to / Show HN copy in FlagLint voice |

---

## Adding a new prompt

1. Create `scripts/agent/prompts/<name>.md`
2. Write the instructions in Markdown
3. Run `npm run agent -- prompt` to verify it appears in the list

No code changes needed.

---

## Safety guarantees

- **Never publishes to npm** — only prints the command for the human to run
- **Never force-pushes** — `git push --force` is not exposed anywhere in this agent
- **Never resets or deletes** — `reset --hard`, `clean -fd`, `branch -D` are not available
- **Never modifies CLAUDE.md without `--update-claude` AND explicit `y` confirmation**
- **Never edits past MEMORY.md entries** — only appends
- **All subprocess output is streamed**, not buffered
- **Ctrl+C kills all children** — no zombie processes
