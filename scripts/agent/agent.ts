#!/usr/bin/env node
import { Command } from "commander";
import { runLaunch } from "./tasks/launch.js";
import { runParallel } from "./tasks/parallel.js";
import { runSyncDocs } from "./tasks/sync-docs.js";
import { runPrompt } from "./tasks/prompt.js";
import { runStatus } from "./tasks/status.js";

const program = new Command();

program
  .name("agent")
  .description("FlagLint dev agent — launch, parallelize, sync docs, manage prompts")
  .version("0.1.0");

program
  .command("launch")
  .description("Run the release sequence with confirmation gates")
  .argument("[version]", "version to tag (e.g. 0.1.0)", "0.1.0")
  .addHelpText(
    "after",
    `
Examples:
  $ npm run agent -- launch           use version from package.json (default 0.1.0)
  $ npm run agent -- launch 0.2.0    tag and push v0.2.0`
  )
  .action(runLaunch);

program
  .command("parallel")
  .description("Run multiple Claude Code prompts in parallel terminal sessions")
  .argument("<prompts>", "comma-separated prompt names (e.g. fix-bug,add-feature)")
  .option("--isolated", "each prompt runs in its own git worktree")
  .addHelpText(
    "after",
    `
Examples:
  $ npm run agent -- parallel fix-bug,add-feature
  $ npm run agent -- parallel write-blog-post --isolated`
  )
  .action(runParallel);

program
  .command("sync-docs")
  .description("Append a decision to MEMORY.md (append-only, never edits past entries)")
  .requiredOption("--decision <text>", "decision text to record")
  .option("--adr <title>", "also create a new docs/adr/NNN-<title>.md file")
  .option("--update-claude", "also update CLAUDE.md (requires confirmation)")
  .addHelpText(
    "after",
    `
Examples:
  $ npm run agent -- sync-docs --decision "Use SWC instead of tsc"
  $ npm run agent -- sync-docs --decision "Dropped Node 18" --adr "Drop Node 18 support"`
  )
  .action(runSyncDocs);

program
  .command("prompt")
  .description("Print a reusable prompt template (omit name to list all)")
  .argument("[name]", "prompt name")
  .option("--copy", "copy to clipboard (requires clipboardy)")
  .addHelpText(
    "after",
    `
Examples:
  $ npm run agent -- prompt              list all available prompts
  $ npm run agent -- prompt fix-bug      print the fix-bug prompt
  $ npm run agent -- prompt fix-bug --copy`
  )
  .action(runPrompt);

program
  .command("status")
  .description("Print current git branch, version, and working-tree state")
  .action(runStatus);

program.parse();
