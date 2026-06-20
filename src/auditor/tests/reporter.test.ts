import { describe, it, expect } from "vitest";
import type { AuditReport } from "../index.js";
import { formatAuditMarkdown, formatAuditHtml, formatAuditJson } from "../reporter.js";

function makeReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    summary: {
      totalFlags: 2,
      highRisk: 0,
      mediumRisk: 1,
      lowRisk: 0,
      automatableFlags: 1,
      totalUsages: 3,
      dynamicKeys: 0,
      detailEvaluations: 0,
      bulkCalls: 0,
      wrapperUsages: 0,
      staleSignals: 0,
      safelyAutomatable: 2,
      manualReview: 1,
      scannedFiles: 5,
      scanDurationMs: 42,
      scannedAt: "2026-06-20T00:00:00.000Z",
      scanRoot: "/project",
      stalenessNote: "No staleness signals detected. Heuristics checked: keyword match, path pattern, minFileCount threshold.",
    },
    flags: [
      {
        flagKey: "checkout-v2",
        riskLevel: "medium",
        displayTier: "automatable",
        riskReasons: ["safely automatable"],
        callTypes: ["boolVariation"],
        fileCount: 1,
        usageCount: 2,
        safelyAutomatable: true,
        hasStaleSignal: false,
        isDynamic: false,
        files: ["src/checkout.ts"],
      },
      {
        flagKey: "dark-mode",
        riskLevel: "medium",
        displayTier: "medium",
        riskReasons: ["safely automatable", "json variation"],
        callTypes: ["jsonVariation"],
        fileCount: 1,
        usageCount: 1,
        safelyAutomatable: true,
        hasStaleSignal: false,
        isDynamic: false,
        files: ["src/theme.ts"],
      },
    ],
    readiness: {
      score: 67,
      grade: "moderate",
      totalCalls: 3,
      automatableCalls: 2,
      manualReviewCalls: 1,
      manualReviewBreakdown: [],
    },
    ...overrides,
  };
}

describe("Fix 1 — displayTier: automatable", () => {
  it("markdown shows 🟢 Automatable for displayTier=automatable", () => {
    const md = formatAuditMarkdown(makeReport());
    expect(md).toContain("🟢 Automatable");
    expect(md).not.toContain("🟡 Medium | 2 | 1"); // automatable row must not use Medium label
  });

  it("markdown still shows 🟡 Medium for medium flags with multiple reasons", () => {
    const md = formatAuditMarkdown(makeReport());
    expect(md).toContain("🟡 Medium");
  });

  it("HTML contains badge-automatable for displayTier=automatable", () => {
    const html = formatAuditHtml(makeReport());
    expect(html).toContain("badge-automatable");
    expect(html).toContain("Automatable");
  });

  it("JSON includes displayTier field on each flag", () => {
    const json = JSON.parse(formatAuditJson(makeReport()));
    const automatableFlag = json.flags.find((f: { flagKey: string }) => f.flagKey === "checkout-v2");
    expect(automatableFlag.displayTier).toBe("automatable");
    const mediumFlag = json.flags.find((f: { flagKey: string }) => f.flagKey === "dark-mode");
    expect(mediumFlag.displayTier).toBe("medium");
  });

  it("JSON does not remove or rename existing riskLevel field", () => {
    const json = JSON.parse(formatAuditJson(makeReport()));
    for (const flag of json.flags) {
      expect(flag.riskLevel).toBeDefined();
    }
  });
});

describe("Fix 2 — zero staleness note", () => {
  it("markdown includes staleness note when staleSignals === 0", () => {
    const md = formatAuditMarkdown(makeReport());
    expect(md).toContain("Staleness:");
    expect(md).toContain("No staleness signals detected");
  });

  it("HTML includes staleness-note div when staleSignals === 0", () => {
    const html = formatAuditHtml(makeReport());
    expect(html).toContain("staleness-note");
    expect(html).toContain("No staleness signals detected");
  });

  it("JSON includes stalenessNote field when staleSignals === 0", () => {
    const json = JSON.parse(formatAuditJson(makeReport()));
    expect(json.summary.stalenessNote).toBeDefined();
    expect(typeof json.summary.stalenessNote).toBe("string");
  });

  it("no staleness note when staleSignals > 0", () => {
    const report = makeReport();
    report.summary.staleSignals = 3;
    delete report.summary.stalenessNote;
    const md = formatAuditMarkdown(report);
    expect(md).not.toContain("No staleness signals detected");
    const json = JSON.parse(formatAuditJson(report));
    expect(json.summary.stalenessNote).toBeUndefined();
  });
});

describe("AuditSummary — automatableFlags field", () => {
  it("JSON summary includes automatableFlags", () => {
    const json = JSON.parse(formatAuditJson(makeReport()));
    expect(json.summary.automatableFlags).toBe(1);
  });

  it("HTML summary shows Automatable card when automatableFlags > 0", () => {
    const html = formatAuditHtml(makeReport());
    expect(html).toContain("Automatable");
  });
});
