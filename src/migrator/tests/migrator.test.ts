import { describe, it, expect } from "vitest";
import { analyze, formatMigrationReport } from "../index.js";
import type { FlagUsage, ScanResult } from "../../types.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeUsage(overrides: Partial<FlagUsage>): FlagUsage {
  return {
    flagKey: "my-flag",
    isDynamic: false,
    file: "/src/index.ts",
    line: 1,
    column: 0,
    callType: "variation",
    stalenessSignals: [],
    ...overrides,
  };
}

function makeResult(usages: FlagUsage[]): ScanResult {
  return {
    scannedFiles: 1,
    totalUsages: usages.length,
    uniqueFlags: [
      ...new Set(
        usages.filter((u) => !u.isDynamic && u.flagKey !== "*").map((u) => u.flagKey)
      ),
    ],
    usages,
    scanDurationMs: 5,
    warnings: [],
  };
}

// ── readiness score ───────────────────────────────────────────────────────────

describe("analyze — readinessScore", () => {
  it("scores 100 for a single static variation usage", () => {
    const { readinessScore } = analyze(makeResult([makeUsage({ callType: "variation" })]));
    expect(readinessScore).toBe(100);
  });

  it("deducts 10 per dynamic and 20 for no static keys", () => {
    // 1 dynamic: -min(10,40)=10, no static keys: -20 → 70
    const { readinessScore } = analyze(makeResult([makeUsage({ isDynamic: true })]));
    expect(readinessScore).toBe(70);
  });

  it("caps dynamic deduction at 40", () => {
    // 5 dynamics: -min(50,40)=40, no static keys: -20 → 40
    const usages = Array.from({ length: 5 }, () => makeUsage({ isDynamic: true }));
    const { readinessScore } = analyze(makeResult(usages));
    expect(readinessScore).toBe(40);
  });

  it("deducts 15 for allFlags usage", () => {
    const usages = [
      makeUsage({ callType: "variation" }),
      makeUsage({ callType: "allFlags", flagKey: "*" }),
    ];
    const { readinessScore } = analyze(makeResult(usages));
    expect(readinessScore).toBe(85);
  });

  it("deducts 5 per useFlags hook call", () => {
    const usages = [
      makeUsage({ callType: "variation" }),
      makeUsage({ callType: "hook-useFlags", flagKey: "*" }),
      makeUsage({ callType: "hook-useFlags", flagKey: "*" }),
    ];
    const { readinessScore } = analyze(makeResult(usages));
    expect(readinessScore).toBe(90);
  });

  it("deducts 5 per HOC usage", () => {
    const usages = [
      makeUsage({ callType: "variation" }),
      makeUsage({ callType: "hoc", flagKey: "*" }),
      makeUsage({ callType: "hoc", flagKey: "*" }),
    ];
    const { readinessScore } = analyze(makeResult(usages));
    expect(readinessScore).toBe(90);
  });

  it("clamps score to minimum of 0", () => {
    // 5 dynamics(-40) + no-static(-20) + allFlags(-15) + 6×useFlags(-30) + 4×hoc(-20) = -125 → 0
    const usages = [
      ...Array.from({ length: 5 }, () => makeUsage({ isDynamic: true })),
      makeUsage({ callType: "allFlags", flagKey: "*" }),
      ...Array.from({ length: 6 }, () => makeUsage({ callType: "hook-useFlags", flagKey: "*" })),
      ...Array.from({ length: 4 }, () => makeUsage({ callType: "hoc", flagKey: "*" })),
    ];
    const { readinessScore } = analyze(makeResult(usages));
    expect(readinessScore).toBe(0);
  });
});

// ── required packages ─────────────────────────────────────────────────────────

describe("analyze — requiredPackages", () => {
  it("recommends server-sdk only for server-side usage", () => {
    const { requiredPackages } = analyze(makeResult([makeUsage({ callType: "variation" })]));
    expect(requiredPackages).toEqual(["@openfeature/server-sdk"]);
  });

  it("recommends web-sdk and react-sdk for React-only usage", () => {
    const { requiredPackages } = analyze(
      makeResult([makeUsage({ callType: "hook-useFlags", flagKey: "*" })])
    );
    expect(requiredPackages).toContain("@openfeature/react-sdk");
    expect(requiredPackages).toContain("@openfeature/web-sdk");
    expect(requiredPackages).not.toContain("@openfeature/server-sdk");
  });

  it("recommends all three packages for mixed server + React usage", () => {
    const usages = [
      makeUsage({ callType: "variation" }),
      makeUsage({ callType: "hook-useFlags", flagKey: "*" }),
    ];
    const { requiredPackages } = analyze(makeResult(usages));
    expect(requiredPackages).toContain("@openfeature/server-sdk");
    expect(requiredPackages).toContain("@openfeature/web-sdk");
    expect(requiredPackages).toContain("@openfeature/react-sdk");
  });
});

// ── migration items per callType ──────────────────────────────────────────────

