import { readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../prompts");

async function listPrompts(): Promise<string[]> {
  const files = await readdir(PROMPTS_DIR).catch(() => []);
  return files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
}

export async function runPrompt(
  name: string | undefined,
  options: { copy?: boolean }
): Promise<void> {
  if (!name) {
    const prompts = await listPrompts();
    if (prompts.length === 0) {
      process.stdout.write(chalk.yellow("No prompts found in scripts/agent/prompts/\n"));
    } else {
      process.stdout.write(chalk.bold("Available prompts:\n"));
      for (const p of prompts) process.stdout.write(`  - ${p}\n`);
    }
    return;
  }

  const filePath = join(PROMPTS_DIR, `${name}.md`);
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    process.stderr.write(chalk.red(`Prompt not found: ${name}\n\n`));
    const prompts = await listPrompts();
    if (prompts.length > 0) {
      process.stdout.write(chalk.dim("Available prompts:\n"));
      for (const p of prompts) process.stdout.write(chalk.dim(`  - ${p}\n`));
    }
    process.exit(1);
  }

  process.stdout.write(content + "\n");

  if (options.copy) {
    const clipboardy = await import("clipboardy");
    await clipboardy.default.write(content);
    process.stderr.write(chalk.green("✓ Copied to clipboard\n"));
  }
}
