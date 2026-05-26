import { describe, it, expect } from "vitest";
import type { ScanResult, FlagUsage } from "../../types.js";
import {
  validateScanResult,
  formatValidationReport,
  formatValidationSarif,
  matchesBootstrapPattern,
  type ValidationResult,
  type ValidateOptions,
} from "../index.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeScanResult(usages: Partial<FlagUsage>[] = [], scannedFiles = 3): ScanResult {
  const full: FlagUsage[] = usages.map((u, i) => ({
    flagKey: u.flagKey ?? "my-flag",
    isDynamic: u.isDynamic ?? false,
    file: u.file ?? `src/service${i}.ts`,
    line: u.line ?? 10,
    column: u.column ?? 5,
    callType: u.callType ?? "boolVariation",
    stalenessSignals: u.stalenessSignals ?? [],
  }));
  return {
    scannedAt: "2024-01-01T00:00:00Z",
    scanRoot: "/project",
    scannedFiles,
    totalUsages: full.length,
    uniqueFlags: [...new Set(full.map((u) => u.flagKey))],
    usages: full,
    scanDurationMs: 1,
    warnings: [],
  };
}

// ── matchesBootstrapPattern ───────────────────────────────────────────────────

describe("matchesBootstrapPattern", () => {
  it("matches exact paths", () => {
    expect(matchesBootstrapPattern("src/provider/setup.ts", ["src/provider/setup.ts"])).toBe(true);
  });

  it("matches exact path with leading ./", () => {
    expect(matchesBootstrapPattern("src/provider/setup.ts", ["./src/provider/setup.ts"])).toBe(true);
    expect(matchesBootstrapPattern("./src/provider/setup.ts", ["src/provider/setup.ts"])).toBe(true);
  });

  it("does not match different exact path", () => {
    expect(matchesBootstrapPattern("src/other.ts", ["src/provider/setup.ts"])).toBe(false);
  });

  it("matches * wildcard within one directory level", () => {
    expect(matchesBootstrapPattern("src/provider/setup.ts", ["src/provider/*.ts"])).toBe(true);
    expect(matchesBootstrapPattern("src/provider/init.ts", ["src/provider/*.ts"])).toBe(true);
  });

  it("does not match * wildcard across directory levels", () => {
    expect(matchesBootstrapPattern("src/provider/sub/setup.ts", ["src/provider/*.ts"])).toBe(false);
  });

  it("matches ** wildcard across directory levels", () => {
    expect(matchesBootstrapPattern("src/bootstrap/setup.ts", ["src/bootstrap/**"])).toBe(true);
    expect(matchesBootstrapPattern("src/bootstrap/deep/nested/init.ts", ["src/bootstrap/**"])).toBe(true);
  });

  it("matches ** in middle of path", () => {
    expect(matchesBootstrapPattern("src/provider/sub/setup.ts", ["src/**/setup.ts"])).toBe(true);
  });

  it("returns false for empty patterns array", () => {
    expect(matchesBootstrapPattern("src/provider/setup.ts", [])).toBe(false);
  });

  it("matches any pattern in the list", () => {
    expect(
      matchesBootstrapPattern("src/provider/setup.ts", ["unrelated.ts", "src/provider/*.ts"])
    ).toBe(true);
  });

  it("handles ? wildcard as single non-separator char", () => {
    expect(matchesBootstrapPattern("src/provider/a.ts", ["src/provider/?.ts"])).toBe(true);
    expect(matchesBootstrapPattern("src/provider/ab.ts", ["src/provider/?.ts"])).toBe(false);
  });
});

// ── validateScanResult — --no-direct-launchdarkly ────────────────────────────

