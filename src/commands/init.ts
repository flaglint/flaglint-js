import { writeFile, access } from "fs/promises";
import { resolve } from "path";
import type { Command } from "commander";
import chalk from "chalk";

const DEFAULT_CONFIG_FILENAME = "flaglint.config.json";

const SEARCH_PATHS = [".flaglintrc", ".flaglintrc.json", "flaglint.config.json"];

const CONFIG_TEMPLATE = {
  include: ["**/*.{ts,tsx,js,jsx}"],
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.d.ts",
  ],
  provider: "launchdarkly",
  minFileCount: 0,
  wrappers: [],
  openFeatureClientBindings: [],
  outputDir: ".",
};

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scaffold a flaglint.config.json with default settings")
    .option(
      "-o, --output <file>",
      `config file to create (default: ${DEFAULT_CONFIG_FILENAME})`,
      DEFAULT_CONFIG_FILENAME
    )
    .option("--force", "overwrite an existing config file")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint init                          create flaglint.config.json in current directory
  $ flaglint init --output .flaglintrc.json  create with a custom filename
  $ flaglint init --force                  overwrite an existing config`
    )
    .action(async (options: { output: string; force?: boolean }) => {
      const outPath = resolve(options.output);

      // Detect pre-existing config file unless --force
      if (!options.force) {
        // Check the requested output path first
        try {
          await access(outPath);
          process.stderr.write(
            chalk.red(
              `Error: ${options.output} already exists. Use --force to overwrite.\n`
            )
          );
          process.exit(2);
        } catch {
          // File does not exist — continue
        }

        // Warn about higher-precedence standard config files that would shadow the new file.
        // loadConfig checks SEARCH_PATHS in order and returns the first match, so only
        // files at a lower index (higher precedence) than options.output can shadow it.
        const outputIdxInSearch = SEARCH_PATHS.findIndex(
          (p) => resolve(p) === outPath
        );
        for (const candidate of SEARCH_PATHS) {
          const candidateResolved = resolve(candidate);
          if (candidateResolved === outPath) continue; // same file (resolved), skip
          const candidateIdx = SEARCH_PATHS.indexOf(candidate);
          // If output is in SEARCH_PATHS, only warn about strictly higher-precedence entries.
          // If output is not in SEARCH_PATHS (custom filename), any standard file shadows it.
          if (outputIdxInSearch !== -1 && candidateIdx >= outputIdxInSearch) continue;
          try {
            await access(candidateResolved);
            process.stderr.write(
              chalk.yellow(
                `warn: ${candidate} already exists and takes precedence — flaglint will use it instead of ${options.output}\n`
              )
            );
          } catch {
            // Not found — fine
          }
        }
      }

      const content = JSON.stringify(CONFIG_TEMPLATE, null, 2) + "\n";

      try {
        await writeFile(outPath, content, "utf8");
      } catch (err) {
        process.stderr.write(
          chalk.red(
            `Error: Failed to write ${options.output}: ${err instanceof Error ? err.message : String(err)}\n`
          )
        );
        process.exit(1);
      }

      process.stderr.write(chalk.green(`✓ Created ${options.output}\n\n`));
      process.stderr.write(chalk.bold("Fields:\n"));
      process.stderr.write(chalk.dim(
        `  include               Glob patterns to scan (default: all TS/JS files)\n` +
        `  exclude               Glob patterns to skip (default: node_modules, dist, build, .next, coverage, .d.ts)\n` +
        `  provider              Feature flag vendor — only "launchdarkly" is supported in v1\n` +
        `  minFileCount          Flag a key as potentially stale if found in fewer files than this threshold (0 = disabled)\n` +
        `  wrappers              Custom functions that wrap LD SDK calls — detected as flag evaluations\n` +
        `                        String form: ["myGetFlag"]  Object form: [{"import":"my-sdk","function":"getFlag","flagKeyArgument":0}]\n` +
        `  openFeatureClientBindings  OpenFeature client variable names for migration rewrites\n` +
        `  outputDir             Directory for generated reports (default: "." = current directory)\n`
      ));
      process.stderr.write(chalk.dim(`\nNext steps:\n`));
      process.stderr.write(chalk.dim(`  Edit ${options.output} to match your project structure\n`));
      process.stderr.write(chalk.dim(`  Run: flaglint scan\n`));

      process.exit(0);
    });
}
