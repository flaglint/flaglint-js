import { Command } from "commander";
import chalk from "chalk";
import { registerScanCommand } from "./commands/scan.js";
import { registerMigrateCommand } from "./commands/migrate.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerInitCommand } from "./commands/init.js";
import { registerCompletionCommand } from "./commands/completion.js";
import { setOutputMode } from "./commands/shared.js";

declare const __PKG_VERSION__: string;
declare const __PKG_DESCRIPTION__: string;

export function createCLI(): Command {
  const program = new Command();

  program
    .name("flaglint")
    .description(__PKG_DESCRIPTION__)
    .version(__PKG_VERSION__, "-v, --version", "output the current version")
    .option("-q, --quiet", "suppress all informational output (errors still appear)")
    .option("--verbose", "show detailed per-file progress")
    .option("--no-color", "disable ANSI color output")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint scan                    scan current directory
  $ flaglint scan ./src              scan specific directory
  $ flaglint scan --format json      output as JSON
  $ flaglint scan --output report.md save to file
  $ flaglint migrate                 generate migration plan
  $ flaglint migrate --dry-run       preview without writing
  $ flaglint validate --no-direct-launchdarkly  enforce OF migration in CI
  $ flaglint audit                   generate flag debt audit report
  $ flaglint audit --format html     shareable HTML report
  $ flaglint audit --output audit.md save to file
  $ flaglint init                    scaffold a flaglint.config.json
  $ flaglint completion bash         generate bash shell completion`
    );

  // Set output mode before any subcommand runs
  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts<{ quiet?: boolean; verbose?: boolean; color?: boolean }>();
    if (opts.color === false || process.env.NO_COLOR !== undefined) {
      chalk.level = 0;
      process.env.NO_COLOR = "1";
    }
    setOutputMode({ quiet: opts.quiet ?? false, verbose: opts.verbose ?? false });
  });

  registerInitCommand(program);
  registerScanCommand(program);
  registerMigrateCommand(program);
  registerValidateCommand(program);
  registerAuditCommand(program);
  registerCompletionCommand(program);

  return program;
}
