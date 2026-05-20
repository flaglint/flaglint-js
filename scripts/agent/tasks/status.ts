import chalk from "chalk";
import { getCurrentBranch, getStatus } from "../lib/git.js";
import { getPackageVersion } from "../lib/npm.js";

export async function runStatus(): Promise<void> {
  const [branch, version, dirty] = await Promise.all([
    getCurrentBranch(),
    getPackageVersion(),
    getStatus().then((s) => s.trim() !== ""),
  ]);

  process.stdout.write(chalk.bold("FlagLint Agent — Status\n"));
  process.stdout.write(`  Branch:       ${chalk.cyan(branch)}\n`);
  process.stdout.write(`  Version:      ${chalk.green("v" + version)}\n`);
  process.stdout.write(
    `  Working tree: ${dirty ? chalk.yellow("dirty") : chalk.green("clean")}\n`
  );
}
