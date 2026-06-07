import { writeFile } from "fs/promises";
import { stat } from "fs/promises";
import { resolve } from "path";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scan } from "../scanner/index.js";
import { LocalFileSource } from "../scanner/local-source.js";
import { loadConfig } from "../config.js";
import { buildAuditReport } from "../auditor/index.js";
import {
  formatAuditJson,
  formatAuditMarkdown,
  formatAuditHtml,
} from "../auditor/reporter.js";

const VALID_AUDIT_FORMATS = ["json", "markdown", "html"] as const;
type AuditFormat = (typeof VALID_AUDIT_FORMATS)[number];

export function registerAuditCommand(program: Command): void {
  program
    .command("audit")
    .description("Generate a flag debt audit report")
    .argument("[dir]", "directory to audit", process.cwd())
    .option("-f, --format <format>", "output format: json | markdown | html", "markdown")
    .option("-o, --output <file>", "write report to file")
    .option("-c, --config <path>", "path to .flaglintrc config file")
    .option("--exclude-tests", "exclude test files (*.test.*, *.spec.*, __tests__/, tests/)")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint audit                    generate flag debt audit report
  $ flaglint audit --format html     shareable HTML report
  $ flaglint audit --output audit.md save to file`
    )
    .action(
      async (
        dir: string,
        options: { format: string; output?: string; config?: string; excludeTests?: boolean }
      ) => {
        if (!(VALID_AUDIT_FORMATS as readonly string[]).includes(options.format)) {
          process.stderr.write(
            chalk.red(
              `Error: Invalid format '${options.format}'. Must be one of: ${VALID_AUDIT_FORMATS.join(", ")}\n`
            )
          );
          process.exit(2);
        }

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

        let config;
        try {
          config = await loadConfig(options.config);
        } catch (err) {
          process.stderr.write(
            chalk.red(String(err instanceof Error ? err.message : err)) + "\n"
          );
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

        const format = options.format as AuditFormat;
        const spinner = ora(`Auditing ${dir}...`).start();
        process.once("SIGINT", () => { spinner.stop(); process.exit(130); });
        let lastSpinnerUpdate = 0;

        let scanResult;
        try {
          scanResult = await scan(new LocalFileSource(dir), scanConfig, (filesScanned) => {
            if (filesScanned - lastSpinnerUpdate >= 50) {
              spinner.text = `Scanning... (${filesScanned} files)`;
              lastSpinnerUpdate = filesScanned;
            }
          });
          spinner.stop();
        } catch (err) {
          spinner.fail("Audit scan failed");
          process.stderr.write(chalk.red(String(err)) + "\n");
          process.exit(1);
        }

        for (const w of scanResult.warnings) {
          const msg =
            w.kind === "read-failure"
              ? `warn: could not read ${w.file} (${w.fsCode})`
              : `warn: failed to parse ${w.file}`;
          process.stderr.write(chalk.yellow(msg + "\n"));
        }

        if (scanResult.scannedFiles === 0) {
          process.stderr.write(
            chalk.yellow("No matching files found. Check your .flaglintrc include patterns.\n")
          );
          process.exit(0);
        }

        if (scanResult.totalUsages === 0) {
          process.stderr.write(
            chalk.dim(
              `No LaunchDarkly SDK usage detected in ${scanResult.scannedFiles} files.\n`
            )
          );
          process.exit(0);
        }

        const auditReport = buildAuditReport(
          scanResult,
          scanResult.migrationInventory ?? []
        );

        let output: string;
        if (format === "json") {
          output = formatAuditJson(auditReport);
        } else if (format === "html") {
          output = formatAuditHtml(auditReport);
        } else {
          output = formatAuditMarkdown(auditReport);
        }

        if (options.output) {
          const outPath = resolve(options.output);
          try {
            await writeFile(outPath, output, "utf8");
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
          process.stdout.write(output + "\n");
        }

        const { totalFlags, highRisk, mediumRisk, lowRisk } = auditReport.summary;
        const lowRiskSegment = lowRisk > 0 ? `, ${lowRisk} low risk` : "";
        process.stderr.write(
          chalk.green(
            `✓ Audit complete: ${totalFlags} flags — ${highRisk} high risk, ${mediumRisk} medium risk${lowRiskSegment}\n`
          )
        );

        process.exit(0);
      }
    );
}
