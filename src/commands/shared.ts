import { stat } from "fs/promises";
import { resolve } from "path";
import chalk from "chalk";
import { loadConfig } from "../config.js";
import type { FlagLintConfig } from "../config.js";

export const EXCLUDE_TEST_PATTERNS: string[] = [
  "**/*.test.ts", "**/*.test.tsx",
  "**/*.spec.ts", "**/*.spec.tsx",
  "**/__tests__/**", "**/tests/**",
];

export async function validateDirectory(dir: string): Promise<void> {
  try {
    const s = await stat(resolve(dir));
    if (!s.isDirectory()) {
      process.stderr.write(chalk.red(`Error: Not a directory: ${dir}\n`));
      process.exit(1);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      process.stderr.write(chalk.red(`Error: Directory not found: ${dir}\n`));
    } else if (code === "EACCES") {
      process.stderr.write(chalk.red(`Error: Permission denied: ${dir}\n`));
    } else {
      process.stderr.write(chalk.red(`Error: Cannot access directory: ${dir}\n`));
    }
    process.exit(1);
  }
}

export async function loadConfigOrExit(configPath?: string): Promise<FlagLintConfig> {
  try {
    return await loadConfig(configPath);
  } catch (err) {
    process.stderr.write(chalk.red(String(err instanceof Error ? err.message : err)) + "\n");
    process.exit(1);
  }
}
