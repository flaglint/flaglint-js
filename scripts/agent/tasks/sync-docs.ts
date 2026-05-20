import { readFile, writeFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline/promises";
import chalk from "chalk";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export async function runSyncDocs(options: {
  decision: string;
  adr?: string;
  updateClaude?: boolean;
}): Promise<void> {
  const { decision, adr, updateClaude } = options;
  const today = new Date().toISOString().slice(0, 10);
  const memoryPath = join(REPO_ROOT, "MEMORY.md");
  const todayHeading = `## [${today}]`;
  const bullet = `- ${decision}`;

  // Append to MEMORY.md (append-only — never edits past entries)
  let content = await readFile(memoryPath, "utf8");

  if (content.includes(todayHeading)) {
    // Today's section already exists — append bullet inside it
    const lines = content.split("\n");
    const headingIdx = lines.findIndex((l) => l.startsWith(todayHeading));
    let nextHeading = lines.length;
    for (let i = headingIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith("## ")) { nextHeading = i; break; }
    }
    let insertAt = nextHeading - 1;
    while (insertAt > headingIdx && lines[insertAt].trim() === "") insertAt--;
    lines.splice(insertAt + 1, 0, bullet);
    content = lines.join("\n");
  } else {
    // New date — append a fresh section
    if (!content.endsWith("\n")) content += "\n";
    content += `\n## [${today}] Session decisions\n\n${bullet}\n`;
  }

  await writeFile(memoryPath, content, "utf8");
  process.stdout.write(chalk.green(`  ✓ MEMORY.md updated: ${bullet}\n`));

  // Optional: create ADR file
  if (adr) {
    const adrDir = join(REPO_ROOT, "docs/adr");
    const files = await readdir(adrDir);
    const nums = files
      .filter((f) => /^\d{3}-/.test(f))
      .map((f) => parseInt(f.slice(0, 3)))
      .filter((n) => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const nn = String(next).padStart(3, "0");
    const slug = adr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `${nn}-${slug}.md`;
    const adrContent = `# ADR ${nn} — ${adr}

Date: ${today}
Status: PROPOSED

## Decision
${decision}

## Reasoning
TODO

## Consequences
TODO
`;
    await writeFile(join(adrDir, filename), adrContent, "utf8");
    process.stdout.write(chalk.green(`  ✓ ADR created: docs/adr/${filename}\n`));
  }

  // Optional: update CLAUDE.md (requires explicit confirmation — it is a sacred file)
  if (updateClaude) {
    const claudePath = join(REPO_ROOT, "CLAUDE.md");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      chalk.yellow(`\n  CLAUDE.md is a sacred file. Append "${decision}"? (y/N) `)
    );
    rl.close();

    if (answer.trim().toLowerCase() === "y") {
      let claudeContent = await readFile(claudePath, "utf8");
      if (!claudeContent.endsWith("\n")) claudeContent += "\n";
      claudeContent += `\n## [${today}] Agent-recorded decision\n\n- ${decision}\n`;
      await writeFile(claudePath, claudeContent, "utf8");
      process.stdout.write(chalk.green("  ✓ CLAUDE.md updated.\n"));
    } else {
      process.stdout.write(chalk.dim("  CLAUDE.md update skipped.\n"));
    }
  }
}
