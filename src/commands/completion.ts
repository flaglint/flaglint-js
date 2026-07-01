import type { Command } from "commander";
import chalk from "chalk";

type Shell = "bash" | "zsh" | "fish";
const SUPPORTED_SHELLS: Shell[] = ["bash", "zsh", "fish"];

// ──────────────────────────────────────────────────────────────────────────────
// Bash completion
// ──────────────────────────────────────────────────────────────────────────────

function bashScript(): string {
  return [
    "_flaglint_completions() {",
    "  local cur prev words cword",
    "  if declare -F _init_completion &>/dev/null; then",
    "    _init_completion || return",
    "  else",
    '    cur="${COMP_WORDS[COMP_CWORD]}"',
    '    prev="${COMP_WORDS[COMP_CWORD-1]}"',
    '    words=("${COMP_WORDS[@]}")',
    "    cword=$COMP_CWORD",
    "  fi",
    "",
    '  local commands="scan migrate validate audit init completion"',
    "",
    "  if [[ $cword -eq 1 ]]; then",
    '    COMPREPLY=($(compgen -W "$commands --version --help --quiet -v -h -q" -- "$cur"))',
    "    return",
    "  fi",
    "",
    '  local command="${words[1]}"',
    "",
    "  # Value completions for flags that take arguments",
    '  if [[ "$prev" == "--format" || "$prev" == "-f" ]]; then',
    '    case "$command" in',
    '      scan)     COMPREPLY=($(compgen -W "json markdown html sarif" -- "$cur")); return ;;',
    '      audit)    COMPREPLY=($(compgen -W "json markdown html" -- "$cur")); return ;;',
    '      validate) COMPREPLY=($(compgen -W "text sarif" -- "$cur")); return ;;',
    "    esac",
    "  fi",
    "",
    '  if [[ "$prev" == "--output" || "$prev" == "-o" || \\',
    '        "$prev" == "--config" || "$prev" == "-c" || \\',
    '        "$prev" == "--baseline" || "$prev" == "--write-baseline" || \\',
    '        "$prev" == "--bootstrap-exclude" ]]; then',
    "    _filedir",
    "    return",
    "  fi",
    "",
    '  if [[ "$command" == "completion" ]]; then',
    '    COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur"))',
    "    return",
    "  fi",
    "",
    "  # Per-command flag completion",
    '  case "$command" in',
    "    scan)",
    '      COMPREPLY=($(compgen -W "-f --format -o --output -c --config --exclude-tests -h --help" -- "$cur"))',
    "      ;;",
    "    migrate)",
    '      COMPREPLY=($(compgen -W "-o --output -c --config --dry-run --apply --allow-dirty --exclude-tests -h --help" -- "$cur"))',
    "      ;;",
    "    validate)",
    '      COMPREPLY=($(compgen -W "--no-direct-launchdarkly --bootstrap-exclude -f --format -o --output -c --config --baseline --fail-on-new -h --help" -- "$cur"))',
    "      ;;",
    "    audit)",
    '      COMPREPLY=($(compgen -W "-f --format -o --output -c --config --exclude-tests --effort-estimate --hourly-rate --write-baseline -h --help" -- "$cur"))',
    "      ;;",
    "    init)",
    '      COMPREPLY=($(compgen -W "-o --output --force -h --help" -- "$cur"))',
    "      ;;",
    "  esac",
    "}",
    "",
    "complete -F _flaglint_completions flaglint",
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Zsh completion
// ──────────────────────────────────────────────────────────────────────────────

function zshScript(): string {
  return [
    "#compdef flaglint",
    "",
    "_flaglint() {",
    "  local state",
    "  local -a commands",
    "",
    "  commands=(",
    "    'scan:Scan a directory for feature flag usages'",
    "    'migrate:Generate an OpenFeature migration plan'",
    "    'validate:Validate feature flag usage policies in CI'",
    "    'audit:Generate a flag debt audit report'",
    "    'init:Scaffold a flaglint.config.json'",
    "    'completion:Output shell completion script'",
    "  )",
    "",
    "  _arguments -C \\",
    "    '(-v --version)'{-v,--version}'[output the current version]' \\",
    "    '(-h --help)'{-h,--help}'[display help]' \\",
    "    '(-q --quiet)'{-q,--quiet}'[suppress progress output]' \\",
    "    '1:command:->command' \\",
    "    '*::args:->args'",
    "",
    "  case $state in",
    "    command)",
    "      _describe 'command' commands",
    "      ;;",
    "    args)",
    "      case ${words[1]} in",
    "        scan)",
    "          _arguments \\",
    "            '(-f --format)'{-f,--format}'[output format]:format:(json markdown html sarif)' \\",
    "            '(-o --output)'{-o,--output}'[write report to file]:file:_files' \\",
    "            '(-c --config)'{-c,--config}'[path to config file]:file:_files' \\",
    "            '--exclude-tests[exclude test files]' \\",
    "            '(-h --help)'{-h,--help}'[display help]'",
    "          ;;",
    "        migrate)",
    "          _arguments \\",
    "            '(-o --output)'{-o,--output}'[write migration plan to file]:file:_files' \\",
    "            '(-c --config)'{-c,--config}'[path to config file]:file:_files' \\",
    "            '--dry-run[preview diffs without writing]' \\",
    "            '--apply[apply safe transformations in-place]' \\",
    "            '--allow-dirty[allow --apply on a dirty git tree]' \\",
    "            '--exclude-tests[exclude test files]' \\",
    "            '(-h --help)'{-h,--help}'[display help]'",
    "          ;;",
    "        validate)",
    "          _arguments \\",
    "            '--no-direct-launchdarkly[fail on any direct LD eval calls]' \\",
    "            '--bootstrap-exclude[allow this path to use LD directly]:glob:_files' \\",
    "            '(-f --format)'{-f,--format}'[output format]:format:(text sarif)' \\",
    "            '(-o --output)'{-o,--output}'[write report to file]:file:_files' \\",
    "            '(-c --config)'{-c,--config}'[path to config file]:file:_files' \\",
    "            '--baseline[baseline file for comparison]:file:_files' \\",
    "            '--fail-on-new[exit 1 if new findings beyond baseline]' \\",
    "            '(-h --help)'{-h,--help}'[display help]'",
    "          ;;",
    "        audit)",
    "          _arguments \\",
    "            '(-f --format)'{-f,--format}'[output format]:format:(json markdown html)' \\",
    "            '(-o --output)'{-o,--output}'[write report to file]:file:_files' \\",
    "            '(-c --config)'{-c,--config}'[path to config file]:file:_files' \\",
    "            '--exclude-tests[exclude test files]' \\",
    "            '--effort-estimate[include migration effort estimate]' \\",
    "            '--hourly-rate[hourly rate for cost projection]:rate:' \\",
    "            '--write-baseline[write fingerprints to baseline file]:file:_files' \\",
    "            '(-h --help)'{-h,--help}'[display help]'",
    "          ;;",
    "        init)",
    "          _arguments \\",
    "            '(-o --output)'{-o,--output}'[output file path]:file:_files' \\",
    "            '--force[overwrite existing config]' \\",
    "            '(-h --help)'{-h,--help}'[display help]'",
    "          ;;",
    "        completion)",
    "          _arguments '1:shell:(bash zsh fish)'",
    "          ;;",
    "      esac",
    "      ;;",
    "  esac",
    "}",
    "",
    "_flaglint \"$@\"",
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Fish completion
// ──────────────────────────────────────────────────────────────────────────────

function fishScript(): string {
  return [
    "# flaglint shell completions for fish",
    "# Generated by: flaglint completion fish",
    "",
    "# Disable file completions by default",
    "complete -c flaglint -f",
    "",
    "# Subcommands",
    "complete -c flaglint -n '__fish_use_subcommand' -a scan       -d 'Scan a directory for feature flag usages'",
    "complete -c flaglint -n '__fish_use_subcommand' -a migrate    -d 'Generate an OpenFeature migration plan'",
    "complete -c flaglint -n '__fish_use_subcommand' -a validate   -d 'Validate feature flag usage policies in CI'",
    "complete -c flaglint -n '__fish_use_subcommand' -a audit      -d 'Generate a flag debt audit report'",
    "complete -c flaglint -n '__fish_use_subcommand' -a init       -d 'Scaffold a flaglint.config.json'",
    "complete -c flaglint -n '__fish_use_subcommand' -a completion -d 'Output shell completion script'",
    "",
    "# Global flags",
    "complete -c flaglint -n '__fish_use_subcommand' -l version -s v -d 'Output the current version'",
    "complete -c flaglint -n '__fish_use_subcommand' -l quiet   -s q -d 'Suppress progress output'",
    "",
    "# scan",
    "complete -c flaglint -n '__fish_seen_subcommand_from scan' -s f -l format -x -a 'json markdown html sarif' -d 'Output format'",
    "complete -c flaglint -n '__fish_seen_subcommand_from scan' -s o -l output  -r -d 'Write report to file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from scan' -s c -l config  -r -d 'Path to config file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from scan' -l exclude-tests    -d 'Exclude test files'",
    "",
    "# migrate",
    "complete -c flaglint -n '__fish_seen_subcommand_from migrate' -s o -l output      -r -d 'Write migration plan to file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from migrate' -s c -l config      -r -d 'Path to config file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from migrate' -l dry-run          -d 'Preview diffs without writing'",
    "complete -c flaglint -n '__fish_seen_subcommand_from migrate' -l apply            -d 'Apply safe transformations in-place'",
    "complete -c flaglint -n '__fish_seen_subcommand_from migrate' -l allow-dirty      -d 'Allow --apply on a dirty git tree'",
    "complete -c flaglint -n '__fish_seen_subcommand_from migrate' -l exclude-tests    -d 'Exclude test files'",
    "",
    "# validate",
    "complete -c flaglint -n '__fish_seen_subcommand_from validate' -l no-direct-launchdarkly -d 'Fail on direct LD eval calls'",
    "complete -c flaglint -n '__fish_seen_subcommand_from validate' -l bootstrap-exclude -r    -d 'Allow this path to use LD directly'",
    "complete -c flaglint -n '__fish_seen_subcommand_from validate' -s f -l format -x -a 'text sarif' -d 'Output format'",
    "complete -c flaglint -n '__fish_seen_subcommand_from validate' -s o -l output  -r -d 'Write report to file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from validate' -s c -l config  -r -d 'Path to config file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from validate' -l baseline     -r -d 'Baseline file for comparison'",
    "complete -c flaglint -n '__fish_seen_subcommand_from validate' -l fail-on-new     -d 'Exit 1 if new findings beyond baseline'",
    "",
    "# audit",
    "complete -c flaglint -n '__fish_seen_subcommand_from audit' -s f -l format -x -a 'json markdown html' -d 'Output format'",
    "complete -c flaglint -n '__fish_seen_subcommand_from audit' -s o -l output  -r -d 'Write report to file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from audit' -s c -l config  -r -d 'Path to config file'",
    "complete -c flaglint -n '__fish_seen_subcommand_from audit' -l exclude-tests     -d 'Exclude test files'",
    "complete -c flaglint -n '__fish_seen_subcommand_from audit' -l effort-estimate   -d 'Include migration effort estimate'",
    "complete -c flaglint -n '__fish_seen_subcommand_from audit' -l hourly-rate  -r   -d 'Hourly rate for cost projection'",
    "complete -c flaglint -n '__fish_seen_subcommand_from audit' -l write-baseline -r -d 'Write fingerprints to baseline file'",
    "",
    "# init",
    "complete -c flaglint -n '__fish_seen_subcommand_from init' -s o -l output -r -d 'Output file path'",
    "complete -c flaglint -n '__fish_seen_subcommand_from init' -l force              -d 'Overwrite existing config'",
    "",
    "# completion",
    "complete -c flaglint -n '__fish_seen_subcommand_from completion' -f -a 'bash zsh fish' -d 'Target shell'",
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────────────────────

export function registerCompletionCommand(program: Command): void {
  program
    .command("completion")
    .description("Output shell completion script")
    .argument("[shell]", "target shell: bash | zsh | fish")
    .addHelpText(
      "after",
      `
Examples:
  $ flaglint completion bash >> ~/.bash_completion
  $ flaglint completion zsh  > ~/.zsh/completions/_flaglint
  $ flaglint completion fish > ~/.config/fish/completions/flaglint.fish

Or load for the current session only (bash):
  $ source <(flaglint completion bash)

Or load for the current session only (zsh):
  $ source <(flaglint completion zsh)`
    )
    .action((shell: string | undefined) => {
      if (!shell) {
        process.stderr.write(
          chalk.red(
            `Error: Shell argument required. Choose one of: ${SUPPORTED_SHELLS.join(", ")}\n`
          )
        );
        process.exit(2);
      }

      if (!(SUPPORTED_SHELLS as string[]).includes(shell)) {
        process.stderr.write(
          chalk.red(
            `Error: Unsupported shell '${shell}'. Supported: ${SUPPORTED_SHELLS.join(", ")}\n`
          )
        );
        process.exit(2);
      }

      const scripts: Record<Shell, () => string> = {
        bash: bashScript,
        zsh: zshScript,
        fish: fishScript,
      };

      process.stdout.write(scripts[shell as Shell]() + "\n");
    });
}
