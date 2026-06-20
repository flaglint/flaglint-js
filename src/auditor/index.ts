import type { FlagUsage, MigrationInventoryItem, ScanResult } from "../types.js";
import { computeReadiness, type MigrationReadiness } from "../readiness/readiness.js";
export type { MigrationReadiness, ReadinessIssueBreakdown } from "../readiness/readiness.js";

export type FlagRiskLevel = "high" | "medium" | "low";

export type FlagDisplayTier = "high" | "automatable" | "medium" | "low";

export interface AuditFlagEntry {
  flagKey: string;
  riskLevel: FlagRiskLevel;
  /** Display tier for UI — "automatable" when medium-risk with only "safely automatable" reason. */
  displayTier: FlagDisplayTier;
  riskReasons: string[];
  callTypes: string[];
  fileCount: number;
  usageCount: number;
  safelyAutomatable: boolean;
  hasStaleSignal: boolean;
  isDynamic: boolean;
  files: string[];
}

export interface AuditSummary {
  totalFlags: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  automatableFlags: number;
  totalUsages: number;
  dynamicKeys: number;
  detailEvaluations: number;
  bulkCalls: number;
  wrapperUsages: number;
  staleSignals: number;
  safelyAutomatable: number;
  manualReview: number;
  scannedFiles: number;
  scanDurationMs: number;
  scannedAt: string;
  scanRoot: string;
  /** Present when staleSignals === 0 — explains which heuristics were checked. */
  stalenessNote?: string;
}

export interface AuditReport {
  summary: AuditSummary;
  flags: AuditFlagEntry[];
  readiness: MigrationReadiness;
}

function scoreFlag(
  usages: FlagUsage[],
  inventoryItems: MigrationInventoryItem[]
): { riskLevel: FlagRiskLevel; riskReasons: string[] } {
  const highReasons: string[] = [];
  const mediumReasons: string[] = [];

  if (usages.some((u) => u.isDynamic)) {
    highReasons.push("dynamic key");
  }
  if (inventoryItems.some((i) => i.manualReviewReason === "detail-method")) {
    highReasons.push("detail evaluation");
  }
  if (inventoryItems.some((i) => i.manualReviewReason === "bulk-inventory-call")) {
    highReasons.push("bulk call");
  }
  if (usages.some((u) => u.stalenessSignals.length > 0)) {
    highReasons.push("stale signal");
  }
  if (usages.some((u) => u.callType === "variation" && u.isDynamic)) {
    if (!highReasons.includes("wrapper usage")) {
      highReasons.push("wrapper usage");
    }
  }
  if (
    usages.some(
      (u) =>
        u.callType === "hook-useFlags" ||
        u.callType === "hook-useLDClient" ||
        u.callType === "hoc" ||
        u.callType === "provider"
    )
  ) {
    highReasons.push("react/browser hook");
  }

  if (highReasons.length > 0) {
    return { riskLevel: "high", riskReasons: highReasons };
  }

  if (inventoryItems.some((i) => i.safelyAutomatable)) {
    mediumReasons.push("safely automatable");
  }
  if (inventoryItems.some((i) => i.valueType === "object")) {
    mediumReasons.push("json variation");
  }
  if (inventoryItems.some((i) => i.manualReviewReason === "unknown-fallback")) {
    mediumReasons.push("unknown fallback");
  }

  if (mediumReasons.length > 0) {
    return { riskLevel: "medium", riskReasons: mediumReasons };
  }

  return { riskLevel: "low", riskReasons: [] };
}

export function buildAuditReport(
  scanResult: ScanResult,
  inventoryItems: MigrationInventoryItem[]
): AuditReport {
  const usagesByFlag = new Map<string, FlagUsage[]>();
  for (const u of scanResult.usages) {
    const key = u.flagKey;
    if (!usagesByFlag.has(key)) usagesByFlag.set(key, []);
    usagesByFlag.get(key)!.push(u);
  }

  const inventoryByFlag = new Map<string, MigrationInventoryItem[]>();
  for (const item of inventoryItems) {
    const key = item.staticFlagKey ?? "*";
    if (!inventoryByFlag.has(key)) inventoryByFlag.set(key, []);
    inventoryByFlag.get(key)!.push(item);
  }

  const allFlagKeys = new Set([...usagesByFlag.keys()]);

  const flags: AuditFlagEntry[] = [];

  for (const flagKey of allFlagKeys) {
    const usages = usagesByFlag.get(flagKey) ?? [];
    const items = inventoryByFlag.get(flagKey) ?? [];

    const { riskLevel, riskReasons } = scoreFlag(usages, items);
    const files = [...new Set(usages.map((u) => u.file))];
    const callTypes = [...new Set(usages.map((u) => u.callType))];

    const isAutomatableTier =
      riskLevel === "medium" &&
      riskReasons.length === 1 &&
      riskReasons[0] === "safely automatable";
    const displayTier: FlagDisplayTier = isAutomatableTier ? "automatable" : riskLevel;

    flags.push({
      flagKey,
      riskLevel,
      displayTier,
      riskReasons,
      callTypes,
      fileCount: files.length,
      usageCount: usages.length,
      safelyAutomatable: items.some((i) => i.safelyAutomatable),
      hasStaleSignal: usages.some((u) => u.stalenessSignals.length > 0),
      isDynamic: usages.some((u) => u.isDynamic),
      files,
    });
  }

  const riskOrder: Record<FlagRiskLevel, number> = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => {
    const levelDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.usageCount - a.usageCount;
  });

  const highRisk = flags.filter((f) => f.riskLevel === "high").length;
  const mediumRisk = flags.filter((f) => f.riskLevel === "medium").length;
  const lowRisk = flags.filter((f) => f.riskLevel === "low").length;
  const automatableFlags = flags.filter((f) => f.displayTier === "automatable").length;

  const staleSignals = scanResult.usages.filter((u) => u.stalenessSignals.length > 0).length;
  const stalenessNote =
    staleSignals === 0
      ? "No staleness signals detected. Heuristics checked: keyword match (flag key contains old/deprecated/legacy/temp/tmp/test/demo), path pattern (test/spec/mock files, deprecated/old/legacy directories), and minFileCount threshold. Git-history-based staleness (last evaluation date) requires git metadata and is not available in a pure static scan."
      : undefined;

  const summary: AuditSummary = {
    totalFlags: flags.length,
    highRisk,
    mediumRisk,
    lowRisk,
    automatableFlags,
    totalUsages: scanResult.totalUsages,
    dynamicKeys: scanResult.usages.filter((u) => u.isDynamic).length,
    detailEvaluations: inventoryItems.filter((i) => i.manualReviewReason === "detail-method").length,
    bulkCalls: inventoryItems.filter((i) => i.manualReviewReason === "bulk-inventory-call").length,
    wrapperUsages: scanResult.usages.filter((u) => u.callType === "variation").length,
    staleSignals,
    safelyAutomatable: inventoryItems.filter((i) => i.safelyAutomatable).length,
    manualReview: inventoryItems.filter((i) => !i.safelyAutomatable).length,
    scannedFiles: scanResult.scannedFiles,
    scanDurationMs: scanResult.scanDurationMs,
    scannedAt: scanResult.scannedAt,
    scanRoot: scanResult.scanRoot,
    ...(stalenessNote !== undefined ? { stalenessNote } : {}),
  };

  const readiness = computeReadiness(scanResult.usages, inventoryItems);

  return { summary, flags, readiness };
}