describe("validateScanResult — --no-direct-launchdarkly", () => {
  const opts: ValidateOptions = { noDirectLaunchDarkly: true };

  it("reports a direct LD boolVariation call as a violation", () => {
    const result = validateScanResult(makeScanResult([{ callType: "boolVariation", flagKey: "flag-a" }]), opts);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].flagKey).toBe("flag-a");
    expect(result.violations[0].callType).toBe("boolVariation");
  });

  it("reports stringVariation as a violation", () => {
    const result = validateScanResult(makeScanResult([{ callType: "stringVariation", flagKey: "color-theme" }]), opts);
    expect(result.passed).toBe(false);
    expect(result.violations[0].callType).toBe("stringVariation");
  });

  it("reports numberVariation as a violation", () => {
    const result = validateScanResult(makeScanResult([{ callType: "numberVariation", flagKey: "timeout" }]), opts);
    expect(result.passed).toBe(false);
    expect(result.violations[0].callType).toBe("numberVariation");
  });

  it("reports jsonVariation as a violation", () => {
    const result = validateScanResult(makeScanResult([{ callType: "jsonVariation", flagKey: "config" }]), opts);
    expect(result.passed).toBe(false);
    expect(result.violations[0].callType).toBe("jsonVariation");
  });

  it("reports plain variation() as a violation", () => {
    const result = validateScanResult(makeScanResult([{ callType: "variation", flagKey: "flag-b" }]), opts);
    expect(result.passed).toBe(false);
  });

  it("reports detail methods (variationDetail) as violations", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "variationDetail", flagKey: "flag-c" }]),
      opts
    );
    expect(result.passed).toBe(false);
    expect(result.violations[0].callType).toBe("variationDetail");
  });

  it("reports boolVariationDetail as a violation", () => {
    const result = validateScanResult(makeScanResult([{ callType: "boolVariationDetail", flagKey: "f" }]), opts);
    expect(result.passed).toBe(false);
  });

  it("reports bulk allFlags call as a violation", () => {
    const result = validateScanResult(makeScanResult([{ callType: "allFlags", flagKey: "*" }]), opts);
    expect(result.passed).toBe(false);
    expect(result.violations[0].flagKey).toBe("*");
  });

  it("reports dynamic key as a violation", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "dynamic", isDynamic: true }]),
      opts
    );
    expect(result.passed).toBe(false);
    expect(result.violations[0].isDynamic).toBe(true);
  });

  it("passes when there are no usages", () => {
    const result = validateScanResult(makeScanResult([]), opts);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("reports multiple violations across multiple files", () => {
    const result = validateScanResult(
      makeScanResult([
        { file: "src/a.ts", callType: "boolVariation", flagKey: "flag-1" },
        { file: "src/b.ts", callType: "stringVariation", flagKey: "flag-2" },
        { file: "src/c.ts", callType: "jsonVariation", flagKey: "flag-3" },
      ]),
      opts
    );
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(3);
  });

  it("populates violation fields correctly", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/feature.ts", line: 42, column: 8, callType: "numberVariation", flagKey: "timeout-ms" }]),
      opts
    );
    const v = result.violations[0];
    expect(v.file).toBe("src/feature.ts");
    expect(v.line).toBe(42);
    expect(v.column).toBe(8);
    expect(v.callType).toBe("numberVariation");
    expect(v.flagKey).toBe("timeout-ms");
  });

  it("without --no-direct-launchdarkly flag, no violations are produced", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "flag-a" }]),
      {} // no noDirectLaunchDarkly
    );
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("preserves scannedFiles and totalUsages counts", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation" }, { callType: "stringVariation" }], 7),
      opts
    );
    expect(result.scannedFiles).toBe(7);
    expect(result.totalUsages).toBe(2);
  });
});

// ── validateScanResult — bootstrap exclusions ─────────────────────────────────

