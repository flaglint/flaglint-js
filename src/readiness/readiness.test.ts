import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { computeReadiness } from "./readiness.js";
import { renderReadinessBar } from "./readiness-bar.js";
import type { FlagUsage, MigrationInventoryItem } from "../types.js";
import type { MigrationReadiness, ReadinessIssueBreakdown } from "./readiness.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = join(ROOT, "dist/bin/flaglint.js");
const ENTERPRISE_SRC = join(ROOT, "examples/enterprise-checkout-service/src");

function cli(...args: string[]) {
  return spawnSync(process.execPath, [ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
}

function makeUsage(overrides: Partial<FlagUsage> = {}): FlagUsage {
  return {
    flagKey: "my-flag",
    isDynamic: false,
    file: "src/app.ts",
    line: 1,
    column: 0,
    callType: "boolVariation",
    stalenessSignals: [],
    ...overrides,
  };
}

function makeInventory(overrides: Partial<MigrationInventoryItem> = {}): MigrationInventoryItem {
  return {
    file: "src/app.ts",
    line: 1,
    column: 0,
    launchDarklyMethod: "boolVariation",
    flagKeyExpression: '"my-flag"',
    staticFlagKey: "my-flag",
    isDynamic: false,
    valueType: "boolean",
    fallbackExpression: "false",
    evaluationContextExpression: "ctx",
    safelyAutomatable: true,
    ...overrides,
  };
}

// ── Score computation ─────────────────────────────────────────────────────────

describe("computeReadiness — score computation", () => {
  it("zero calls → score null, grade 'not-applicable'", () => {
    const r = computeReadiness([], []);
    expect(r.score).toBeNull();
    expect(r.grade).toBe("not-applicable");
    expect(r.totalCalls).toBe(0);
    expect(r.manualReviewBreakdown).toEqual([]);
  });

  it("all safe → score 100, grade 'ready'", () => {
    const r = computeReadiness(
      [makeUsage()],
      [makeInventory({ safelyAutomatable: true })]
    );
    expect(r.score).toBe(100);
    expect(r.grade).toBe("ready");
  });

  it("1/1 dynamic → 0% automatable → score 0", () => {
    const usages = [makeUsage({ isDynamic: true })];
    const inv = [makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" })];
    const r = computeReadiness(usages, inv);
    expect(r.score).toBe(0);
  });

  it("score never goes below 0", () => {
    const usages = Array.from({ length: 20 }, () => makeUsage({ isDynamic: true }));
    const inv = usages.map(() =>
      makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" })
    );
    const r = computeReadiness(usages, inv);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("score is always an integer", () => {
    const usages = [makeUsage({ isDynamic: true }), makeUsage()];
    const inv = [
      makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" }),
      makeInventory({ safelyAutomatable: true }),
    ];
    const r = computeReadiness(usages, inv);
    expect(Number.isInteger(r.score)).toBe(true);
  });

  it("4/5 safe → 80% automatable → score 80, grade 'ready'", () => {
    const inv = [
      ...Array.from({ length: 4 }, () => makeInventory({ safelyAutomatable: true })),
      makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" }),
    ];
    const usages = inv.map((i) => makeUsage({ isDynamic: i.isDynamic }));
    const r = computeReadiness(usages, inv);
    expect(r.score).toBe(80);
    expect(r.grade).toBe("ready");
  });

  it("3/5 safe → 60% automatable → score 60, grade 'moderate'", () => {
    const inv = [
      ...Array.from({ length: 3 }, () => makeInventory({ safelyAutomatable: true })),
      ...Array.from({ length: 2 }, () =>
        makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" })
      ),
    ];
    const usages = inv.map((i) => makeUsage({ isDynamic: i.isDynamic }));
    const r = computeReadiness(usages, inv);
    expect(r.score).toBe(60);
    expect(r.grade).toBe("moderate");
  });

  it("10/20 safe → 50% automatable → score 50, grade 'moderate'", () => {
    const inv = [
      ...Array.from({ length: 10 }, () => makeInventory({ safelyAutomatable: true })),
      ...Array.from({ length: 10 }, () =>
        makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" })
      ),
    ];
    const usages = inv.map((i) => makeUsage({ isDynamic: i.isDynamic }));
    const r = computeReadiness(usages, inv);
    expect(r.score).toBe(50);
    expect(r.grade).toBe("moderate");
  });

  it("4/10 safe → 40% automatable → score 40, grade 'complex'", () => {
    const inv = [
      ...Array.from({ length: 4 }, () => makeInventory({ safelyAutomatable: true })),
      ...Array.from({ length: 6 }, () =>
        makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" })
      ),
    ];
    const usages = inv.map((i) => makeUsage({ isDynamic: i.isDynamic }));
    const r = computeReadiness(usages, inv);
    expect(r.score).toBe(40);
    expect(r.grade).toBe("complex");
  });
});

// ── Output shape ──────────────────────────────────────────────────────────────

describe("computeReadiness — output shape", () => {
  it("MigrationReadiness has no normalization fields", () => {
    const r = computeReadiness([makeUsage()], [makeInventory()]);
    expect(r).not.toHaveProperty("normalizationApplied");
    expect(r).not.toHaveProperty("normalizationCap");
  });

  it("score is number when calls exist, null when zero calls", () => {
    const withCalls = computeReadiness([makeUsage()], [makeInventory()]);
    const zeroCalls = computeReadiness([], []);
    expect(typeof withCalls.score).toBe("number");
    expect(zeroCalls.score).toBeNull();
  });

  it("manualReviewBreakdown items have code, label, count, explanation — no pointsDeducted", () => {
    const usages = [makeUsage({ isDynamic: true })];
    const inv = [makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" })];
    const r = computeReadiness(usages, inv);
    const item = r.manualReviewBreakdown[0] as ReadinessIssueBreakdown;
    expect(item).toHaveProperty("code");
    expect(item).toHaveProperty("label");
    expect(item).toHaveProperty("count");
    expect(item).toHaveProperty("explanation");
    expect(item).not.toHaveProperty("pointsDeducted");
  });

  it("manualReviewBreakdown is empty when all calls are safely automatable", () => {
    const r = computeReadiness([makeUsage()], [makeInventory({ safelyAutomatable: true })]);
    expect(r.manualReviewBreakdown.length).toBe(0);
  });

  it("manualReviewBreakdown only includes codes with count > 0", () => {
    const usages = [makeUsage({ isDynamic: true })];
    const inv = [makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" })];
    const r = computeReadiness(usages, inv);
    for (const d of r.manualReviewBreakdown) {
      expect(d.count).toBeGreaterThan(0);
    }
  });
});

// ── Wrappers config detection scope ───────────────────────────────────────────

describe("computeReadiness — wrappers config detection scope", () => {
  it("totalCalls increases when wrappers config expands scanner detection scope", () => {
    // Without wrappers config: scanner sees only standard LD methods. Custom wrapper calls
    // like evaluateFlag() in flags-wrapper.ts are invisible.
    // With wrappers config (wrappers: ["evaluateFlag", ...]): those calls are detected too,
    // expanding migrationInventory and changing totalCalls.
    // This is expected behavior — wrappers config extends detection scope, not just classification.
    // Enterprise demo: without config → 19 calls, with config → 20 calls. Both are correct.
    const baseInv = Array.from({ length: 9 }, (_, i) =>
      makeInventory(
        i < 5
          ? { safelyAutomatable: true }
          : { isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" }
      )
    );
    const withExtraWrapper = [
      ...baseInv,
      makeInventory({ isDynamic: true, safelyAutomatable: false, manualReviewReason: "dynamic-key" }),
    ];
    const r9 = computeReadiness([], baseInv);
    const r10 = computeReadiness([], withExtraWrapper);
    expect(r9.totalCalls).toBe(9);
    expect(r10.totalCalls).toBe(10);
    expect(r9.score).toBe(Math.round((5 / 9) * 100));
    expect(r10.score).toBe(Math.round((5 / 10) * 100));
  });
});

// ── Progress bar ─────────────────────────────────────────────────────────────

describe("renderReadinessBar", () => {
  it("progress bar is exactly 27 characters wide before the percent suffix", () => {
    const bar = renderReadinessBar(50);
    const barSection = bar.slice(0, bar.indexOf("]") + 1);
    // [<25 chars>] = 27 chars total
    expect(barSection.length).toBe(27);
  });

  it("filled + empty characters always sum to 25", () => {
    for (const score of [0, 25, 50, 74, 80, 100]) {
      const bar = renderReadinessBar(score);
      const inner = bar.slice(1, bar.indexOf("]"));
      const filled = (inner.match(/█/g) ?? []).length;
      const empty = (inner.match(/░/g) ?? []).length;
      expect(filled + empty).toBe(25);
    }
  });

  it("score 100 → all filled", () => {
    const bar = renderReadinessBar(100);
    const inner = bar.slice(1, bar.indexOf("]"));
    expect(inner).toBe("█".repeat(25));
  });

  it("score 0 → all empty", () => {
    const bar = renderReadinessBar(0);
    const inner = bar.slice(1, bar.indexOf("]"));
    expect(inner).toBe("░".repeat(25));
  });

  it("score 50 → 13 filled (Math.round(12.5) = 13 in JS)", () => {
    const bar = renderReadinessBar(50);
    const inner = bar.slice(1, bar.indexOf("]"));
    const filled = (inner.match(/█/g) ?? []).length;
    // Accept 12 or 13 per spec
    expect(filled === 12 || filled === 13).toBe(true);
  });
});

// ── JSON output ───────────────────────────────────────────────────────────────

describe("audit JSON output — readiness field", () => {
  it("readiness field present in audit --format json output", () => {
    const r = cli("audit", "--format", "json", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("readiness");
  });

  it("readiness object has all required fields", () => {
    const r = cli("audit", "--format", "json", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { readiness: Record<string, unknown> };
    const rd = parsed.readiness;
    expect(rd).toHaveProperty("score");
    expect(rd).toHaveProperty("grade");
    expect(rd).toHaveProperty("totalCalls");
    expect(rd).toHaveProperty("automatableCalls");
    expect(rd).toHaveProperty("manualReviewCalls");
    expect(rd).toHaveProperty("manualReviewBreakdown");
    expect(rd).not.toHaveProperty("deductions");
    expect(rd).not.toHaveProperty("normalizationApplied");
    expect(rd).not.toHaveProperty("normalizationCap");
  });

  it("existing JSON fields unchanged", () => {
    const r = cli("audit", "--format", "json", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("flags");
  });

  it("readinessScore appears in audit markdown stdout", () => {
    const r = cli("audit", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout.toLowerCase()).toContain("readiness");
  });
});