describe("analyze — migration items", () => {
  it("maps variation to getBooleanValue with requiresManualReview: true", () => {
    const { items } = analyze(makeResult([makeUsage({ callType: "variation", flagKey: "my-flag" })]));
    expect(items[0]?.openFeatureEquivalent).toBe("client.getBooleanValue()");
    expect(items[0]?.requiresManualReview).toBe(true);
    expect(items[0]?.codeChangeBefore).toContain("variation");
    expect(items[0]?.codeChangeAfter).toContain("getBooleanValue");
  });

  it("maps variationDetail to getBooleanDetails", () => {
    const { items } = analyze(makeResult([makeUsage({ callType: "variationDetail" })]));
    expect(items[0]?.openFeatureEquivalent).toBe("client.getBooleanDetails()");
    expect(items[0]?.requiresManualReview).toBe(true);
  });

  it("maps allFlags to null openFeatureEquivalent", () => {
    const { items } = analyze(makeResult([makeUsage({ callType: "allFlags", flagKey: "*" })]));
    expect(items[0]?.openFeatureEquivalent).toBeNull();
    expect(items[0]?.requiresManualReview).toBe(true);
  });

  it("maps hook-useLDClient to useOpenFeatureClient with requiresManualReview: false", () => {
    const { items } = analyze(
      makeResult([makeUsage({ callType: "hook-useLDClient", flagKey: "*" })])
    );
    expect(items[0]?.openFeatureEquivalent).toBe("useOpenFeatureClient()");
    expect(items[0]?.requiresManualReview).toBe(false);
  });

  it("maps provider to OpenFeatureProvider with requiresManualReview: false", () => {
    const { items } = analyze(makeResult([makeUsage({ callType: "provider", flagKey: "*" })]));
    expect(items[0]?.openFeatureEquivalent).toBe("OpenFeatureProvider");
    expect(items[0]?.requiresManualReview).toBe(false);
  });

  it("maps hoc to null openFeatureEquivalent with requiresManualReview: true", () => {
    const { items } = analyze(makeResult([makeUsage({ callType: "hoc", flagKey: "*" })]));
    expect(items[0]?.openFeatureEquivalent).toBeNull();
    expect(items[0]?.requiresManualReview).toBe(true);
  });

  it("maps isFeatureEnabled to getBooleanValue", () => {
    const { items } = analyze(makeResult([makeUsage({ callType: "isFeatureEnabled" })]));
    expect(items[0]?.openFeatureEquivalent).toBe("client.getBooleanValue()");
    expect(items[0]?.requiresManualReview).toBe(true);
  });

  it("uses 'flagKey' placeholder in code snippets for dynamic usages", () => {
    const { items } = analyze(makeResult([makeUsage({ isDynamic: true })]));
    expect(items[0]?.codeChangeBefore).toContain("flagKey");
    expect(items[0]?.requiresManualReview).toBe(true);
  });

  it("dynamic variationDetail gets correct before/after code and openFeatureEquivalent", () => {
    const { items } = analyze(
      makeResult([makeUsage({ isDynamic: true, callType: "variationDetail" })])
    );
    expect(items[0]?.codeChangeBefore).toBe(
      "ldClient.variationDetail(flagKey, context, false)"
    );
    expect(items[0]?.codeChangeAfter).toContain("getBooleanDetails");
    expect(items[0]?.openFeatureEquivalent).toBe("client.getBooleanDetails()");
    expect(items[0]?.requiresManualReview).toBe(true);
  });

  it("dynamic variation (non-detail) still gets variation before code", () => {
    const { items } = analyze(
      makeResult([makeUsage({ isDynamic: true, callType: "variation" })])
    );
    expect(items[0]?.codeChangeBefore).toBe(
      "ldClient.variation(flagKey, context, false)"
    );
    expect(items[0]?.openFeatureEquivalent).toBe("client.getBooleanValue()");
  });

  it("sets manualReviewCount and autoMigrateCount correctly", () => {
    const usages = [
      makeUsage({ callType: "variation" }),
      makeUsage({ callType: "provider", flagKey: "*" }),
      makeUsage({ callType: "hook-useLDClient", flagKey: "*" }),
    ];
    const { manualReviewCount, autoMigrateCount } = analyze(makeResult(usages));
    expect(manualReviewCount).toBe(1);
    expect(autoMigrateCount).toBe(2);
  });
});

// ── formatMigrationReport ─────────────────────────────────────────────────────

describe("formatMigrationReport", () => {
  it("contains the migration readiness score", () => {
    const analysis = analyze(makeResult([makeUsage({ callType: "variation" })]));
    const report = formatMigrationReport(analysis);
    expect(report).toContain("100");
    expect(report).toContain("Migration Readiness Score");
  });

  it("contains the npm install command for required packages", () => {
    const analysis = analyze(makeResult([makeUsage({ callType: "variation" })]));
    const report = formatMigrationReport(analysis);
    expect(report).toContain("npm install");
    expect(report).toContain("@openfeature/server-sdk");
  });

  it("contains before/after code blocks for provider migration", () => {
    const analysis = analyze(makeResult([makeUsage({ callType: "provider", flagKey: "*" })]));
    const report = formatMigrationReport(analysis);
    expect(report).toContain("LDProvider");
    expect(report).toContain("OpenFeatureProvider");
  });

  it("includes step-by-step checklist", () => {
    const analysis = analyze(makeResult([makeUsage({ callType: "variation" })]));
    const report = formatMigrationReport(analysis);
    expect(report).toContain("Step-by-Step Checklist");
    expect(report).toContain("- [ ]");
  });

  it("separates manual review items from auto-migratable items", () => {
    const usages = [
      makeUsage({ callType: "variation" }),
      makeUsage({ callType: "provider", flagKey: "*" }),
    ];
    const analysis = analyze(makeResult(usages));
    const report = formatMigrationReport(analysis);
    expect(report).toContain("Manual Review Required");
    expect(report).toContain("Code Changes Required");
  });
});
