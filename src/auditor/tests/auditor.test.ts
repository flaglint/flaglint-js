import { describe, it, expect } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scan } from "../../scanner/index.js";
import { LocalFileSource } from "../../scanner/local-source.js";
import { FlagLintConfigSchema } from "../../config.js";
import { buildAuditReport } from "../index.js";

const ENTERPRISE_SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../examples/enterprise-checkout-service/src"
);

describe("buildAuditReport — enterprise-checkout-service", () => {
  it("summary.totalFlags > 0", async () => {
    const config = FlagLintConfigSchema.parse({});
    const scanResult = await scan(new LocalFileSource(ENTERPRISE_SRC), config);
    const report = buildAuditReport(scanResult, scanResult.migrationInventory ?? []);
    expect(report.summary.totalFlags).toBeGreaterThan(0);
  });

  it("summary.highRisk >= 0", async () => {
    const config = FlagLintConfigSchema.parse({});
    const scanResult = await scan(new LocalFileSource(ENTERPRISE_SRC), config);
    const report = buildAuditReport(scanResult, scanResult.migrationInventory ?? []);
    expect(report.summary.highRisk).toBeGreaterThanOrEqual(0);
  });

  it("flags are sorted HIGH → MEDIUM → LOW", async () => {
    const config = FlagLintConfigSchema.parse({});
    const scanResult = await scan(new LocalFileSource(ENTERPRISE_SRC), config);
    const report = buildAuditReport(scanResult, scanResult.migrationInventory ?? []);

    const riskOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < report.flags.length; i++) {
      expect(riskOrder[report.flags[i]!.riskLevel]).toBeGreaterThanOrEqual(
        riskOrder[report.flags[i - 1]!.riskLevel]
      );
    }
  });

  it("every flag has a valid riskLevel", async () => {
    const config = FlagLintConfigSchema.parse({});
    const scanResult = await scan(new LocalFileSource(ENTERPRISE_SRC), config);
    const report = buildAuditReport(scanResult, scanResult.migrationInventory ?? []);

    for (const flag of report.flags) {
      expect(["high", "medium", "low"]).toContain(flag.riskLevel);
    }
  });

  it("summary counts match flag array counts", async () => {
    const config = FlagLintConfigSchema.parse({});
    const scanResult = await scan(new LocalFileSource(ENTERPRISE_SRC), config);
    const report = buildAuditReport(scanResult, scanResult.migrationInventory ?? []);

    const { flags, summary } = report;
    expect(flags.length).toBe(summary.totalFlags);
    expect(flags.filter((f) => f.riskLevel === "high").length).toBe(summary.highRisk);
    expect(flags.filter((f) => f.riskLevel === "medium").length).toBe(summary.mediumRisk);
    expect(flags.filter((f) => f.riskLevel === "low").length).toBe(summary.lowRisk);
    expect(summary.highRisk + summary.mediumRisk + summary.lowRisk).toBe(summary.totalFlags);
  });
});
