import { Command } from "commander";
import { registerScanCommand } from "./commands/scan.js";
import { registerMigrateCommand } from "./commands/migrate.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerInitCommand } from "./commands/init.js";

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
  $ flaglint validate --no-direct-launchdarkly  enforce OF migration in CI
  $ flaglint audit                   generate flag debt audit report
  $ flaglint audit --format html     shareable HTML report
  $ flaglint audit --output audit.md save to file
  $ flaglint init                   scaffold a flaglint.config.json`
    );

  registerInitCommand(program);
  registerScanCommand(program);
  registerMigrateCommand(program);
  registerValidateCommand(program);
  registerAuditCommand(program);

  return program;
}
