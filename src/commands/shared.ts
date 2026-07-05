import { stat } from "fs/promises";
import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import type { Ora } from "ora";
import { loadConfig } from "../config.js";
import type { FlagLintConfig } from "../config.js";

// ── Output mode ───────────────────────────────────────────────────────────────

let _quiet = false;
let _verbose = false;

export function setOutputMode(opts: { quiet: boolean; verbose: boolean }): void {
  _quiet = opts.quiet;
  _verbose = opts.verbose;
}

export function isQuiet(): boolean { return _quiet; }
export function isVerbose(): boolean { return _verbose; }

/** Writes to stderr only when not in quiet mode. */
export function stderrInfo(msg: string): void {
  if (!_quiet) process.stderr.write(msg);
}

/** Creates an ora spinner that is silenced in quiet mode. */
export function createSpinner(text: string): Ora {
  return ora({ text, isSilent: _quiet });
}

/**
 * Starts a spinner and wires SIGINT → stop + exit 130.
 * Centralises the identical setup block that every scan command needs.
 */
export function startSpinner(text: string): Ora {
  const spinner = createSpinner(text).start();
  process.once("SIGINT", () => { spinner.stop(); process.exit(130); });
  return spinner;
}

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
