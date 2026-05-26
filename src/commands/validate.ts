import { writeFile } from "fs/promises";
import { stat } from "fs/promises";
import { resolve } from "path";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scan } from "../scanner/index.js";
import { LocalFileSource } from "../scanner/local-source.js";
import {
  validateScanResult,
  formatValidationReport,
  formatValidationSarif,
} from "../validator/index.js";
import { loadConfig } from "../config.js";

const VALID_VALIDATE_FORMATS = ["text", "sarif"] as const;
type ValidateFormat = (typeof VALID_VALIDATE_FORMATS)[number];

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate that your codebase complies with feature flag usage policies")
    .argument("[dir]", "directory to validate", process.cwd())
    .option(
      "--no-direct-launchdarkly",
      "fail if any direct LaunchDarkly Node server SDK evaluation calls are found"
    )
    .option(
      "--bootstrap-exclude <glob>",
      "glob pattern for files allowed to use LaunchDarkly SDK directly (repeatable)",
      (val: string, prev: string[]) => [...prev, val],
      [] as string[]
    )
    .option(
      "-f, --format <format>",
      "output format: text | sarif",
      "text"
    )
    .option("-o, --output <file>", "write report to file instead of stdout")
    .option("-c, --config <path>", "path to .flaglintrc config file")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint validate                                        scan and report LD usages
  $ flaglint validate --no-direct-launchdarkly              fail on any direct LD eval calls
  $ flaglint validate --no-direct-launchdarkly \\
      --bootstrap-exclude src/provider/setup.ts             allow bootstrap file
  $ flaglint validate --no-direct-launchdarkly \\
      --bootstrap-exclude "src/provider/**"                 allow all provider files
  $ flaglint validate --no-direct-launchdarkly \\
      --format sarif --output flaglint.sarif                emit SARIF for GitHub Code Scanning
  $ flaglint validate --no-direct-launchdarkly \\
      --bootstrap-exclude "src/provider/*.ts" \\
      --bootstrap-exclude "src/bootstrap/**"                multiple exclusion patterns`
    )
    .action(
      async (
        dir: string,
        options: {
          /**
           * Commander strips the "no-" prefix from --no-direct-launchdarkly
           * and exposes the property as `directLaunchdarkly`.
           * Default (flag absent) → true.  Flag present → false.
           */
          directLaunchdarkly: boolean;
          bootstrapExclude: string[];
          format: string;
          output?: string;
          config?: string;
        }
      ) => {
        // Validate format before doing any I/O
        if (!(VALID_VALIDATE_FORMATS as readonly string[]).includes(options.format)) {
          process.stderr.write(
            chalk.red(
              `Error: Invalid format '${options.format}'. Must be one of: ${VALID_VALIDATE_FORMATS.join(", ")}\n`
            )
          );
          process.exit(2);
        }

        const format = options.format as ValidateFormat;

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

        const spinner = ora(`Scanning ${dir}...`).start();
        process.once("SIGINT", () => { spinner.stop(); process.exit(130); });

        const source = new LocalFileSource(dir);

        let scanResult;
        try {
          scanResult = await scan(source, config, (filesScanned) => {
            spinner.text = `Scanning files... ${filesScanned}`;
          });
          spinner.stop();
        } catch (err) {
          spinner.fail("Scan failed");
          process.stderr.write(chalk.red(String(err)) + "\n");
          process.exit(1);
        }

        // Surface any file-read or parse warnings
        for (const w of scanResult.warnings) {
          const msg =
            w.kind === "read-failure"
              ? `warn: could not read ${w.file} (${w.fsCode})`
              : `warn: failed to parse ${w.file}`;
          process.stderr.write(chalk.yellow(msg + "\n"));
        }

        // Commander strips "no-" prefix: --no-direct-launchdarkly → directLaunchdarkly = false.
        // Default (flag absent) is true; we want the rule active only when the flag IS passed.
        const noDirectLaunchDarkly = options.directLaunchdarkly === false;
        const bootstrapExclude: string[] = options.bootstrapExclude ?? [];

        const validateOptions = {
          noDirectLaunchDarkly,
          bootstrapExclude,
        };

        const validationResult = validateScanResult(scanResult, validateOptions);

        let report: string;
        if (format === "sarif") {
          report = formatValidationSarif(
            validationResult,
            scanResult.scanRoot,
            scanResult.scannedAt
          );
        } else {
          report = formatValidationReport(validationResult, validateOptions);
        }

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
          process.stdout.write(report);
        }

        if (!validationResult.passed) {
          process.exit(1);
        }
        process.exit(0);
      }
    );
}
