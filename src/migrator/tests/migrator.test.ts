import { describe, it, expect } from "vitest";
import { analyze, formatMigrationReport } from "../index.js";
import type { FlagUsage, MigrationInventoryItem, ScanResult } from "../../types.js";

function makeInventory(overrides: Partial<MigrationInventoryItem>): MigrationInventoryItem {
  return {
    file: "src/checkout.ts",
    line: 10,
    column: 20,
    launchDarklyMethod: "boolVariation",
    flagKeyExpression: "\"checkout-enabled\"",
    staticFlagKey: "checkout-enabled",
    isDynamic: false,
    valueType: "boolean",
    fallbackExpression: "false",
    evaluationContextExpression: "context",
    safelyAutomatable: true,
    ...overrides,
  };
}

function makeUsage(overrides: Partial<FlagUsage>): FlagUsage {
  return {
    flagKey: "legacy-flag",
    isDynamic: false,
    file: "src/legacy.ts",
    line: 3,
    column: 4,
    callType: "variation",
    stalenessSignals: [],
    ...overrides,
  };
}

function makeResult(migrationInventory: MigrationInventoryItem[]): ScanResult {
  return {
    scannedAt: "2026-05-23T06:00:00.000Z",
    scanRoot: "/repo",
    scannedFiles: 1,
    totalUsages: migrationInventory.length,
    uniqueFlags: [
      ...new Set(
        migrationInventory
          .filter((item) => !item.isDynamic && item.staticFlagKey)
          .map((item) => item.staticFlagKey!)
      ),
    ],
    usages: migrationInventory.map((item) => ({
      flagKey: item.staticFlagKey ?? (item.isDynamic ? "dynamic" : "*"),
      isDynamic: item.isDynamic,
      file: item.file,
      line: item.line,
      column: item.column,
      callType: item.launchDarklyMethod,
      stalenessSignals: [],
    })),
    migrationInventory,
    scanDurationMs: 5,
    warnings: [],
  };
}

function makeLegacyResult(usages: FlagUsage[]): ScanResult {
  return {
    scannedAt: "2026-05-23T06:00:00.000Z",
    scanRoot: "/repo",
    scannedFiles: 1,
    totalUsages: usages.length,
    uniqueFlags: [
      ...new Set(
        usages.filter((usage) => !usage.isDynamic && usage.flagKey !== "*").map((usage) => usage.flagKey)
      ),
    ],
    usages,
    scanDurationMs: 5,
    warnings: [],
  };
}

describe("analyze — migration inventory evidence", () => {
  it("counts total LaunchDarkly usages, safe usages, and manual-review categories", () => {
    const analysis = analyze(
      makeResult([
        makeInventory({ staticFlagKey: "safe-bool", flagKeyExpression: "\"safe-bool\"" }),
        makeInventory({
          staticFlagKey: undefined,
          flagKeyExpression: "flagKey",
          isDynamic: true,
          safelyAutomatable: false,
          manualReviewReason: "dynamic-key",
        }),
        makeInventory({
          launchDarklyMethod: "variation",
          staticFlagKey: "unknown-fallback",
          flagKeyExpression: "\"unknown-fallback\"",
          valueType: "unknown",
          fallbackExpression: "fallbackFromConfig",
          safelyAutomatable: false,
          manualReviewReason: "unknown-fallback",
        }),
        makeInventory({
          launchDarklyMethod: "allFlagsState",
          staticFlagKey: undefined,
          flagKeyExpression: undefined,
          valueType: "unknown",
          fallbackExpression: undefined,
          safelyAutomatable: false,
          manualReviewReason: "bulk-inventory-call",
        }),
      ])
    );

    expect(analysis.totalLaunchDarklyUsages).toBe(4);
    expect(analysis.safelyAutomatableCount).toBe(1);
    expect(analysis.manualReviewCount).toBe(3);
    expect(analysis.dynamicKeyCount).toBe(1);
    expect(analysis.bulkInventoryCallCount).toBe(1);
    expect(analysis.unsupportedUnknownCount).toBe(1);
  });

  it("sets manualReviewCount and autoMigrateCount from inventory safety", () => {
    const analysis = analyze(
      makeResult([
        makeInventory({}),
        makeInventory({ staticFlagKey: "safe-two", flagKeyExpression: "\"safe-two\"" }),
        makeInventory({
          staticFlagKey: undefined,
          flagKeyExpression: "flagKey",
          isDynamic: true,
          safelyAutomatable: false,
          manualReviewReason: "dynamic-key",
        }),
      ])
    );

    expect(analysis.autoMigrateCount).toBe(2);
    expect(analysis.manualReviewCount).toBe(1);
  });

  it("preserves inventory items for reporting", () => {
    const input = [
      makeInventory({ staticFlagKey: "first", flagKeyExpression: "\"first\"" }),
      makeInventory({ staticFlagKey: "second", flagKeyExpression: "\"second\"" }),
    ];

    expect(analyze(makeResult(input)).inventoryItems).toEqual(input);
  });

  it("recommends the OpenFeature server SDK for server-side inventory", () => {
    expect(analyze(makeResult([makeInventory({})])).requiredPackages).toEqual(["@openfeature/server-sdk"]);
  });

  it("does not recommend packages when no LaunchDarkly inventory exists", () => {
    expect(analyze(makeResult([])).requiredPackages).toEqual([]);
  });

  it("treats legacy static ScanResult usages without migrationInventory as manual review", () => {
    const analysis = analyze(makeLegacyResult([makeUsage({ callType: "variation", flagKey: "legacy-static" })]));

    expect(analysis.totalLaunchDarklyUsages).toBe(1);
    expect(analysis.unsupportedUnknownCount).toBe(1);
    expect(analysis.manualReviewCount).toBe(1);
  });

  it("treats legacy dynamic ScanResult usages as dynamic manual review", () => {
    const analysis = analyze(makeLegacyResult([makeUsage({ isDynamic: true, flagKey: "dynamic" })]));

    expect(analysis.dynamicKeyCount).toBe(1);
    expect(analysis.items[0]?.requiresManualReview).toBe(true);
  });

  it("treats legacy allFlags ScanResult usages as bulk manual review", () => {
    const analysis = analyze(makeLegacyResult([makeUsage({ callType: "allFlags", flagKey: "*" })]));

    expect(analysis.bulkInventoryCallCount).toBe(1);
    expect(analysis.items[0]?.reviewReason).toBe("bulk inventory call");
  });
});

