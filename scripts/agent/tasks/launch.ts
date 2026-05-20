import { createInterface } from "readline/promises";
import { spawn } from "child_process";
import chalk from "chalk";
import { getStatus, getCurrentBranch, createTag, pushTags } from "../lib/git.js";
import { getPackageVersion, verifyPublishable } from "../lib/npm.js";

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: "inherit", shell: false });
    proc.on("close", (code) => resolve(code ?? 1));
  });
}

function step(n: number, total: number, label: string): void {
  process.stdout.write(`  [${n}/${total}] ${label}... `);
}

export async function runLaunch(version: string): Promise<void> {
  process.stdout.write(chalk.bold(`\nFlagLint Launch Sequence — v${version}\n\n`));

  // Step 1: clean working tree
  step(1, 5, "Checking working tree");
  const status = await getStatus();
  if (status.trim() !== "") {
    process.stdout.write(chalk.red("✗\n"));
    process.stderr.write(chalk.red("Uncommitted changes detected. Commit or stash first.\n"));
    process.stderr.write(status);
    process.exit(1);
  }
  process.stdout.write(chalk.green("✓ clean\n"));

  // Step 2: tests
  step(2, 5, "Running tests");
  const testCode = await run("npm", ["run", "test:run"]);
  if (testCode !== 0) {
    process.stdout.write(chalk.red("✗\n"));
    process.exit(1);
  }
  process.stdout.write(chalk.green("✓ passed\n"));

  // Step 3: build
  step(3, 5, "Building");
  const buildCode = await run("npm", ["run", "build"]);
  if (buildCode !== 0) {
    process.stdout.write(chalk.red("✗\n"));
    process.exit(1);
  }
  process.stdout.write(chalk.green("✓ built\n"));

  // Step 4: version match
  step(4, 5, `Verifying version matches ${version}`);
  const pkgVersion = await getPackageVersion();
  if (pkgVersion !== version) {
    process.stdout.write(chalk.red("✗\n"));
    process.stderr.write(
      chalk.red(`package.json has version ${pkgVersion}, expected ${version}\n`)
    );
    process.exit(1);
  }
  await verifyPublishable();
  process.stdout.write(chalk.green("✓ verified\n"));

  // Confirmation gate
  const branch = await getCurrentBranch();
  process.stdout.write(`\n  Branch: ${chalk.cyan(branch)}\n`);
  process.stdout.write(`  Tag:    ${chalk.yellow("v" + version)}\n\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(chalk.bold(`Tag and push v${version}? (y/N) `));
  rl.close();

  if (answer.trim().toLowerCase() !== "y") {
    process.stdout.write(chalk.dim("\nAborted.\n"));
    process.exit(0);
  }

  // Step 5: tag + push
  step(5, 5, "Tagging and pushing");
  await createTag(`v${version}`);
  await pushTags("origin", branch);
  process.stdout.write(chalk.green("✓ done\n"));

  process.stdout.write(chalk.bold("\n  ✓ Release tagged and pushed.\n\n"));
  process.stdout.write(chalk.yellow("  Next step — run this manually from your npm account:\n"));
  process.stdout.write(chalk.white("    npm publish\n\n"));
}
