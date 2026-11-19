# FlagLint Agents and Skills

This directory is the tool-neutral source of truth for FlagLint's reusable agent
roles and workflows. Everything here is plain Markdown so it can be read by a
person, copied into an agent prompt, or loaded by any automation that supports
text instructions.

## Layout

- `agents/` contains role prompts for delegating focused work.
- `skills/` contains task workflows in `SKILL.md` files.

No agent vendor, model, hosted account, or proprietary runtime is required. Tool-
specific adapters should remain local or live outside this directory.

## Running an agent

Give an agent the repository-level `AGENTS.md`, then append the relevant role from
`agents/` and any matching `SKILL.md`. The agent should run from the repository
root so paths and validation commands resolve consistently.

Execution wrappers and tool-specific configuration should remain local. The
repository defines portable instructions, not a required agent runtime.