describe("analyze — migration items", () => {
  it("maps boolean inventory to getBooleanValue", () => {
    expect(analyze(makeResult([makeInventory({ valueType: "boolean" })])).items[0]).toMatchObject({
      openFeatureEquivalent: "client.getBooleanValue()",
      requiresManualReview: false,
    });
  });

  it("maps string inventory to getStringValue", () => {
    expect(analyze(makeResult([makeInventory({ valueType: "string" })])).items[0]).toMatchObject({
      openFeatureEquivalent: "client.getStringValue()",
      requiresManualReview: false,
    });
  });

  it("maps number inventory to getNumberValue", () => {
    expect(analyze(makeResult([makeInventory({ valueType: "number" })])).items[0]).toMatchObject({
      openFeatureEquivalent: "client.getNumberValue()",
      requiresManualReview: false,
    });
  });

  it("maps object inventory to getObjectValue", () => {
    expect(analyze(makeResult([makeInventory({ valueType: "object" })])).items[0]).toMatchObject({
      openFeatureEquivalent: "client.getObjectValue()",
      requiresManualReview: false,
    });
  });

  it("does not emit codemod output for otherwise automatable inventory", () => {
    expect(analyze(makeResult([makeInventory({})])).items[0]?.codeChangeAfter).toBe(
      "// No codemod generated by this report"
    );
  });

  it("marks dynamic keys as manual review with no OpenFeature equivalent", () => {
    expect(
      analyze(
        makeResult([
          makeInventory({
            staticFlagKey: undefined,
            flagKeyExpression: "flagKey",
            isDynamic: true,
            safelyAutomatable: false,
            manualReviewReason: "dynamic-key",
          }),
        ])
      ).items[0]
    ).toMatchObject({
      openFeatureEquivalent: null,
      requiresManualReview: true,
      reviewReason: "dynamic key",
    });
  });

  it("marks unknown fallbacks as manual review with no OpenFeature equivalent", () => {
    expect(
      analyze(
        makeResult([
          makeInventory({
            launchDarklyMethod: "variationDetail",
            staticFlagKey: "unknown-detail",
            valueType: "unknown",
            fallbackExpression: "fallbackFromConfig",
            safelyAutomatable: false,
            manualReviewReason: "unknown-fallback",
          }),
        ])
      ).items[0]
    ).toMatchObject({
      openFeatureEquivalent: null,
      requiresManualReview: true,
      reviewReason: "unsupported or unknown fallback",
    });
  });

  it("marks allFlags as bulk manual review", () => {
    expect(
      analyze(
        makeResult([
          makeInventory({
            launchDarklyMethod: "allFlags",
            staticFlagKey: undefined,
            flagKeyExpression: undefined,
            safelyAutomatable: false,
            manualReviewReason: "bulk-inventory-call",
          }),
        ])
      ).items[0]
    ).toMatchObject({
      openFeatureEquivalent: null,
      requiresManualReview: true,
      reviewReason: "bulk inventory call",
    });
  });

  it("marks allFlagsState as bulk manual review", () => {
    expect(
      analyze(
        makeResult([
          makeInventory({
            launchDarklyMethod: "allFlagsState",
            staticFlagKey: undefined,
            flagKeyExpression: undefined,
            safelyAutomatable: false,
            manualReviewReason: "bulk-inventory-call",
          }),
        ])
      ).items[0]
    ).toMatchObject({
      openFeatureEquivalent: null,
      requiresManualReview: true,
      reviewReason: "bulk inventory call",
    });
  });

  it("preserves source evidence in codeChangeBefore for audit consumers", () => {
    expect(
      analyze(
        makeResult([
          makeInventory({
            launchDarklyMethod: "stringVariation",
            flagKeyExpression: "\"pricing-tier\"",
            evaluationContextExpression: "orgContext",
            fallbackExpression: "\"standard\"",
          }),
        ])
      ).items[0]?.codeChangeBefore
    ).toBe("stringVariation(\"pricing-tier\", orgContext, \"standard\")");
  });
});

