#!/usr/bin/env tsx
/**
 * New branch script — always branch from origin/main with a ticket number.
 * Usage: npm run new-branch -- <ticket> <type> <description>
 *
 * Examples:
 *   npm run new-branch -- 42 fix stale-detection-regression
 *   npm run new-branch -- 17 feat add-sarif-output
 *   npm run new-branch -- 5 chore update-dependencies
 *
 * Creates branch: <ticket>/<type>-<description>
 * e.g. 42/fix-stale-detection-regression
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const VALID_TYPES = ['feat', 'fix', 'chore', 'ci', 'docs', 'refactor', 'test'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg: string): never {
  process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
  process.exit(1);
}

function info(msg: string): void {
  process.stdout.write(`\x1b[36m→\x1b[0m ${msg}\n`);
}

function ok(msg: string): void {
  process.stdout.write(`\x1b[32m✓\x1b[0m ${msg}\n`);
}

async function run(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd);
  return stdout.trim();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const [ticket, type, ...descParts] = process.argv.slice(2);

if (!ticket) {
  process.stderr.write(
    'Usage: npm run new-branch -- <ticket> <type> <description>\n' +
    '\n' +
    'Arguments:\n' +
    '  ticket       GitHub issue number (e.g. 42)\n' +
    `  type         Branch type: ${VALID_TYPES.join(' | ')}\n` +
    '  description  Short kebab-case description (e.g. fix-stale-detection)\n' +
    '\n' +
    'Example:\n' +
    '  npm run new-branch -- 42 fix stale-detection-regression\n' +
    '  → creates branch: 42/fix-stale-detection-regression\n'
  );
  process.exit(1);
}

if (!/^\d+$/.test(ticket)) {
  die(`Ticket must be a number (GitHub issue #). Got: "${ticket}"`);
}

if (!type) {
  die(`Branch type is required. Must be one of: ${VALID_TYPES.join(', ')}`);
}

if (!VALID_TYPES.includes(type)) {
  die(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
}

if (descParts.length === 0) {
  die('Description is required. Use kebab-case words, e.g. "fix stale detection" or "fix-stale-detection"');
}

const description = descParts.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
const branchName = `${ticket}/${type}-${description}`;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const currentBranch = await run('git branch --show-current');

if (currentBranch === branchName) {
  ok(`Already on branch: ${branchName}`);
  process.exit(0);
}

const dirty = await run('git status --porcelain');
if (dirty) {
  process.stderr.write(
    `\x1b[33mWarning:\x1b[0m Working tree has uncommitted changes.\n` +
    `  Stash or commit them before switching branches.\n` +
    `  Run: git stash\n`
  );
  process.exit(1);
}

// Check branch doesn't already exist
const existing = await run('git branch --list ' + branchName);
if (existing) {
  die(`Branch "${branchName}" already exists. Delete it first:\n  git branch -D ${branchName}`);
}

// ---------------------------------------------------------------------------
// Create branch
// ---------------------------------------------------------------------------

info('Fetching origin/main...');
try {
  await run('git fetch origin main');
} catch {
  die('Failed to fetch origin/main. Check your network connection.');
}

info(`Creating branch ${branchName} from origin/main...`);
try {
  await run(`git checkout -b ${branchName} origin/main`);
} catch (err) {
  die(`Failed to create branch: ${String(err)}`);
}

ok(`Branch created: ${branchName}`);
process.stdout.write(
  `\n  Linked to issue #${ticket}\n` +
  `  Push with: git push origin ${branchName}\n`
);
