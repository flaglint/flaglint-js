import type { FlagUsage, MigrationInventoryItem } from "../types.js";

export type ReadinessGrade = "ready" | "moderate" | "complex" | "not-applicable";

export interface ReadinessIssueBreakdown {
  code: string;
  label: string;
  count: number;
  explanation: string;
}

export interface MigrationReadiness {
  score: number | null;
  grade: ReadinessGrade;
  totalCalls: number;
  automatableCalls: number;
  manualReviewCalls: number;
  manualReviewBreakdown: ReadinessIssueBreakdown[];
}

interface IssueSpec {
  code: string;
  label: string;
  explanation: string;
}

// Score = (automatableCalls / totalCalls) * 100.
// manualReviewBreakdown explains why calls need manual review — does not affect the score.
const ISSUE_SPECS: IssueSpec[] = [
  {
    code: "dynamic-key",
    label: "Dynamic flag keys",
    explanation: "Flag keys determined at runtime cannot be safely rewritten.",
  },
  {
    code: "detail-evaluation",
    label: "Detail evaluations",
    explanation: "Detail evaluation methods require manual migration to OpenFeature equivalents.",
  },
  {
    code: "bulk-evaluation",
    label: "Bulk evaluations",
    explanation: "Bulk flag evaluation calls have no direct OpenFeature equivalent.",
  },
  {
    code: "unknown-fallback",
    label: "Unknown fallback values",
    explanation: "Calls without a known fallback value type cannot be safely auto-migrated.",
  },
  {
    code: "ambiguous-client",
    label: "Ambiguous client bindings",
    explanation: "Calls without a proven OpenFeature client binding require manual setup.",
  },
];

function gradeFromScore(score: number): ReadinessGrade {
  if (score >= 80) return "ready";
  if (score >= 50) return "moderate";
  return "complex";
}

export function computeReadiness(
  usages: FlagUsage[],
  inventory: MigrationInventoryItem[]
): MigrationReadiness {
  const totalCalls = inventory.length > 0 ? inventory.length : usages.length;

  if (totalCalls === 0) {
    return {
      score: null,
      grade: "not-applicable",
      totalCalls: 0,
      automatableCalls: 0,
      manualReviewCalls: 0,
      manualReviewBreakdown: [],
    };
  }

  const automatableCalls =
    inventory.length > 0
      ? inventory.filter((i) => i.safelyAutomatable).length
      : usages.filter(
          (u) =>
            !u.isDynamic &&
            u.callType !== "allFlags" &&
            u.callType !== "allFlagsState" &&
            !u.callType.includes("Detail") &&
            u.callType !== "variationDetail"
        ).length;

  const manualReviewCalls = totalCalls - automatableCalls;

  const score =
    totalCalls > 0 ? Math.max(0, Math.round((automatableCalls / totalCalls) * 100)) : 0;

  const dynamicKeyCount =
    inventory.length > 0
      ? inventory.filter((i) => i.manualReviewReason === "dynamic-key").length
      : usages.filter((u) => u.isDynamic).length;

  const detailEvalCount =
    inventory.length > 0
      ? inventory.filter((i) => i.manualReviewReason === "detail-method").length
      : usages.filter((u) => u.callType.includes("Detail")).length;

  const bulkEvalCount =
    inventory.length > 0
      ? inventory.filter((i) => i.manualReviewReason === "bulk-inventory-call").length
      : usages.filter((u) => u.callType === "allFlags" || u.callType === "allFlagsState").length;

  const unknownFallbackCount =
    inventory.length > 0
      ? inventory.filter((i) => i.manualReviewReason === "unknown-fallback").length
      : 0;

  const ambiguousClientCount =
    inventory.length > 0
      ? inventory.filter((i) => !i.safelyAutomatable && i.manualReviewReason === undefined).length
      : 0;

  const occurrences: Record<string, number> = {
    "dynamic-key": dynamicKeyCount,
    "detail-evaluation": detailEvalCount,
    "bulk-evaluation": bulkEvalCount,
    "unknown-fallback": unknownFallbackCount,
    "ambiguous-client": ambiguousClientCount,
  };

  const manualReviewBreakdown: ReadinessIssueBreakdown[] = [];
  for (const spec of ISSUE_SPECS) {
    const count = occurrences[spec.code] ?? 0;
    if (count === 0) continue;
    manualReviewBreakdown.push({
      code: spec.code,
      label: spec.label,
      count,
      explanation: spec.explanation,
    });
  }

  return {
    score,
    grade: gradeFromScore(score),
    totalCalls,
    automatableCalls,
    manualReviewCalls,
    manualReviewBreakdown,
  };
}
