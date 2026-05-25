import { describe, expect, it } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scan } from "../index.js";
import { LocalFileSource } from "../local-source.js";
import { FlagLintConfigSchema } from "../../config.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "benchmark-fixtures");
const BENCHMARK_FILE = "ld-node-server-benchmark.ts";

const EXPECTED_STATIC_KEYS = Array.from(
  { length: 70 },
  (_, i) => `bench-static-${String(i + 1).padStart(3, "0")}`
);
const FALSE_POSITIVE_LOOKALIKE_KEYS = Array.from(
  { length: 25 },
  (_, i) => `bench-fp-${String(i + 1).padStart(3, "0")}`
);

const EXPECTED_DYNAMIC_USAGES = 15;
const EXPECTED_BULK_USAGES = 10;
const EXPECTED_LOOKALIKE_CASES = 25;
const EXPECTED_BULK_CALL_TYPES = new Map([
  ["allFlags", 5],
  ["allFlagsState", 5],
]);
const TOTAL_BENCHMARK_CASES =
  EXPECTED_STATIC_KEYS.length + EXPECTED_DYNAMIC_USAGES + EXPECTED_BULK_USAGES + EXPECTED_LOOKALIKE_CASES;

function cfg() {
  return FlagLintConfigSchema.parse({ include: [BENCHMARK_FILE], exclude: [], minFileCount: 0 });
}

function metrics(actualKeys: string[]) {
  // Precision/recall intentionally measure supported static Node server SDK
  // inventory only. Dynamic keys and bulk inventory calls are manual-review
  // cases and are asserted separately below.
  const actual = new Set(actualKeys);
  const expected = new Set(EXPECTED_STATIC_KEYS);
  const tp = EXPECTED_STATIC_KEYS.filter((key) => actual.has(key)).length;
  const fp = actualKeys.filter((key) => !expected.has(key)).length;
  const fn = EXPECTED_STATIC_KEYS.filter((key) => !actual.has(key)).length;
  return {
    tp,
    fp,
    fn,
    precision: tp / (tp + fp),
    recall: tp / (tp + fn),
  };
}

describe("scanner benchmark — LaunchDarkly Node server SDK inventory", () => {
  it("meets precision and recall thresholds across deterministic benchmark cases", async () => {
    expect(TOTAL_BENCHMARK_CASES).toBeGreaterThanOrEqual(100);

    const result = await scan(new LocalFileSource(FIXTURES), cfg());
    const actualMetrics = metrics(result.uniqueFlags);

    expect(result.uniqueFlags).toHaveLength(EXPECTED_STATIC_KEYS.length);
    expect(actualMetrics).toEqual({
      tp: 70,
      fp: 0,
      fn: 0,
      precision: 1,
      recall: 1,
    });
    expect(actualMetrics.precision).toBeGreaterThanOrEqual(0.98);
    expect(actualMetrics.recall).toBeGreaterThanOrEqual(0.95);
  });

  it("covers dynamic/manual-review and false-positive lookalike cases without polluting static inventory", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg());
    const dynamicUsages = result.usages.filter((usage) => usage.isDynamic);
    const bulkUsages = result.usages.filter((usage) => usage.flagKey === "*");
    const bulkCounts = new Map<string, number>();
    for (const usage of bulkUsages) {
      bulkCounts.set(usage.callType, (bulkCounts.get(usage.callType) ?? 0) + 1);
    }

    expect(dynamicUsages).toHaveLength(EXPECTED_DYNAMIC_USAGES);
    expect(dynamicUsages.every((usage) => usage.flagKey === "dynamic")).toBe(true);
    expect(dynamicUsages.every((usage) => !result.uniqueFlags.includes(usage.flagKey))).toBe(true);
    expect(bulkUsages).toHaveLength(EXPECTED_BULK_USAGES);
    expect(bulkCounts).toEqual(EXPECTED_BULK_CALL_TYPES);
    expect(result.totalUsages).toBe(
      EXPECTED_STATIC_KEYS.length + EXPECTED_DYNAMIC_USAGES + EXPECTED_BULK_USAGES
    );

    for (const key of FALSE_POSITIVE_LOOKALIKE_KEYS) {
      expect(result.uniqueFlags).not.toContain(key);
      expect(result.usages.some((usage) => usage.flagKey === key)).toBe(false);
    }
  });
});
