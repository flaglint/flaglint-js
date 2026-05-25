import { Command } from "commander";
import { registerScanCommand } from "./commands/scan.js";
import { registerMigrateCommand } from "./commands/migrate.js";
import { registerValidateCommand } from "./commands/validate.js";

declare const __PKG_VERSION__: string;
declare const __PKG_DESCRIPTION__: string;

export function createCLI(): Command {
  const program = new Command();

  program
    .name("flaglint")
    .description(__PKG_DESCRIPTION__)
    .version(__PKG_VERSION__, "-v, --version", "output the current version")
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
  $ flaglint validate --no-direct-launchdarkly  enforce OF migration in CI`
    );

  registerScanCommand(program);
  registerMigrateCommand(program);
  registerValidateCommand(program);

  return program;
}
