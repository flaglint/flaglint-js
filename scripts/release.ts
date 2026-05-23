#!/usr/bin/env tsx
/**
 * Release automation script.
 * Usage: tsx scripts/release.ts [patch|minor|major]
 *
 * What it does:
 *   1. Reads commits since the last git tag
 *   2. Groups them by conventional-commit prefix
 *   3. Bumps package.json version
 *   4. Prepends a new section to CHANGELOG.md
 *   5. Syncs www/index.html from package/source metadata
 *   6. Commits release files and creates an annotated git tag
 *
 * After this script succeeds, push with:
 *   git push origin main && git push origin <tag>
 * That push triggers the release.yml workflow → npm publish + GitHub Release.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BumpType = 'patch' | 'minor' | 'major';

interface CommitGroups {
  Added: string[];
  Fixed: string[];
  Changed: string[];
  Removed: string[];
  Other: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function run(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd);
  return stdout.trim();
}

function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = current.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

async function getCommitsSinceLastTag(): Promise<string[]> {
  try {
    const lastTag = await run('git describe --tags --abbrev=0');
    const log = await run(`git log ${lastTag}..HEAD --pretty=format:%s`);
    return log.split('\n').filter(Boolean);
  } catch {
    // No tags yet — return all commits
    const log = await run('git log --pretty=format:%s');
    return log.split('\n').filter(Boolean);
  }
}

function groupCommits(commits: string[]): CommitGroups {
  const groups: CommitGroups = { Added: [], Fixed: [], Changed: [], Removed: [], Other: [] };

  const prefixMap: Record<string, keyof CommitGroups> = {
    feat: 'Added',
    feature: 'Added',
    fix: 'Fixed',
    bugfix: 'Fixed',
    hotfix: 'Fixed',
    refactor: 'Changed',
    perf: 'Changed',
    chore: 'Changed',
    docs: 'Changed',
    style: 'Changed',
    test: 'Changed',
    build: 'Changed',
    ci: 'Changed',
    revert: 'Removed',
    remove: 'Removed',
  };

  for (const commit of commits) {
    // Matches: feat(scope)!: message  or  feat: message
    const match = commit.match(/^(\w+)(?:\(.+?\))?!?:\s*(.+)$/);
    if (match) {
      const [, prefix, message] = match;
      const group = prefixMap[prefix.toLowerCase()] ?? 'Other';
      groups[group].push(message);
    } else {
      groups.Other.push(commit);
    }
  }

  return groups;
}

function renderChangelogEntry(version: string, date: string, groups: CommitGroups): string {
  const lines: string[] = [`## [${version}] - ${date}`, ''];
  const order: (keyof CommitGroups)[] = ['Added', 'Fixed', 'Changed', 'Removed', 'Other'];

  for (const section of order) {
    if (groups[section].length === 0) continue;
    lines.push(`### ${section}`, '');
    for (const item of groups[section]) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function prependChangelog(changelogPath: string, entry: string): Promise<void> {
  const content = await readFile(changelogPath, 'utf8');
  // Insert after the standard Keep-a-Changelog header block (ends at the first blank line after the semver link)
  const headerEnd = content.indexOf('\n\n## ');
  if (headerEnd === -1) {
    // Fallback: just prepend after first double newline
    const firstGap = content.indexOf('\n\n');
    const insertAt = firstGap === -1 ? content.length : firstGap + 2;
    await writeFile(changelogPath, content.slice(0, insertAt) + entry + '\n' + content.slice(insertAt));
  } else {
    await writeFile(changelogPath, content.slice(0, headerEnd + 2) + entry + '\n' + content.slice(headerEnd + 2));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const bumpType = (process.argv[2] ?? 'patch') as BumpType;

  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error(`Error: invalid bump type "${bumpType}". Use patch, minor, or major.`);
    process.exit(1);
  }

  // Must be on main branch
  const currentBranch = await run('git rev-parse --abbrev-ref HEAD');
  if (currentBranch !== 'main') {
    console.error(`Error: releases must be cut from main (currently on "${currentBranch}").`);
    process.exit(1);
  }

  // Abort if there are uncommitted changes
  const dirty = await run('git status --porcelain');
  if (dirty) {
    console.error('Error: working tree has uncommitted changes. Commit or stash them first.');
    process.exit(1);
  }

  // Verify tests pass before touching any files
console.log('Running typecheck...');
await run('npm run typecheck');
console.log('Typecheck passed.\n');

console.log('Running tests...');
await run('npm run test:run');
console.log('Tests passed.\n');


  // Verify build is clean before tagging
  console.log('Running build...');
  await run('npm run build');
  console.log('Build succeeded.\n');

  const root = process.cwd();
  const pkgPath = join(root, 'package.json');
  const changelogPath = join(root, 'CHANGELOG.md');
  const lockPath = join(root, 'package-lock.json');

  // Read current version
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { version: string; [k: string]: unknown };
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bumpType);
  const tagName = `v${newVersion}`;
  const today = new Date().toISOString().split('T')[0];

  // Abort if tag already exists — avoids dirty state from a mid-script failure
  const existingTag = await run(`git tag -l ${tagName}`);
  if (existingTag) {
    console.error(`Error: tag ${tagName} already exists. Has this version already been released?`);
    process.exit(1);
  }

  console.log(`\nBumping ${oldVersion} → ${newVersion} (${bumpType})\n`);

  // Gather and group commits
  const commits = await getCommitsSinceLastTag();
  if (commits.length === 0) {
    console.warn('Warning: no commits found since last tag. The changelog entry will be empty.\n');
  }

  const groups = groupCommits(commits);
  const entry = renderChangelogEntry(newVersion, today, groups);

  // Update package.json
  pkg.version = newVersion;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');


  // Keep package-lock.json version metadata aligned with package.json
  const lock = JSON.parse(await readFile(lockPath, 'utf8')) as {
    version?: string;
    packages?: Record<string, { version?: string }>;
    [key: string]: unknown;
  };

  lock.version = newVersion;

  if (lock.packages?.['']) {
    lock.packages[''].version = newVersion;
  }

  await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');

  // Update CHANGELOG.md
  await prependChangelog(changelogPath, entry);

  // Keep the static website aligned with release metadata after the version bump.
  await run('npm run sync:www');

  // Commit and tag
  await run('git add package.json package-lock.json CHANGELOG.md www/index.html');
  await run(`git commit -m "chore: release ${tagName}"`);
  await run(`git tag -a ${tagName} -m "Release ${tagName}"`);

  console.log('Release notes:');
  console.log('─'.repeat(60));
  console.log(entry.trimEnd());
  console.log('─'.repeat(60));
  console.log(`\nTag ${tagName} created.\n`);
  console.log('To publish, push the tag (triggers npm publish + GitHub Release):');
  console.log(`  git push origin main && git push origin ${tagName}\n`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
