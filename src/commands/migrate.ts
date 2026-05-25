import { writeFile } from "fs/promises";
import { stat } from "fs/promises";
import { resolve } from "path";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scan } from "../scanner/index.js";
import { LocalFileSource } from "../scanner/local-source.js";
import { analyze, formatMigrationReport } from "../migrator/index.js";
import { formatDryRunDiff } from "../migrator/dry-run.js";
import { applyMigration, ApplyError } from "../migrator/apply.js";
import { loadConfig } from "../config.js";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Analyze migration readiness and generate an OpenFeature migration plan")
    .argument("[dir]", "directory to analyze", process.cwd())
    .option("-o, --output <file>", "write migration plan to file", "MIGRATION.md")
    .option("-c, --config <path>", "path to .flaglintrc config file")
    .option("--dry-run", "print reviewable diffs to stdout without writing files")
    .option("--apply", "apply safe transformations to source files in-place")
    .option("--allow-dirty", "allow --apply on a dirty git working tree")
    .option("--exclude-tests", "exclude test files (*.test.*, *.spec.*, __tests__/, tests/)")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint migrate                 generate migration plan for current directory
  $ flaglint migrate ./src           analyze specific directory
  $ flaglint migrate --dry-run       preview diffs without writing files
  $ flaglint migrate --apply         apply safe transformations in-place
  $ flaglint migrate --apply --allow-dirty  apply even on a dirty working tree
  $ flaglint migrate --output plan.md write to custom file
  $ flaglint migrate --exclude-tests skip test and spec files`
    )
    .action(
      async (
        dir: string,
        options: {
          output: string;
          config?: string;
          dryRun?: boolean;
          apply?: boolean;
          allowDirty?: boolean;
          excludeTests?: boolean;
        }
      ) => {
        // --dry-run and --apply are mutually exclusive
        if (options.dryRun && options.apply) {
          process.stderr.write(chalk.red("Error: --dry-run and --apply are mutually exclusive.\n"));
          process.exit(1);
        }

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

        const TEST_PATTERNS = [
          "**/*.test.ts", "**/*.test.tsx",
          "**/*.spec.ts", "**/*.spec.tsx",
          "**/__tests__/**", "**/tests/**",
        ];
        const scanConfig = options.excludeTests
          ? { ...config, exclude: [...config.exclude, ...TEST_PATTERNS] }
          : config;

        const spinner = ora(`Scanning ${dir}...`).start();
        process.once("SIGINT", () => { spinner.stop(); process.exit(130); });

        // Single source used for scan, dry-run, and apply.
        const source = new LocalFileSource(dir);

        let scanResult;
        try {
          scanResult = await scan(source, scanConfig, (filesScanned) => {
            spinner.text = `Scanning files... ${filesScanned}`;
          });
          spinner.text = "Analyzing migration inventory...";
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
          const msg = w.kind === "read-failure"
            ? `warn: could not read ${w.file} (${w.fsCode})`
            : `warn: failed to parse ${w.file}`;
          process.stderr.write(chalk.yellow(msg + "\n"));
        }

        const summaryColor = analysis.manualReviewCount > 0 ? chalk.yellow : chalk.green;
        process.stderr.write(summaryColor(`LaunchDarkly usages found: ${analysis.totalLaunchDarklyUsages}\n`));
        process.stderr.write(
          chalk.gray(
            `Safely automatable: ${analysis.safelyAutomatableCount} · Manual review: ${analysis.manualReviewCount}\n`
          )
        );

        // ── --dry-run ──────────────────────────────────────────────────────────
        if (options.dryRun) {
          const report = await formatDryRunDiff(analysis, source);
          process.stdout.write(report + "\n");
          process.exit(0);
        }

        // ── --apply ────────────────────────────────────────────────────────────
        if (options.apply) {
          let result;
          try {
            result = await applyMigration(analysis, source, { allowDirty: options.allowDirty });
          } catch (err) {
            if (err instanceof ApplyError && err.kind === "dirty-tree") {
              process.stderr.write(chalk.red(`\nError: ${err.message}\n`));
              process.exit(1);
            }
            process.stderr.write(chalk.red(String(err)) + "\n");
            process.exit(1);
          }

          if (result.transformed > 0) {
            process.stderr.write(
              chalk.green(
                `Transformed: ${result.transformed} call-site(s) across ${result.transformedFiles.length} file(s)\n`
              )
            );
            for (const file of result.transformedFiles) {
              process.stderr.write(chalk.dim(`  ✓ ${file}\n`));
            }
          } else {
            process.stderr.write(chalk.dim("No call-sites were transformed.\n"));
          }

          if (result.skipped > 0) {
            process.stderr.write(
              chalk.yellow(`Skipped: ${result.skipped} file(s) — OpenFeature client setup required\n`)
            );
            for (const { file } of result.skippedFiles) {
              process.stderr.write(
                chalk.dim(`  ⚠ ${file}: no openFeatureClient binding found\n`)
              );
              process.stderr.write(
                chalk.dim("    Run `flaglint migrate --dry-run` for provider setup guidance.\n")
              );
            }
          }

          process.exit(0);
        }

        // ── default: write migration report ────────────────────────────────────
        const report = formatMigrationReport(analysis);
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
