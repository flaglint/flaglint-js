#!/usr/bin/env node
// Read .agent-output/metrics/history.jsonl and print a week-over-week summary.
// Usage: npm run metrics:report
// Also used by the distribution-weekly agent.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const historyFile = join(repoRoot, ".agent-output", "metrics", "history.jsonl");

function delta(current, previous, key) {
  if (current[key] == null || previous[key] == null) return "n/a";
  const diff = current[key] - previous[key];
  const sign = diff > 0 ? "+" : "";
  const pct =
    previous[key] > 0
      ? ` (${sign}${Math.round((diff / previous[key]) * 100)}%)`
      : "";
  return `${current[key]} ${sign}${diff}${pct}`;
}

function flag(current, previous) {
  const alerts = [];
  const dl = (current.downloadsLastWeek ?? 0) - (previous.downloadsLastWeek ?? 0);
  if (dl < 0) alerts.push("⚠️  DOWNLOADS DOWN week-over-week — did a distribution action run this week?");
  const stars = (current.stars ?? 0) - (previous.stars ?? 0);
  if (stars >= 2) alerts.push("🌟 STAR SPIKE — identify the source and double down");
  return alerts;
}

async function main() {
  let lines;
  try {
    const raw = await readFile(historyFile, "utf8");
    lines = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    console.error(`No history found at ${historyFile}. Run npm run metrics first.`);
    process.exitCode = 1;
    return;
  }

  if (lines.length < 2) {
    const latest = lines[0] ?? {};
    console.log(`=== FlagLint Metrics — ${latest.date?.slice(0, 10) ?? "no data"} ===`);
    console.log(`npm downloads: ${latest.downloadsLastWeek ?? "n/a"}`);
    console.log(`GitHub stars:  ${latest.stars ?? "n/a"}`);
    console.log(`Open issues:   ${latest.openIssues ?? "n/a"}`);
    console.log(`Forks:         ${latest.forks ?? "n/a"}`);
    console.log("\n(Only one data point — run again next week for trend.)");
    process.exitCode = 1;
    return;
  }

  const current = lines[lines.length - 1];
  const previous = lines[lines.length - 2];
  const date = current.date?.slice(0, 10) ?? "today";

  const alerts = flag(current, previous);
  if (alerts.length) {
    console.log(alerts.join("\n"));
    console.log("");
  }

  console.log(`=== FlagLint Weekly Metrics — ${date} ===`);
  console.log(`npm downloads: ${delta(current, previous, "downloadsLastWeek")}`);
  console.log(`GitHub stars:  ${delta(current, previous, "stars")}`);
  console.log(`Open issues:   ${delta(current, previous, "openIssues")}`);
  console.log(`Forks:         ${delta(current, previous, "forks")}`);

  const trendDl = (current.downloadsLastWeek ?? 0);
  console.log("");
  if (trendDl >= 1000) {
    console.log("Status: 🟢 Downloads above 1,000/wk — badge command unlocked, consider React SDK work.");
  } else if (trendDl >= 500) {
    console.log("Status: 🟡 Growing — keep funnel tasks running, hold on new features.");
  } else {
    console.log("Status: 🔴 Below 500/wk — funnel tasks are the only priority.");
  }
}

main().catch((err) => {
  console.error(`weekly-report failed: ${err.message}`);
  process.exitCode = 1;
});