describe("formatMigrationReport", () => {
  it("prints a truthful evidence summary", () => {
    const report = formatMigrationReport(
      analyze(
        makeResult([
          makeInventory({ staticFlagKey: "checkout-enabled", flagKeyExpression: "\"checkout-enabled\"" }),
          makeInventory({
            staticFlagKey: undefined,
            flagKeyExpression: "flagKey",
            isDynamic: true,
            safelyAutomatable: false,
            manualReviewReason: "dynamic-key",
          }),
        ])
      )
    );

    expect(report).toContain("OpenFeature Migration Inventory");
    expect(report).toContain("Total LaunchDarkly usages found:** 2");
    expect(report).toContain("Safely automatable usages:** 1");
    expect(report).toContain("Manual review required:** 1");
    expect(report).toContain("Dynamic keys:** 1");
  });

  it("does not print readiness score or ready-to-migrate claims", () => {
    const report = formatMigrationReport(analyze(makeResult([makeInventory({})])));

    expect(report).not.toContain("Migration Readiness Score");
    expect(report).not.toContain("ready for migration");
    expect(report).not.toContain("safe to migrate");
  });

  it("prints a manual-review warning when manual review exists", () => {
    const report = formatMigrationReport(
      analyze(
        makeResult([
          makeInventory({
            staticFlagKey: undefined,
            flagKeyExpression: "flagKey",
            isDynamic: true,
            safelyAutomatable: false,
            manualReviewReason: "dynamic-key",
          }),
        ])
      )
    );

    expect(report).toContain("This report is an inventory, not a codemod");
    expect(report).toContain("Manual-review items must be resolved");
  });

  it("omits the manual-review warning when all items are safely automatable", () => {
    const report = formatMigrationReport(analyze(makeResult([makeInventory({})])));

    expect(report).not.toContain("Manual-review items must be resolved");
  });

  it("contains the npm install command for required packages", () => {
    const report = formatMigrationReport(analyze(makeResult([makeInventory({})])));

    expect(report).toContain("npm install");
    expect(report).toContain("@openfeature/server-sdk");
  });

  it("prints safe inventory with file, line, column, method, type, context, and fallback", () => {
    const report = formatMigrationReport(
      analyze(
        makeResult([
          makeInventory({
            file: "src/pricing.ts",
            line: 42,
            column: 13,
            launchDarklyMethod: "stringVariation",
            staticFlagKey: "pricing-tier",
            flagKeyExpression: "\"pricing-tier\"",
            valueType: "string",
            fallbackExpression: "\"standard\"",
            evaluationContextExpression: "orgContext",
          }),
        ])
      )
    );

    expect(report).toContain("src/pricing.ts:42:13");
    expect(report).toContain("`pricing-tier` via `stringVariation` (string)");
    expect(report).toContain("context: `orgContext`; fallback: `\"standard\"`");
  });

  it("prints manual-review reason labels for dynamic, unknown, and bulk cases", () => {
    const report = formatMigrationReport(
      analyze(
        makeResult([
          makeInventory({
            staticFlagKey: undefined,
            flagKeyExpression: "flagKey",
            isDynamic: true,
            safelyAutomatable: false,
            manualReviewReason: "dynamic-key",
          }),
          makeInventory({
            staticFlagKey: "unknown",
            valueType: "unknown",
            safelyAutomatable: false,
            manualReviewReason: "unknown-fallback",
          }),
          makeInventory({
            launchDarklyMethod: "allFlagsState",
            staticFlagKey: undefined,
            flagKeyExpression: undefined,
            safelyAutomatable: false,
            manualReviewReason: "bulk-inventory-call",
          }),
        ])
      )
    );

    expect(report).toContain("dynamic key");
    expect(report).toContain("unsupported or unknown fallback");
    expect(report).toContain("bulk inventory call");
  });

  it("does not print before/after codemod sections", () => {
    const report = formatMigrationReport(analyze(makeResult([makeInventory({})])));

    expect(report).not.toContain("**Before:**");
    expect(report).not.toContain("**After:**");
    expect(report).not.toContain("Code Changes Required");
  });

  it("manual-review cases prevent full-automation language", () => {
    const report = formatMigrationReport(
      analyze(
        makeResult([
          makeInventory({}),
          makeInventory({
            staticFlagKey: undefined,
            flagKeyExpression: "flagKey",
            isDynamic: true,
            safelyAutomatable: false,
            manualReviewReason: "dynamic-key",
          }),
        ])
      )
    );

    expect(report).toContain("Manual review required:** 1");
    expect(report).not.toContain("fully automatable");
    expect(report).not.toContain("100% ready");
    expect(report).not.toContain("safe to migrate");
  });
});
