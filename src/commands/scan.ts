import { writeFile } from "fs/promises";
import { stat } from "fs/promises";
import { resolve } from "path";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scan } from "../scanner/index.js";
import { formatReport } from "../reporter/index.js";
import { loadConfig } from "../config.js";
import type { ReporterOptions } from "../types.js";

const VALID_FORMATS = ["json", "markdown", "html"];

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan a directory for feature flag usages and detect stale flags")
    .argument("[dir]", "directory to scan", process.cwd())
    .option("-f, --format <format>", "output format: json | markdown | html", "markdown")
    .option("-o, --output <file>", "write report to file")
    .option("-c, --config <path>", "path to .flaglintrc config file")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint scan                    scan current directory
  $ flaglint scan ./src              scan specific directory
  $ flaglint scan --format json      output as JSON
  $ flaglint scan --output report.md save to file`
    )
    .action(
      async (dir: string, options: { format: string; output?: string; config?: string }) => {
        // Validate format before doing any I/O
        if (!VALID_FORMATS.includes(options.format)) {
          process.stderr.write(
            chalk.red(
              `Error: Invalid format '${options.format}'. Must be one of: ${VALID_FORMATS.join(", ")}\n`
            )
          );
          process.exit(2);
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

        // Load config — propagate parse errors with clear message
        let config;
        try {
          config = loadConfig(options.config);
        } catch (err) {
          process.stderr.write(chalk.red(String(err instanceof Error ? err.message : err)) + "\n");
          process.exit(1);
        }

        const format = options.format as ReporterOptions["format"];
        const spinner = ora(`Scanning ${dir}...`).start();
        process.once("SIGINT", () => { spinner.stop(); process.exit(130); });
        let lastSpinnerUpdate = 0;

        let result;
        try {
          result = await scan(dir, config, (filesScanned) => {
            if (filesScanned - lastSpinnerUpdate >= 50) {
              spinner.text = `Scanning... (${filesScanned} files)`;
              lastSpinnerUpdate = filesScanned;
            }
          });
          spinner.stop();
        } catch (err) {
          spinner.fail("Scan failed");
          process.stderr.write(chalk.red(String(err)) + "\n");
          process.exit(1);
        }

        for (const w of result.warnings) {
          process.stderr.write(chalk.yellow(w + "\n"));
        }

        // Guard: no matching files
        if (result.scannedFiles === 0) {
          process.stderr.write(
            chalk.yellow("No matching files found. Check your .flaglintrc include patterns.\n")
          );
          process.exit(0);
        }

        // Guard: no LD usage
        if (result.totalUsages === 0) {
          process.stderr.write(
            chalk.dim(
              `No LaunchDarkly SDK usage detected in ${result.scannedFiles} files.\n`
            )
          );
          process.exit(0);
        }

        const staleCount = new Set(result.usages.filter((u) => u.isStale).map((u) => u.flagKey)).size;
        const dynamicCount = new Set(result.usages.filter((u) => u.isDynamic).map((u) => u.flagKey)).size;

        process.stderr.write(
          chalk.green(
            `✓ ${result.totalUsages} flag usages found across ${result.uniqueFlags.length} unique flags (${result.scanDurationMs}ms)\n`
          )
        );
        if (staleCount > 0) {
          process.stderr.write(
            chalk.yellow(`⚠  ${staleCount} potentially stale flag(s) — review recommended\n`)
          );
        }
        if (dynamicCount > 0) {
          process.stderr.write(
            chalk.blue(`ℹ  ${dynamicCount} dynamic flag key(s) require manual review\n`)
          );
        }

        const report = formatReport(result, { format, title: config.reportTitle });

        if (options.output) {
          const outPath = resolve(options.output);
          try {
            await writeFile(outPath, report, "utf8");
            process.stderr.write(chalk.dim(`   Report written to ${options.output}\n`));
          } catch (err) {
            process.stderr.write(
              chalk.red(
                `Error: Failed to write report to ${options.output}: ${err instanceof Error ? err.message : String(err)}\n`
              )
            );
            process.exit(1);
          }
        } else {
          process.stdout.write(report + "\n");
        }

        process.exit(staleCount > 0 ? 1 : 0);
      }
    );
}