describe("validateScanResult — bootstrap exclusions", () => {
  const opts: ValidateOptions = {
    noDirectLaunchDarkly: true,
    bootstrapExclude: ["src/provider/setup.ts"],
  };

  it("excludes exact-path bootstrap file from violations", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/provider/setup.ts", callType: "boolVariation", flagKey: "f" }]),
      opts
    );
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("still violations for non-excluded files", () => {
    const result = validateScanResult(
      makeScanResult([
        { file: "src/provider/setup.ts", callType: "boolVariation", flagKey: "bootstrap-call" },
        { file: "src/service.ts", callType: "boolVariation", flagKey: "service-flag" },
      ]),
      opts
    );
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toBe("src/service.ts");
  });

  it("excludes files matching glob wildcard", () => {
    const globOpts: ValidateOptions = {
      noDirectLaunchDarkly: true,
      bootstrapExclude: ["src/provider/*.ts"],
    };
    const result = validateScanResult(
      makeScanResult([
        { file: "src/provider/setup.ts", callType: "boolVariation" },
        { file: "src/provider/init.ts", callType: "boolVariation" },
      ]),
      globOpts
    );
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("excludes files matching ** glob across directories", () => {
    const globOpts: ValidateOptions = {
      noDirectLaunchDarkly: true,
      bootstrapExclude: ["src/bootstrap/**"],
    };
    const result = validateScanResult(
      makeScanResult([
        { file: "src/bootstrap/provider.ts", callType: "boolVariation" },
        { file: "src/bootstrap/deep/init.ts", callType: "boolVariation" },
      ]),
      globOpts
    );
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("does NOT exclude files outside the bootstrap glob", () => {
    const globOpts: ValidateOptions = {
      noDirectLaunchDarkly: true,
      bootstrapExclude: ["src/bootstrap/**"],
    };
    const result = validateScanResult(
      makeScanResult([
        { file: "src/bootstrap/provider.ts", callType: "boolVariation" },
        { file: "src/services/feature.ts", callType: "boolVariation" },
      ]),
      globOpts
    );
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toBe("src/services/feature.ts");
  });

  it("multiple bootstrap patterns can be combined", () => {
    const multiOpts: ValidateOptions = {
      noDirectLaunchDarkly: true,
      bootstrapExclude: ["src/provider/setup.ts", "src/bootstrap/**"],
    };
    const result = validateScanResult(
      makeScanResult([
        { file: "src/provider/setup.ts", callType: "boolVariation" },
        { file: "src/bootstrap/init.ts", callType: "boolVariation" },
      ]),
      multiOpts
    );
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("empty bootstrapExclude array excludes nothing", () => {
    const emptyOpts: ValidateOptions = {
      noDirectLaunchDarkly: true,
      bootstrapExclude: [],
    };
    const result = validateScanResult(
      makeScanResult([{ file: "src/provider/setup.ts", callType: "boolVariation" }]),
      emptyOpts
    );
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
  });
});

// ── validateScanResult — OpenFeature passes ───────────────────────────────────

describe("validateScanResult — OpenFeature calls are invisible", () => {
  it("zero usages produces passed=true (OF-only codebase)", () => {
    // The scanner only detects LD SDK calls.
    // An OF-only codebase would produce 0 usages → always passes.
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("a file with zero scan usages is never a violation source", () => {
    // Scanned 5 files, no LD usages detected → passed
    const emptyScan = makeScanResult([], 5);
    const result = validateScanResult(emptyScan, { noDirectLaunchDarkly: true });
    expect(result.passed).toBe(true);
  });
});

// ── validateScanResult — exit behavior ───────────────────────────────────────

describe("validateScanResult — exit behavior (passed flag)", () => {
  it("passed=true when no violations", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    expect(result.passed).toBe(true);
  });

  it("passed=false when at least one violation", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation" }]),
      { noDirectLaunchDarkly: true }
    );
    expect(result.passed).toBe(false);
  });

  it("passed=true when all usages are in excluded bootstrap files", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/provider/setup.ts", callType: "boolVariation" }]),
      { noDirectLaunchDarkly: true, bootstrapExclude: ["src/provider/setup.ts"] }
    );
    expect(result.passed).toBe(true);
  });

  it("passed=true when no --no-direct-launchdarkly flag even with usages", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation" }]),
      {}
    );
    expect(result.passed).toBe(true);
  });
});

// ── formatValidationReport ───────────────────────────────────────────────────

describe("formatValidationReport", () => {
  it("without --no-direct-launchdarkly, prints scanned count summary", () => {
    const result = validateScanResult(makeScanResult([{ callType: "boolVariation" }], 5), {});
    const report = formatValidationReport(result, {});
    expect(report).toContain("Scanned 5 file(s)");
    expect(report).toContain("Found 1 LaunchDarkly usage(s)");
  });

  it("pass message contains success indicator", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("✓");
    expect(report).toContain("no direct LaunchDarkly evaluation calls found");
  });

  it("pass message includes scanned file count", () => {
    const result = validateScanResult(makeScanResult([], 8), { noDirectLaunchDarkly: true });
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("8 file(s)");
  });

  it("failure report shows violation count", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation" }, { callType: "stringVariation" }]),
      { noDirectLaunchDarkly: true }
    );
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("✗");
    expect(report).toContain("2 direct LaunchDarkly evaluation call(s)");
  });

  it("failure report lists each violation with file:line:col", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/service.ts", line: 42, column: 8, callType: "boolVariation", flagKey: "my-flag" }]),
      { noDirectLaunchDarkly: true }
    );
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("src/service.ts:42:8");
    expect(report).toContain("boolVariation");
    expect(report).toContain('"my-flag"');
  });

  it("marks dynamic key violation with indicator", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "dyn", isDynamic: true }]),
      { noDirectLaunchDarkly: true }
    );
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("dynamic key");
    expect(report).toContain("manual review");
  });

  it("marks bulk inventory call with indicator", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "allFlags", flagKey: "*" }]),
      { noDirectLaunchDarkly: true }
    );
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("bulk inventory");
  });

  it("failure report directs user to --dry-run", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation" }]),
      { noDirectLaunchDarkly: true }
    );
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("flaglint migrate --dry-run");
  });

  it("failure report directs user to migrate", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation" }]),
      { noDirectLaunchDarkly: true }
    );
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).toContain("migrate to OpenFeature");
  });

  it("does NOT mention stale flags or safe-to-delete", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation" }]),
      { noDirectLaunchDarkly: true }
    );
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).not.toMatch(/stale/i);
    expect(report).not.toMatch(/safe.to.delete/i);
    expect(report).not.toMatch(/cleanup/i);
  });

  it("does NOT mention stale flags in pass message", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    const report = formatValidationReport(result, { noDirectLaunchDarkly: true });
    expect(report).not.toMatch(/stale/i);
    expect(report).not.toMatch(/safe.to.delete/i);
  });
});

