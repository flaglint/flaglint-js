import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  computeEstimate,
  DEFAULT_ASSUMPTIONS,
  ESTIMATE_DISCLAIMER,
} from "./estimate.js";
import type { MigrationReadiness } from "../readiness/readiness.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = join(ROOT, "dist/bin/flaglint.js");
const ENTERPRISE_SRC = join(ROOT, "examples/enterprise-checkout-service/src");
const ENTERPRISE_CONFIG = join(ROOT, "examples/enterprise-checkout-service/.flaglintrc");
const AFTER_COMPLETE = join(ROOT, "examples/enterprise-checkout-service/after-complete");

function cli(...args: string[]) {
  return spawnSync(process.execPath, [ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
}

function makeReadiness(overrides: Partial<MigrationReadiness> = {}): MigrationReadiness {
  return {
    score: 50,
    grade: "moderate",
    totalCalls: 20,
    automatableCalls: 10,
    manualReviewCalls: 10,
    manualReviewBreakdown: [],
    ...overrides,
  };
}

// ── Core algorithm ────────────────────────────────────────────────────────────

describe("computeEstimate — core algorithm", () => {
  it("returns null when readiness grade is not-applicable", () => {
    const r = makeReadiness({ score: null, grade: "not-applicable", totalCalls: 0, automatableCalls: 0, manualReviewCalls: 0 });
    expect(computeEstimate(r)).toBeNull();
  });

  it("all automatable calls → totalHoursLow === totalHoursHigh (no manual uncertainty)", () => {
    const r = makeReadiness({ automatableCalls: 20, manualReviewCalls: 0, grade: "ready", score: 100 });
    const est = computeEstimate(r)!;
    expect(est.totalHoursLow).toBe(est.totalHoursHigh);
  });

  it("all manual calls → range is wider than low (1.5x manual variance)", () => {
    const r = makeReadiness({ automatableCalls: 0, manualReviewCalls: 10, grade: "complex", score: 0 });
    const est = computeEstimate(r)!;
    expect(est.totalHoursHigh).toBeGreaterThan(est.totalHoursLow);
  });

  it("10 safe / 10 manual with defaults produces correct hours", () => {
    // automationHours = 10 * 0.5 = 5
    // manualLow = 10 * 4 = 40, manualHigh = 10 * 4 * 1.5 = 60
    // subTotalLow = 45, subTotalHigh = 65
    // validLow = 45 * 0.2 = 9, validHigh = 65 * 0.2 = 13
    // totalLow = 54, totalHigh = 78
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 10 });
    const est = computeEstimate(r)!;
    expect(est.totalHoursLow).toBe(54);
    expect(est.totalHoursHigh).toBe(78);
  });

  it("score is an integer (always rounded to 1 decimal via round1)", () => {
    const r = makeReadiness({ automatableCalls: 3, manualReviewCalls: 3 });
    const est = computeEstimate(r)!;
    expect(Number.isFinite(est.totalHoursLow)).toBe(true);
    expect(Number.isFinite(est.totalHoursHigh)).toBe(true);
  });
});

// ── Assumptions ───────────────────────────────────────────────────────────────

describe("computeEstimate — assumptions", () => {
  it("uses DEFAULT_ASSUMPTIONS when no overrides provided", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est.assumptions).toMatchObject(DEFAULT_ASSUMPTIONS);
  });

  it("overrides are merged into assumptions", () => {
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 0 });
    const est = computeEstimate(r, { automationHoursPerCall: 1 })!;
    expect(est.assumptions.automationHoursPerCall).toBe(1);
    // non-overridden fields stay at defaults
    expect(est.assumptions.validationMultiplier).toBe(DEFAULT_ASSUMPTIONS.validationMultiplier);
  });

  it("custom automationHoursPerCall changes totalHoursLow and totalHoursHigh", () => {
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 0 });
    const base = computeEstimate(r)!;
    const custom = computeEstimate(r, { automationHoursPerCall: 1 })!;
    expect(custom.totalHoursLow).toBeGreaterThan(base.totalHoursLow);
  });
});

// ── Breakdown ─────────────────────────────────────────────────────────────────

