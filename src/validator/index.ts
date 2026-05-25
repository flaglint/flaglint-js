import type { ScanResult, FlagUsage, CallType } from "../types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationViolation {
  file: string;
  line: number;
  column: number;
  callType: CallType;
  flagKey: string;
  isDynamic: boolean;
}

export interface ValidationResult {
  scannedFiles: number;
  totalUsages: number;
  /** Call-sites that violated the active policy rules. */
  violations: ValidationViolation[];
  /**
   * True when no policy rules are violated.
   * The CLI maps this directly: true → exit 0, false → exit 1.
   */
  passed: boolean;
}

export interface ValidateOptions {
  /**
   * When true, any direct LaunchDarkly Node server SDK evaluation call is a
   * violation.  Without this flag the command reports but never fails.
   */
  noDirectLaunchDarkly?: boolean;
  /**
   * Glob patterns (relative to the scan root) for files that are legitimately
   * allowed to use the LaunchDarkly SDK directly — e.g. OpenFeature provider
   * bootstrap files that instantiate `LaunchDarklyProvider`.
   * Usages in matching files are silently excluded from violations.
   */
  bootstrapExclude?: string[];
}

// ── Bootstrap-file glob matching ──────────────────────────────────────────────

/**
 * Returns true when `file` matches any of the `patterns`.
 *
 * Supports:
 *   exact path   "src/provider/setup.ts"
 *   * wildcard   "src/provider/*.ts"         — matches within one directory level
 *   ** wildcard  "src/bootstrap/**"           — matches across directory levels
 *
 * No external dependency — avoids importing micromatch/minimatch directly.
 */
export function matchesBootstrapPattern(file: string, patterns: string[]): boolean {
  // Normalise leading "./"
  const clean = (s: string): string => s.replace(/^\.\//, "");
  const cleanFile = clean(file);

  return patterns.some((pattern) => {
    const cleanPattern = clean(pattern);
    if (cleanFile === cleanPattern) return true;

    // Convert glob to a regular expression.
    const regexStr = cleanPattern
      // Escape regex-special chars except * and ?
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      // Temporarily hide ** before processing single *
      .replace(/\*\*/g, "\x00")
      // Single * → match any sequence that does NOT cross a /
      .replace(/\*/g, "[^/]*")
      // ** → match anything including /
      .replace(/\x00/g, ".*")
      // ? → single non-separator char
      .replace(/\?/g, "[^/]");

    try {
      return new RegExp(`^${regexStr}$`).test(cleanFile);
    } catch {
      return false;
    }
  });
}

// ── Core validation logic ─────────────────────────────────────────────────────

/**
 * Evaluate a scan result against the requested policy rules.
 *
 * Rules enforced:
 *   --no-direct-launchdarkly: every direct LD Node server evaluation call is a
 *     violation, including dynamic-key calls and manual-review cases.
 *     Files matching `bootstrapExclude` are excluded from violations.
 *
 * Rules NOT enforced here:
 *   - Staleness / flag cleanup — this command never claims flags are stale or
 *     safe to delete.
 *   - OpenFeature calls — the scanner does not detect them; they are invisible
 *     to this command and can never be violations.
 */
export function validateScanResult(
  result: ScanResult,
  options: ValidateOptions = {}
): ValidationResult {
  const violations: ValidationViolation[] = [];

  if (options.noDirectLaunchDarkly) {
    const bootstrapExclude = options.bootstrapExclude ?? [];

    for (const usage of result.usages) {
      if (matchesBootstrapPattern(usage.file, bootstrapExclude)) continue;
      violations.push({
        file: usage.file,
        line: usage.line,
        column: usage.column,
        callType: usage.callType,
        flagKey: usage.flagKey,
        isDynamic: usage.isDynamic,
      });
    }
  }

  return {
    scannedFiles: result.scannedFiles,
    totalUsages: result.totalUsages,
    violations,
    passed: violations.length === 0,
  };
}

// ── Human-readable report ─────────────────────────────────────────────────────

function violationLabel(v: ValidationViolation): string {
  if (v.isDynamic) return `${v.callType}(dynamic key — manual review required)`;
  if (v.flagKey === "*") return `${v.callType}(bulk inventory)`;
  return `${v.callType}("${v.flagKey}")`;
}

/**
 * Format a ValidationResult as a human-readable string for stdout/stderr.
 *
 * Guarantees:
 *   - Never mentions staleness, flag cleanup, or "safe to delete".
 *   - On failure, directs the user to `flaglint migrate --dry-run`.
 *   - On success, confirms the scanned file count.
 */
export function formatValidationReport(
  result: ValidationResult,
  options: ValidateOptions = {}
): string {
  const lines: string[] = [];

  if (!options.noDirectLaunchDarkly) {
    lines.push(
      `Scanned ${result.scannedFiles} file(s). Found ${result.totalUsages} LaunchDarkly usage(s).`
    );
    return lines.join("\n") + "\n";
  }

  if (result.passed) {
    lines.push(
      `✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.`
    );
    lines.push(`  Scanned ${result.scannedFiles} file(s).`);
    return lines.join("\n") + "\n";
  }

  const count = result.violations.length;
  lines.push(
    `✗ validate --no-direct-launchdarkly: ${count} direct LaunchDarkly evaluation call(s) found.`
  );
  lines.push("");

  for (const v of result.violations) {
    lines.push(`  ${v.file}:${v.line}:${v.column} — ${violationLabel(v)}`);
  }

  lines.push("");
  lines.push("These files must migrate to OpenFeature before this rule passes.");
  lines.push("Run `flaglint migrate --dry-run` to review the migration plan.");

  return lines.join("\n") + "\n";
}
