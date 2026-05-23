#!/usr/bin/env tsx
/**
 * new-branch — always branch from origin/main, push, open a PR.
 *
 * Usage:
 *   npm run new-branch -- <type> <description>
 *
 * Examples:
 *   npm run new-branch -- feat add-go-support
 *   npm run new-branch -- fix silent-file-drop
 *   npm run new-branch -- chore update-deps
 *
 * Creates: feature/add-go-support, fix/silent-file-drop, chore/update-deps
 * Then:    pushes to origin and opens a draft PR on GitHub
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TYPES = ["feat", "fix", "chore", "ci", "docs", "refactor", "test"] as const;
type BranchType = (typeof VALID_TYPES)[number];

const PREFIX_MAP: Record<BranchType, string> = {
  feat:     "feature",
  fix:      "fix",
  chore:    "chore",
  ci:       "ci",
  docs:     "docs",
  refactor: "refactor",
  test:     "test",
};

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const c = {
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function die(msg: string): never {
  process.stderr.write(`${c.red("✖ Error:")} ${msg}\n`);
  process.exit(1);
}
function info(msg: string)    { process.stdout.write(`${c.cyan("→")} ${msg}\n`); }
function ok(msg: string)      { process.stdout.write(`${c.green("✓")} ${msg}\n`); }
function warn(msg: string)    { process.stdout.write(`${c.yellow("⚠")} ${msg}\n`); }
function blank()              { process.stdout.write("\n"); }

async function run(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd);
  return stdout.trim();
}

async function runSafe(cmd: string): Promise<string | null> {
  try {
    return await run(cmd);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Usage help
// ---------------------------------------------------------------------------

function printUsage(): void {
  process.stdout.write(
    `${c.bold("new-branch")} — create a branch from main and open a PR\n` +
    `\n` +
    `${c.bold("Usage:")}\n` +
    `  npm run new-branch -- <type> <description>\n` +
    `\n` +
    `${c.bold("Arguments:")}\n` +
    `  type         ${VALID_TYPES.join(" | ")}\n` +
    `  description  kebab-case description (spaces become hyphens)\n` +
    `\n` +
    `${c.bold("Examples:")}\n` +
    `  npm run new-branch -- feat add-go-support\n` +
    `  npm run new-branch -- fix  silent-file-drop\n` +
    `  npm run new-branch -- docs update-readme\n` +
    `\n` +
    `${c.bold("Creates:")}\n` +
    `  feature/add-go-support\n` +
    `  fix/silent-file-drop\n` +
    `  docs/update-readme\n`
  );
}

// ---------------------------------------------------------------------------
// Parse and validate args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  printUsage();
  process.exit(0);
}

const [rawType, ...descParts] = args;

if (!rawType) {
  printUsage();
  process.exit(1);
}

if (!VALID_TYPES.includes(rawType as BranchType)) {
  die(
    `Invalid type "${rawType}". Must be one of: ${VALID_TYPES.join(", ")}\n` +
    `  Example: npm run new-branch -- feat add-go-support`
  );
}

const type = rawType as BranchType;

if (descParts.length === 0) {
  die(
    "Description is required.\n" +
    `  Example: npm run new-branch -- ${type} your-description-here`
  );
}

// Normalise description — spaces or hyphens both work
const description = descParts
  .join("-")
  .toLowerCase()
  .replace(/\s+/g, "-")
  .replace(/[^a-z0-9-]/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

if (!description) {
  die("Description must contain at least one alphanumeric character.");
}

const prefix     = PREFIX_MAP[type];
const branchName = `${prefix}/${description}`;

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

blank();
info(`Branch: ${c.bold(branchName)}`);
blank();

// Must be inside a git repo
const gitRoot = await runSafe("git rev-parse --show-toplevel");
if (!gitRoot) {
  die("Not inside a git repository.");
}

// Already on this branch?
const currentBranch = await run("git branch --show-current");
if (currentBranch === branchName) {
  ok(`Already on ${c.bold(branchName)}`);
  process.exit(0);
}

// Branch already exists locally?
const existingLocal = await run(`git branch --list "${branchName}"`);
if (existingLocal) {
  die(
    `Branch "${branchName}" already exists locally.\n` +
    `  To delete it: git branch -D ${branchName}\n` +
    `  To switch to it: git checkout ${branchName}`
  );
}

// Dirty working tree?
const dirty = await run("git status --porcelain");
if (dirty) {
  warn("Uncommitted changes detected. Stash them first:\n  git stash");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetch latest main
// ---------------------------------------------------------------------------

info("Fetching origin/main...");
try {
  await run("git fetch origin main --quiet");
  ok("origin/main is up to date");
} catch {
  die(
    "Failed to fetch origin/main.\n" +
    "  Check your network connection and remote access."
  );
}

// ---------------------------------------------------------------------------
// Create branch from origin/main
// ---------------------------------------------------------------------------

info(`Creating ${c.bold(branchName)} from origin/main...`);
try {
  await run(`git checkout -b "${branchName}" origin/main`);
} catch (err) {
  die(`Failed to create branch: ${(err as Error).message}`);
}
ok(`Branch created: ${c.bold(branchName)}`);

// ---------------------------------------------------------------------------
// Push to origin
// ---------------------------------------------------------------------------

blank();
info("Pushing to origin...");
try {
  await run(`git push origin "${branchName}" --quiet`);
  ok(`Pushed: origin/${branchName}`);
} catch (err) {
  die(`Failed to push branch: ${(err as Error).message}`);
}

// ---------------------------------------------------------------------------
// Open PR via GitHub CLI (if available)
// ---------------------------------------------------------------------------

blank();
const ghAvailable = await runSafe("gh --version");

if (ghAvailable) {
  info("Opening draft PR on GitHub...");

  // Try to get the GitHub repo URL for a nice display
  const repoUrl = await runSafe(
    'gh repo view --json url --jq .url'
  );

  try {
    const prTitle = description
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const prBody =
      `## Summary\n\n` +
      `<!-- Describe what this PR does -->\n\n` +
      `## Changes\n\n` +
      `- \n\n` +
      `## Testing\n\n` +
      `- [ ] \`npm test\` passes\n` +
      `- [ ] Manual testing done\n`;

    const prUrl = await run(
      `gh pr create ` +
      `--title "${type}: ${prTitle}" ` +
      `--body "${prBody.replace(/"/g, '\\"').replace(/\n/g, "\\n")}" ` +
      `--base main ` +
      `--draft`
    );

    blank();
    ok(c.bold("Draft PR created!"));
    process.stdout.write(
      `  ${c.dim("Branch :")} ${branchName}\n` +
      `  ${c.dim("PR     :")} ${prUrl}\n`
    );
  } catch (err) {
    warn(`Could not create PR automatically: ${(err as Error).message}`);
    if (repoUrl) {
      process.stdout.write(
        `  Open manually: ${repoUrl}/compare/${branchName}?expand=1\n`
      );
    }
  }
} else {
  // No gh CLI — print the manual URL
  const remoteUrl = await runSafe("git remote get-url origin") ?? "";
  const repoPath  = remoteUrl.replace(/.*github\.com[:/]/, "").replace(/\.git$/, "");

  ok("Branch pushed. Open your PR at:");
  process.stdout.write(
    `  https://github.com/${repoPath}/compare/${branchName}?expand=1\n\n` +
    `  ${c.dim("(Install GitHub CLI for automatic PR creation: https://cli.github.com)")}\n`
  );
}

blank();
ok(c.bold("Ready. Start coding."));
blank();