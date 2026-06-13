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

  it("automation carries 1.5x variance — hoursHigh > hoursLow even with no manual calls", () => {
    const r = makeReadiness({ automatableCalls: 20, manualReviewCalls: 0, grade: "ready", score: 100 });
    const est = computeEstimate(r)!;
    expect(est.hoursHigh).toBeGreaterThan(est.hoursLow);
  });

  it("20 automatable / 0 manual with defaults produces correct hours", () => {
    // automationLow=5, automationHigh=7.5
    // validationLow=1.5, validationHigh=2.25
    // rawLow=6.5, rawHigh=9.75 → 9.8
    const r = makeReadiness({ automatableCalls: 20, manualReviewCalls: 0, grade: "ready", score: 100 });
    const est = computeEstimate(r)!;
    expect(est.hoursLow).toBe(6.5);
    expect(est.hoursHigh).toBe(9.8);
  });

  it("0 automatable / 10 manual with defaults produces correct hours", () => {
    // manualLow=15, manualHigh=30
    // validationLow=4.5, validationHigh=9
    // rawLow=19.5, rawHigh=39
    const r = makeReadiness({ automatableCalls: 0, manualReviewCalls: 10, grade: "complex", score: 0 });
    const est = computeEstimate(r)!;
    expect(est.hoursLow).toBe(19.5);
    expect(est.hoursHigh).toBe(39);
  });

  it("10 automatable / 10 manual with defaults produces correct hours", () => {
    // automationLow=2.5, automationHigh=3.75
    // manualLow=15, manualHigh=30
    // validationLow=5.25, validationHigh=10.125
    // rawLow=22.75→22.8, rawHigh=43.875→43.9
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 10 });
    const est = computeEstimate(r)!;
    expect(est.hoursLow).toBe(22.8);
    expect(est.hoursHigh).toBe(43.9);
  });

  it("minimumHours floors both totals when call count is very small", () => {
    // 1 automatable call: rawLow≈0.3, rawHigh≈0.5 — both below minimumHours=4
    const r = makeReadiness({ automatableCalls: 1, manualReviewCalls: 0, grade: "ready", score: 100 });
    const est = computeEstimate(r)!;
    expect(est.hoursLow).toBe(4);
    expect(est.hoursHigh).toBe(4);
  });

  it("minimumHours only floors — does not cap large estimates", () => {
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 10 });
    const est = computeEstimate(r)!;
    expect(est.hoursLow).toBeGreaterThan(DEFAULT_ASSUMPTIONS.minimumHours);
    expect(est.hoursHigh).toBeGreaterThan(DEFAULT_ASSUMPTIONS.minimumHours);
  });

  it("totals are computed from unrounded phase values (round totals, not phases)", () => {
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 10 });
    const est = computeEstimate(r)!;
    expect(Number.isFinite(est.hoursLow)).toBe(true);
    expect(Number.isFinite(est.hoursHigh)).toBe(true);
    // exact values verified in the dedicated test above
    expect(est.hoursLow).toBe(22.8);
    expect(est.hoursHigh).toBe(43.9);
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
    expect(est.assumptions.validationMultiplier).toBe(DEFAULT_ASSUMPTIONS.validationMultiplier);
  });

  it("custom automationHoursPerCall changes hoursLow and hoursHigh", () => {
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 0 });
    const base = computeEstimate(r)!;
    const custom = computeEstimate(r, { automationHoursPerCall: 1 })!;
    expect(custom.hoursLow).toBeGreaterThan(base.hoursLow);
  });

  it("minimumHours is part of the assumptions model", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est.assumptions).toHaveProperty("minimumHours");
    expect(est.assumptions.minimumHours).toBe(DEFAULT_ASSUMPTIONS.minimumHours);
  });

  it("minimumHours override is respected", () => {
    const r = makeReadiness({ automatableCalls: 1, manualReviewCalls: 0, grade: "ready", score: 100 });
    const est = computeEstimate(r, { minimumHours: 8 })!;
    expect(est.hoursLow).toBe(8);
    expect(est.hoursHigh).toBe(8);
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

  it("automation row: hoursHigh === hoursLow * 1.5", () => {
    // Use 8 calls so both values round cleanly: 2.0h and 3.0h
    const r = makeReadiness({ automatableCalls: 8, manualReviewCalls: 0 });
    const est = computeEstimate(r)!;
    expect(est.breakdown[0].hoursHigh).toBe(est.breakdown[0].hoursLow * 1.5);
  });

  it("manual review row: hoursHigh === hoursLow * 2", () => {
    // Use 10 calls: manualLow=15h, manualHigh=30h
    const r = makeReadiness({ automatableCalls: 0, manualReviewCalls: 10 });
    const est = computeEstimate(r)!;
    expect(est.breakdown[1].hoursHigh).toBe(est.breakdown[1].hoursLow * 2);
  });

  it("validation row calls is 0", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est.breakdown[2].calls).toBe(0);
  });
});

// ── Cost projection ───────────────────────────────────────────────────────────