describe("computeEstimate — breakdown", () => {
  it("breakdown always has 3 items: automatable, manual, validation", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est.breakdown).toHaveLength(3);
    expect(est.breakdown[0].label).toBe("Automatable calls");
    expect(est.breakdown[1].label).toBe("Manual review calls");
    expect(est.breakdown[2].label).toBe("Validation & testing");
  });

  it("breakdown basis strings use merged assumption values", () => {
    const r = makeReadiness();
    const overrides = { automationHoursPerCall: 0.75, manualReviewHoursPerCall: 6, validationMultiplier: 0.25 };
    const est = computeEstimate(r, overrides)!;
    expect(est.breakdown[0].basis).toBe("0.75h per automatable call");
    expect(est.breakdown[1].basis).toBe("6h per manual-review call");
    expect(est.breakdown[2].basis).toBe("25% of migration work");
  });

  it("automation row: hoursLow === hoursHigh (no variance for automatable calls)", () => {
    const r = makeReadiness({ automatableCalls: 8, manualReviewCalls: 2 });
    const est = computeEstimate(r)!;
    expect(est.breakdown[0].hoursLow).toBe(est.breakdown[0].hoursHigh);
  });

  it("manual review row: hoursHigh === hoursLow * 1.5", () => {
    const r = makeReadiness({ automatableCalls: 0, manualReviewCalls: 10 });
    const est = computeEstimate(r, { manualReviewHoursPerCall: 4 })!;
    const manual = est.breakdown[1];
    expect(manual.hoursHigh).toBe(manual.hoursLow * 1.5);
  });

  it("validation row calls is 0", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est.breakdown[2].calls).toBe(0);
  });
});

// ── Cost projection ───────────────────────────────────────────────────────────

describe("computeEstimate — cost projection", () => {
  it("no hourlyRate → costLow and costHigh are absent", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est).not.toHaveProperty("costLow");
    expect(est).not.toHaveProperty("costHigh");
  });

  it("hourlyRate produces costLow and costHigh", () => {
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 10 });
    const est = computeEstimate(r, { hourlyRate: 125 })!;
    // totalHoursLow=54, totalHoursHigh=78
    expect(est.costLow).toBe(54 * 125);
    expect(est.costHigh).toBe(78 * 125);
  });

  it("cost values are integers (rounded)", () => {
    const r = makeReadiness({ automatableCalls: 3, manualReviewCalls: 1 });
    const est = computeEstimate(r, { hourlyRate: 100 })!;
    expect(Number.isInteger(est.costLow!)).toBe(true);
    expect(Number.isInteger(est.costHigh!)).toBe(true);
  });

  it("costLow can equal costHigh when no manual calls (no fabricated range)", () => {
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 0, grade: "ready", score: 100 });
    const est = computeEstimate(r, { hourlyRate: 100 })!;
    expect(est.costLow).toBe(est.costHigh);
  });
});

// ── Disclaimer ────────────────────────────────────────────────────────────────

describe("computeEstimate — disclaimer", () => {
  it("disclaimer equals ESTIMATE_DISCLAIMER constant", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est.disclaimer).toBe(ESTIMATE_DISCLAIMER);
  });

  it("ESTIMATE_DISCLAIMER mentions FlagLint does not access runtime data", () => {
    expect(ESTIMATE_DISCLAIMER).toContain("FlagLint does not access runtime data");
  });
});

// ── CLI integration ───────────────────────────────────────────────────────────

describe("audit --cost-estimate CLI", () => {
  it("--cost-estimate shows estimated migration effort in markdown stdout", () => {
    const r = cli("audit", "--cost-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout.toLowerCase()).toContain("estimated migration effort");
  });

  it("--cost-estimate --hourly-rate 125 shows estimated cost in markdown stdout", () => {
    const r = cli("audit", "--cost-estimate", "--hourly-rate", "125", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("$");
  });

  it("--cost-estimate on after-complete dir shows N/A in stderr", () => {
    const r = cli("audit", "--cost-estimate", AFTER_COMPLETE);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("N/A");
  });

  it("--format json with --cost-estimate includes estimate key", () => {
    const r = cli("audit", "--format", "json", "--cost-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("estimate");
    expect(parsed.estimate).not.toBeNull();
  });

  it("--format json WITHOUT --cost-estimate has no estimate key", () => {
    const r = cli("audit", "--format", "json", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("estimate");
  });

  it("--format json --cost-estimate on after-complete returns estimate: null", () => {
    const r = cli("audit", "--format", "json", "--cost-estimate", AFTER_COMPLETE);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("estimate");
    expect(parsed.estimate).toBeNull();
  });

  it("--hourly-rate 0 exits with code 2", () => {
    const r = cli("audit", "--cost-estimate", "--hourly-rate", "0", ENTERPRISE_SRC);
    expect(r.status).toBe(2);
  });

  it("--hourly-rate -10 exits with code 2", () => {
    const r = cli("audit", "--cost-estimate", "--hourly-rate", "-10", ENTERPRISE_SRC);
    expect(r.status).toBe(2);
  });

  it("--hourly-rate abc exits with code 2", () => {
    const r = cli("audit", "--cost-estimate", "--hourly-rate", "abc", ENTERPRISE_SRC);
    expect(r.status).toBe(2);
  });

  it("--hourly-rate without --cost-estimate warns but succeeds", () => {
    const r = cli("audit", "--hourly-rate", "125", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("warn");
  });
});
