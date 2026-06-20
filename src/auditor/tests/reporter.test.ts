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

describe("coverage — low-risk flags", () => {
  function makeReportWithLowRisk(): AuditReport {
    return makeReport({
      summary: {
        ...makeReport().summary,
        lowRisk: 1,
        totalFlags: 3,
      },
      flags: [
        ...makeReport().flags,
        {
          flagKey: "old-feature",
          riskLevel: "low",
          displayTier: "low",
          riskReasons: [],
          callTypes: ["boolVariation"],
          fileCount: 1,
          usageCount: 1,
          safelyAutomatable: true,
          hasStaleSignal: false,
          isDynamic: false,
          files: ["src/old.ts"],
        },
      ],
    });
  }

  it("markdown summary table includes Low Risk column when lowRisk > 0", () => {
    const md = formatAuditMarkdown(makeReportWithLowRisk());
    expect(md).toContain("Low Risk");
    expect(md).toContain("🟢 Low");
  });

  it("HTML shows low badge for low-risk flags", () => {
    const html = formatAuditHtml(makeReportWithLowRisk());
    expect(html).toContain("badge-low");
    expect(html).toContain("Low</span>");
  });

  it("HTML shows Low Risk card when lowRisk > 0", () => {
    const html = formatAuditHtml(makeReportWithLowRisk());
    expect(html).toContain("Low Risk");
  });
});

describe("coverage — estimate options", () => {
  const mockEstimate = {
    hoursLow: 4,
    hoursHigh: 8,
    breakdown: [
      { label: "Automatable calls", calls: 2, hoursLow: 2, hoursHigh: 4, basis: "0.5h–1h per call" },
      { label: "Manual review calls", calls: 1, hoursLow: 2, hoursHigh: 4, basis: "2h–4h per call" },
    ],
    disclaimer: "Directional estimate only.",
    assumptions: {
      automationHoursPerCall: 0.75,
      manualReviewHoursPerCall: 3,
      validationMultiplier: 0.1,
      minimumHours: 2,
    },
  };

  it("JSON includes estimate key when options.estimate is provided", () => {
    const json = JSON.parse(formatAuditJson(makeReport(), { estimate: mockEstimate }));
    expect(json.estimate).toBeDefined();
    expect(json.estimate.hoursLow).toBe(4);
  });

  it("JSON estimate is null when options.estimate is null", () => {
    const json = JSON.parse(formatAuditJson(makeReport(), { estimate: null }));
    expect(json.estimate).toBeNull();
  });

  it("markdown includes effort estimate section when estimate is provided", () => {
    const md = formatAuditMarkdown(makeReport(), { estimate: mockEstimate });
    expect(md).toContain("Estimated Migration Effort");
    expect(md).toContain("4h");
    expect(md).toContain("Directional estimate only.");
  });

  it("markdown shows N/A when estimate is null", () => {
    const md = formatAuditMarkdown(makeReport(), { estimate: null });
    expect(md).toContain("Estimated Migration Effort");
    expect(md).toContain("N/A");
  });

  it("markdown shows cost line when costLow/costHigh are present", () => {
    const withCost = { ...mockEstimate, costLow: 500, costHigh: 1000, hourlyRate: 125 };
    const md = formatAuditMarkdown(makeReport(), { estimate: withCost });
    expect(md).toContain("$500");
    expect(md).toContain("$1,000");
  });

  it("HTML includes estimate section when estimate is provided", () => {
    const html = formatAuditHtml(makeReport(), { estimate: mockEstimate });
    expect(html).toContain("Estimated Migration Effort");
    expect(html).toContain("estimate-total");
    expect(html).toContain("4h");
  });

  it("HTML estimate shows N/A when estimate is null", () => {
    const html = formatAuditHtml(makeReport(), { estimate: null });
    expect(html).toContain("Estimated Migration Effort");
    expect(html).toContain("N/A");
  });
});

describe("coverage — manualReviewBreakdown", () => {
  it("HTML renders breakdown table when manualReviewBreakdown has entries", () => {
    const report = makeReport({
      readiness: {
        score: 50,
        grade: "moderate",
        totalCalls: 4,
        automatableCalls: 2,
        manualReviewCalls: 2,
        manualReviewBreakdown: [
          { code: "dynamic-key", label: "Dynamic key", count: 1, explanation: "Flag key is not statically resolvable" },
          { code: "detail-evaluation", label: "Detail evaluation", count: 1, explanation: "Returns metadata without OF equivalent" },
        ],
      },
    });
    const html = formatAuditHtml(report);
    expect(html).toContain("Dynamic key");
    expect(html).toContain("Detail evaluation");
    expect(html).toContain("Flag key is not statically resolvable");
  });
});
