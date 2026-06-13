#!/usr/bin/env node
// Collect public project metrics and append one JSON line per run to
// .agent-output/metrics/history.jsonl. No external dependencies — uses the
// global fetch (Node 18+) and node: built-ins only.
//
// Usage: npm run metrics
// Optional: set GITHUB_TOKEN to raise the GitHub API rate limit.

import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NPM_PACKAGE = "flaglint";
const GITHUB_REPO = "flaglint/flaglint";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(repoRoot, ".agent-output", "metrics");
const outFile = join(outDir, "history.jsonl");

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": `${NPM_PACKAGE}-metrics`, ...headers },
  });
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  return res.json();
}

async function collectNpm() {
  const data = await fetchJson(
    `https://api.npmjs.org/downloads/point/last-week/${NPM_PACKAGE}`,
  );
  return { downloadsLastWeek: data.downloads ?? null };
}

async function collectGithub() {
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const data = await fetchJson(
    `https://api.github.com/repos/${GITHUB_REPO}`,
    headers,
  );
  return {
    stars: data.stargazers_count ?? null,
    forks: data.forks_count ?? null,
    openIssues: data.open_issues_count ?? null,
  };
}

async function main() {
  const record = { date: new Date().toISOString() };
  const errors = [];

  const [npm, github] = await Promise.allSettled([
    collectNpm(),
    collectGithub(),
  ]);

  if (npm.status === "fulfilled") {
    Object.assign(record, npm.value);
  } else {
    errors.push(`npm: ${npm.reason.message}`);
  }

  if (github.status === "fulfilled") {
    Object.assign(record, github.value);
  } else {
    errors.push(`github: ${github.reason.message}`);
  }

  if (errors.length) {
    record.errors = errors;
  }

  await mkdir(outDir, { recursive: true });
  await appendFile(outFile, `${JSON.stringify(record)}\n`);

  console.log(`Appended metrics to ${outFile}`);
  console.log(JSON.stringify(record, null, 2));

  // Non-zero exit if every source failed, so CI/cron can surface it.
  if (errors.length === 2) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`metrics collection failed: ${err.message}`);
  process.exitCode = 1;
});