// ── formatValidationSarif ─────────────────────────────────────────────────────

describe("formatValidationSarif — structure", () => {
  const SCAN_ROOT = "/project";
  const SCANNED_AT = "2026-05-25T10:00:00.000Z";

  it("produces valid parseable JSON", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    const output = formatValidationSarif(result, SCAN_ROOT, SCANNED_AT);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("emits SARIF version 2.1.0", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    const parsed = JSON.parse(formatValidationSarif(result, SCAN_ROOT, SCANNED_AT)) as {
      version: string;
    };
    expect(parsed.version).toBe("2.1.0");
  });

  it("names the tool FlagLint", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    const parsed = JSON.parse(formatValidationSarif(result, SCAN_ROOT, SCANNED_AT)) as {
      runs: Array<{ tool: { driver: { name: string } } }>;
    };
    expect(parsed.runs[0]?.tool.driver.name).toBe("FlagLint");
  });

  it("declares the flaglint.direct-launchdarkly rule", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    const parsed = JSON.parse(formatValidationSarif(result, SCAN_ROOT, SCANNED_AT)) as {
      runs: Array<{ tool: { driver: { rules: Array<{ id: string }> } } }>;
    };
    const ruleIds = parsed.runs[0]!.tool.driver.rules.map((r) => r.id);
    expect(ruleIds).toContain("flaglint.direct-launchdarkly");
  });

  it("emits zero results when there are no violations (passed)", () => {
    const result = validateScanResult(makeScanResult([]), { noDirectLaunchDarkly: true });
    const parsed = JSON.parse(formatValidationSarif(result, SCAN_ROOT, SCANNED_AT)) as {
      runs: Array<{ results: unknown[] }>;
    };
    expect(parsed.runs[0]?.results).toHaveLength(0);
  });

  it("includes invocation metadata with scanned file count and violation count", () => {
    const result = validateScanResult(makeScanResult([{ callType: "boolVariation" }]), {
      noDirectLaunchDarkly: true,
    });
    const parsed = JSON.parse(formatValidationSarif(result, SCAN_ROOT, SCANNED_AT)) as {
      runs: Array<{
        invocations: Array<{
          executionSuccessful: boolean;
          startTimeUtc: string;
          properties: { scannedFiles: number; violations: number };
        }>;
      }>;
    };
    const invocation = parsed.runs[0]!.invocations[0]!;
    expect(invocation.executionSuccessful).toBe(true);
    expect(invocation.startTimeUtc).toBe(SCANNED_AT);
    expect(invocation.properties.scannedFiles).toBe(3);
    expect(invocation.properties.violations).toBe(1);
  });
});