describe("computeEstimate — cost projection", () => {
  it("no hourlyRate → costLow, costHigh, hourlyRate are absent", () => {
    const r = makeReadiness();
    const est = computeEstimate(r)!;
    expect(est).not.toHaveProperty("costLow");
    expect(est).not.toHaveProperty("costHigh");
    expect(est).not.toHaveProperty("hourlyRate");
  });

  it("hourlyRate is a top-level estimate field, not inside assumptions", () => {
    const r = makeReadiness();
    const est = computeEstimate(r, undefined, 125)!;
    expect(est.hourlyRate).toBe(125);
    expect(est.assumptions).not.toHaveProperty("hourlyRate");
  });

  it("hourlyRate produces costLow and costHigh", () => {
    // hoursLow=22.8, hoursHigh=43.9
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 10 });
    const est = computeEstimate(r, undefined, 125)!;
    expect(est.costLow).toBe(Math.round(22.8 * 125));   // 2850
    expect(est.costHigh).toBe(Math.round(43.9 * 125));  // 5488
  });

  it("cost values are integers (rounded)", () => {
    const r = makeReadiness({ automatableCalls: 3, manualReviewCalls: 1 });
    const est = computeEstimate(r, undefined, 100)!;
    expect(Number.isInteger(est.costLow!)).toBe(true);
    expect(Number.isInteger(est.costHigh!)).toBe(true);
  });

  it("costHigh > costLow when enough calls to exceed minimumHours", () => {
    // 10 automatable with default 0.25h: rawLow=6.5 > 4, rawHigh=9.8
    const r = makeReadiness({ automatableCalls: 10, manualReviewCalls: 0, grade: "ready", score: 100 });
    const est = computeEstimate(r, undefined, 100)!;
    expect(est.costHigh).toBeGreaterThan(est.costLow!);
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

describe("audit --effort-estimate CLI", () => {
  it("--effort-estimate shows estimated migration effort in markdown stdout", () => {
    const r = cli("audit", "--effort-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout.toLowerCase()).toContain("estimated migration effort");
  });

  it("--effort-estimate --hourly-rate 125 shows estimated cost in markdown stdout", () => {
    const r = cli("audit", "--effort-estimate", "--hourly-rate", "125", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("$");
  });

  it("--effort-estimate on after-complete dir shows N/A in stderr", () => {
    const r = cli("audit", "--effort-estimate", AFTER_COMPLETE);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("N/A");
  });

  it("--format json with --effort-estimate includes estimate key", () => {
    const r = cli("audit", "--format", "json", "--effort-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("estimate");
    expect(parsed.estimate).not.toBeNull();
  });

  it("--format json WITHOUT --effort-estimate has no estimate key", () => {
    const r = cli("audit", "--format", "json", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("estimate");
  });

  it("--format json --effort-estimate on after-complete returns estimate: null", () => {
    const r = cli("audit", "--format", "json", "--effort-estimate", AFTER_COMPLETE);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("estimate");
    expect(parsed.estimate).toBeNull();
  });

  it("enterprise demo --effort-estimate produces revised default hours (22.8h – 43.9h)", () => {
    const r = cli("audit", "--format", "json", "--effort-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { estimate: { hoursLow: number; hoursHigh: number } };
    expect(parsed.estimate.hoursLow).toBe(22.8);
    expect(parsed.estimate.hoursHigh).toBe(43.9);
  });

  it("estimate section appears before Flag Debt Inventory in markdown", () => {
    const r = cli("audit", "--effort-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const estIdx = r.stdout.indexOf("Estimated Migration Effort");
    const inventoryIdx = r.stdout.indexOf("Flag Debt Inventory");
    expect(estIdx).toBeGreaterThan(-1);
    expect(inventoryIdx).toBeGreaterThan(-1);
    expect(estIdx).toBeLessThan(inventoryIdx);
  });

  it("--format html --effort-estimate contains <details> and <summary>", () => {
    const r = cli("audit", "--format", "html", "--effort-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("<details");
    expect(r.stdout).toContain("<summary");
  });

  it("--hourly-rate 0 exits with code 2", () => {
    const r = cli("audit", "--effort-estimate", "--hourly-rate", "0", ENTERPRISE_SRC);
    expect(r.status).toBe(2);
  });

  it("--hourly-rate -10 exits with code 2", () => {
    const r = cli("audit", "--effort-estimate", "--hourly-rate", "-10", ENTERPRISE_SRC);
    expect(r.status).toBe(2);
  });

  it("--hourly-rate abc exits with code 2", () => {
    const r = cli("audit", "--effort-estimate", "--hourly-rate", "abc", ENTERPRISE_SRC);
    expect(r.status).toBe(2);
  });

  it("--hourly-rate without --effort-estimate warns but succeeds", () => {
    const r = cli("audit", "--hourly-rate", "125", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("warn");
  });

  it("compact stderr shows directional hint when estimate is present", () => {
    const r = cli("audit", "--effort-estimate", "--config", ENTERPRISE_CONFIG, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("directional");
  });
});
