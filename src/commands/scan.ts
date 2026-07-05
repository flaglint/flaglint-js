import { writeFile } from "fs/promises";
import { resolve } from "path";
import type { Command } from "commander";
import chalk from "chalk";
import { scan } from "../scanner/index.js";
import { LocalFileSource } from "../scanner/local-source.js";
import { formatReport } from "../reporter/index.js";
import { formatDuration } from "./utils/format-duration.js";
import type { ReportFormat, ReporterOptions } from "../types.js";
import { isStale } from "../types.js";
import { validateDirectory, loadConfigOrExit, EXCLUDE_TEST_PATTERNS, startSpinner, stderrInfo, isVerbose } from "./shared.js";

const VALID_FORMATS: ReportFormat[] = ["json", "markdown", "html", "sarif"];

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan a directory for feature flag usages and detect stale flags")
    .argument("[dir]", "directory to scan", process.cwd())
    .option("-f, --format <format>", "output format: json | markdown | html | sarif", "markdown")
    .option("-o, --output <file>", "write report to file")
    .option("-c, --config <path>", "path to .flaglintrc config file")
    .option("--exclude-tests", "exclude test files (*.test.*, *.spec.*, __tests__/, tests/)")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint scan                    scan current directory
  $ flaglint scan ./src              scan specific directory
  $ flaglint scan --format json      output as JSON
  $ flaglint scan --format sarif     output as SARIF for GitHub Code Scanning
  $ flaglint scan --output report.md save to file
  $ flaglint scan --exclude-tests    skip test and spec files`
    )
    .action(
      async (dir: string, options: { format: string; output?: string; config?: string; excludeTests?: boolean }) => {
        // Validate format before doing any I/O
        if (!(VALID_FORMATS as readonly string[]).includes(options.format)) {
          process.stderr.write(
            chalk.red(
              `Error: Invalid format '${options.format}'. Must be one of: ${VALID_FORMATS.join(", ")}\n`
            )
          );
          process.exit(2);
        }

        await validateDirectory(dir);
        const config = await loadConfigOrExit(options.config);

        const scanConfig = options.excludeTests
          ? { ...config, exclude: [...config.exclude, ...EXCLUDE_TEST_PATTERNS] }
          : config;

        const format = options.format as ReporterOptions["format"];
        const spinner = startSpinner(`Scanning ${dir}...`);
        let lastSpinnerUpdate = 0;

        let result;
        try {
          result = await scan(new LocalFileSource(dir), scanConfig, (filesScanned) => {
            if (filesScanned - lastSpinnerUpdate >= (isVerbose() ? 1 : 50)) {
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
          const msg = w.kind === "read-failure"
            ? `warn: could not read ${w.file} (${w.fsCode})`
            : `warn: failed to parse ${w.file}`;
          stderrInfo(chalk.yellow(msg + "\n"));
        }

        // Guard: no matching files
        if (result.scannedFiles === 0) {
          stderrInfo(chalk.yellow("No matching files found. Check your .flaglintrc include patterns.\n"));
          process.exit(0);
        }

        // Guard: no LD usage
        if (result.totalUsages === 0) {
          stderrInfo(chalk.dim(`No LaunchDarkly SDK usage detected in ${result.scannedFiles} files.\n`));
          process.exit(0);
        }

        const staleCount = new Set(
          result.usages
            .filter((u) => isStale(u) && !u.isDynamic && u.flagKey !== "*")
            .map((u) => u.flagKey)
        ).size;
        const dynamicCount = new Set(result.usages.filter((u) => u.isDynamic).map((u) => u.fingerprint)).size;

        stderrInfo(
          chalk.green(
            `✓ Scan complete — ${result.uniqueFlags.length} unique flags across ${result.totalUsages} call sites (${formatDuration(result.scanDurationMs)}, ${result.scannedFiles} files)\n`
          )
        );
        if (staleCount > 0) {
          stderrInfo(chalk.yellow(`⚠  ${staleCount} potentially stale flag(s) — review recommended\n`));
        }
        if (dynamicCount > 0) {
          stderrInfo(chalk.blue(`ℹ  ${dynamicCount} dynamic flag key(s) require manual review\n`));
        }

        const report = formatReport(result, { format, title: config.reportTitle });

        if (options.output) {
          const outPath = resolve(options.output);
          try {
            await writeFile(outPath, report, "utf8");
            stderrInfo(chalk.dim(`   Report written to ${options.output}\n`));
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

        // scan is an inventory command — enforcement exit codes belong only in `validate`
      }
    );
}
