import { writeFile } from "fs/promises";
import { stat } from "fs/promises";
import { resolve } from "path";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scan } from "../scanner/index.js";
import { LocalFileSource } from "../scanner/local-source.js";
import { analyze, formatMigrationReport } from "../migrator/index.js";
import { loadConfig } from "../config.js";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Analyze migration readiness and generate an OpenFeature migration plan")
    .argument("[dir]", "directory to analyze", process.cwd())
    .option("-o, --output <file>", "write migration plan to file", "MIGRATION.md")
    .option("-c, --config <path>", "path to .flaglintrc config file")
    .option("--dry-run", "print migration plan to stdout without writing file")
    .option("--exclude-tests", "exclude test files (*.test.*, *.spec.*, __tests__/, tests/)")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint migrate                 generate migration plan for current directory
  $ flaglint migrate ./src           analyze specific directory
  $ flaglint migrate --dry-run       preview without writing file
  $ flaglint migrate --output plan.md write to custom file
  $ flaglint migrate --exclude-tests skip test and spec files`
    )
    .action(
      async (dir: string, options: { output: string; config?: string; dryRun?: boolean; excludeTests?: boolean }) => {
        // Validate directory exists
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

        // Load config
        let config;
        try {
          config = await loadConfig(options.config);
        } catch (err) {
          process.stderr.write(chalk.red(String(err instanceof Error ? err.message : err)) + "\n");
          process.exit(1);
        }

        if (options.excludeTests) {
          config.exclude.push(
            "**/*.test.ts",
            "**/*.test.tsx",
            "**/*.spec.ts",
            "**/*.spec.tsx",
            "**/__tests__/**",
            "**/tests/**"
          );
        }

        const spinner = ora(`Scanning ${dir}...`).start();
        process.once("SIGINT", () => { spinner.stop(); process.exit(130); });

        let scanResult;
        try {
          scanResult = await scan(new LocalFileSource(dir), config, (filesScanned) => {
            spinner.text = `Scanning files... ${filesScanned}`;
          });
          spinner.text = "Analyzing migration readiness...";
        } catch (err) {
          spinner.fail("Scan failed");
          process.stderr.write(chalk.red(String(err)) + "\n");
          process.exit(1);
        }

        // Guard: no matching files
        if (scanResult.scannedFiles === 0) {
          spinner.stop();
          process.stderr.write(
            chalk.yellow("No matching files found. Check your .flaglintrc include patterns.\n")
          );
          process.exit(0);
        }

        // Guard: no LD usage
        if (scanResult.totalUsages === 0) {
          spinner.stop();
          process.stderr.write(
            chalk.dim(
              `No LaunchDarkly SDK usage detected in ${scanResult.scannedFiles} files.\n`
            )
          );
          process.exit(0);
        }

        const analysis = analyze(scanResult);
        spinner.stop();

        for (const w of scanResult.warnings) {
          process.stderr.write(chalk.yellow(w + "\n"));
        }

        const { readinessScore } = analysis;
        const scoreColor =
          readinessScore >= 80 ? chalk.green : readinessScore >= 50 ? chalk.yellow : chalk.red;
        process.stderr.write(scoreColor(`Migration Readiness Score: ${readinessScore}/100\n`));
        process.stderr.write(
          chalk.gray(
            `Auto-migratable: ${analysis.autoMigrateCount} · Manual review: ${analysis.manualReviewCount}\n`
          )
        );

        const report = formatMigrationReport(analysis);

        if (options.dryRun) {
          process.stdout.write(report + "\n");
          process.exit(0);
        }

        const outPath = resolve(options.output);
        try {
          await writeFile(outPath, report, "utf8");
          process.stderr.write(chalk.green(`Migration plan written to ${options.output}\n`));
        } catch (err) {
          process.stderr.write(
            chalk.red(
              `Error: Failed to write migration plan to ${options.output}: ${err instanceof Error ? err.message : String(err)}\n`
            )
          );
          process.exit(1);
        }

        process.exit(0);
      }
    );
}
