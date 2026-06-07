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
  type AuditRenderOptions,
} from "../auditor/reporter.js";
import { renderReadinessBar } from "../readiness/readiness-bar.js";
import { computeEstimate } from "../estimate/estimate.js";

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
    .option("--cost-estimate", "include a migration effort estimate in the report. The default assumptions are configurable planning heuristics, not observed industry benchmarks.")
    .option("--hourly-rate <rate>", "hourly rate for cost projection (requires --cost-estimate)")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint audit                    generate flag debt audit report
  $ flaglint audit --format html     shareable HTML report
  $ flaglint audit --output audit.md save to file
  $ flaglint audit --cost-estimate   include migration effort estimate
  $ flaglint audit --cost-estimate --hourly-rate 125   include cost projection`
    )
    .action(
      async (
        dir: string,
        options: {
          format: string;
          output?: string;
          config?: string;
          excludeTests?: boolean;
          costEstimate?: boolean;
          hourlyRate?: string;
        }
      ) => {
        if (!(VALID_AUDIT_FORMATS as readonly string[]).includes(options.format)) {
          process.stderr.write(
            chalk.red(
              `Error: Invalid format '${options.format}'. Must be one of: ${VALID_AUDIT_FORMATS.join(", ")}\n`
            )
          );
          process.exit(2);
        }

        // Validate --hourly-rate before doing any work
        let hourlyRate: number | undefined;
        if (options.hourlyRate !== undefined) {
          if (!options.costEstimate) {
            process.stderr.write(
              chalk.yellow("warn: --hourly-rate has no effect without --cost-estimate\n")
            );
          } else {
            const parsed = Number(options.hourlyRate);
            if (!Number.isFinite(parsed) || parsed <= 0) {
              process.stderr.write(
                chalk.red(
                  `Error: --hourly-rate must be a positive number, got: ${options.hourlyRate}\n`
                )
              );
              process.exit(2);
            }
            hourlyRate = parsed;
          }
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
          if (format === "json" && options.costEstimate) {
            // Produce a well-formed JSON report so callers get { estimate: null } consistently.
            const emptyReport = buildAuditReport(scanResult, []);
            process.stdout.write(formatAuditJson(emptyReport, { estimate: null }) + "\n");
            process.stderr.write(chalk.dim("Migration estimate: N/A\n"));
          } else if (options.costEstimate) {
            process.stderr.write(chalk.dim("Migration estimate: N/A\n"));
          }
          process.exit(0);
        }

        const auditReport = buildAuditReport(
          scanResult,
          scanResult.migrationInventory ?? []
        );

        const renderOptions: AuditRenderOptions | undefined = options.costEstimate
          ? { estimate: computeEstimate(auditReport.readiness, undefined, hourlyRate) }
          : undefined;

        let output: string;
        if (format === "json") {
          output = formatAuditJson(auditReport, renderOptions);
        } else if (format === "html") {
          output = formatAuditHtml(auditReport, renderOptions);
        } else {
          output = formatAuditMarkdown(auditReport, renderOptions);
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

        const { readiness } = auditReport;
        process.stderr.write("\n");
        if (readiness.grade === "not-applicable") {
          process.stderr.write(chalk.dim("Migration readiness: N/A — no direct LaunchDarkly calls detected.\n"));
          if (options.costEstimate) {
            process.stderr.write(chalk.dim("Migration estimate: N/A\n"));
          }
        } else {
          const score = readiness.score!;
          const scoreColor = score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
          process.stderr.write(scoreColor(`Migration readiness: ${score}/100  ·  ${readiness.grade}\n`));
          process.stderr.write(scoreColor(renderReadinessBar(score) + "\n"));
          process.stderr.write(
            chalk.dim(
              `${readiness.automatableCalls} safely automatable  ·  ${readiness.manualReviewCalls} require manual review\n`
            )
          );

          if (options.costEstimate && renderOptions?.estimate) {
            const est = renderOptions.estimate;
            process.stderr.write("\n");
            process.stderr.write(
              chalk.cyan(`Estimated migration effort: ${est.hoursLow}h – ${est.hoursHigh}h\n`)
            );
            if (est.costLow !== undefined && est.costHigh !== undefined) {
              const fmtCost = (n: number) => "$" + n.toLocaleString("en-US");
              process.stderr.write(chalk.cyan(`Estimated cost: ${fmtCost(est.costLow)} – ${fmtCost(est.costHigh)}\n`));
            }
            process.stderr.write(chalk.dim("Estimates are directional. See the report for assumptions.\n"));
          }
        }

        process.exit(0);
      }
    );
}