describe("formatValidationSarif — violation results", () => {
  const SCAN_ROOT = "/project";
  const SCANNED_AT = "2026-05-25T10:00:00.000Z";

  type SarifResult = {
    ruleId: string;
    level: string;
    message: { text: string };
    locations: Array<{
      physicalLocation: {
        artifactLocation: { uri: string; uriBaseId: string };
        region: { startLine: number; startColumn: number };
      };
    }>;
    partialFingerprints: { "flagKey/v1": string };
    properties: { flagKey: string; callType: string; isDynamic: boolean };
  };

  function parseSarif(result: ValidationResult) {
    return JSON.parse(formatValidationSarif(result, SCAN_ROOT, SCANNED_AT)) as {
      runs: Array<{ results: SarifResult[] }>;
    };
  }

  it("emits one SARIF result per violation", () => {
    const result = validateScanResult(
      makeScanResult([
        { file: "src/a.ts", callType: "boolVariation", flagKey: "flag-a" },
        { file: "src/b.ts", callType: "stringVariation", flagKey: "flag-b" },
      ]),
      { noDirectLaunchDarkly: true }
    );
    const parsed = parseSarif(result);
    expect(parsed.runs[0]!.results).toHaveLength(2);
  });

  it("each result has ruleId flaglint.direct-launchdarkly", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.ruleId).toBe("flaglint.direct-launchdarkly");
  });

  it("each result has level error (not warning) for policy enforcement", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.level).toBe("error");
  });

  it("result message contains file path", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/services/checkout.ts", callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.message.text).toContain("src/services/checkout.ts");
  });

  it("result message contains flag key", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.message.text).toContain("checkout-v2");
  });

  it("result message is actionable — directs user to flaglint migrate --dry-run", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.message.text).toContain("flaglint migrate --dry-run");
  });

  it("physicalLocation uri contains the file path", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/services/checkout.ts", callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.locations[0]!.physicalLocation.artifactLocation.uri).toContain("src/services/checkout.ts");
  });

  it("physicalLocation uriBaseId is %SRCROOT%", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/services/checkout.ts", callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.locations[0]!.physicalLocation.artifactLocation.uriBaseId).toBe("%SRCROOT%");
  });

  it("region contains correct line number", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/checkout.ts", line: 42, column: 8, callType: "boolVariation", flagKey: "f" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.locations[0]!.physicalLocation.region.startLine).toBe(42);
  });

  it("region startColumn is 1-based (column + 1)", () => {
    const result = validateScanResult(
      makeScanResult([{ file: "src/checkout.ts", line: 42, column: 8, callType: "boolVariation", flagKey: "f" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.locations[0]!.physicalLocation.region.startColumn).toBe(9);
  });

  it("partialFingerprints contain the flagKey", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "checkout-v2" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.partialFingerprints["flagKey/v1"]).toBe("checkout-v2");
  });

  it("properties include flagKey and callType", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "stringVariation", flagKey: "color-theme" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.properties.flagKey).toBe("color-theme");
    expect(finding.properties.callType).toBe("stringVariation");
  });

  it("dynamic key violation message mentions dynamic key", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "boolVariation", flagKey: "dynamic-key", isDynamic: true }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.message.text).toContain("dynamic");
    expect(finding.properties.isDynamic).toBe(true);
  });

  it("bulk call (flagKey=*) violation message mentions bulk inventory", () => {
    const result = validateScanResult(
      makeScanResult([{ callType: "allFlags", flagKey: "*" }]),
      { noDirectLaunchDarkly: true }
    );
    const finding = parseSarif(result).runs[0]!.results[0]!;
    expect(finding.message.text).toContain("bulk inventory");
  });

  it("violations excluded by bootstrapExclude do not appear in SARIF", () => {
    const result = validateScanResult(
      makeScanResult([
        { file: "src/platform/feature-flags.ts", callType: "boolVariation", flagKey: "provider-init" },
        { file: "src/services/checkout.ts", callType: "boolVariation", flagKey: "checkout-v2" },
      ]),
      {
        noDirectLaunchDarkly: true,
        bootstrapExclude: ["src/platform/feature-flags.ts"],
      }
    );
    const parsed = parseSarif(result);
    expect(parsed.runs[0]!.results).toHaveLength(1);
    expect(parsed.runs[0]!.results[0]!.properties.flagKey).toBe("checkout-v2");
  });
});
