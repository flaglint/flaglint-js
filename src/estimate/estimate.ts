import type { MigrationReadiness } from "../readiness/readiness.js";

export const ESTIMATE_DISCLAIMER =
  "Estimates are directional planning guides based on call-site complexity. Actual effort depends on test coverage, team familiarity, and provider setup. FlagLint does not access runtime data or LaunchDarkly billing.";

export interface EstimateAssumptions {
  automationHoursPerCall: number;
  manualReviewHoursPerCall: number;
  validationMultiplier: number;
  hourlyRate?: number;
}

// High-effort defaults: conservative planning heuristics, not observed industry benchmarks.
export const DEFAULT_ASSUMPTIONS: EstimateAssumptions = {
  automationHoursPerCall: 0.5,
  manualReviewHoursPerCall: 4,
  validationMultiplier: 0.2,
};

export interface EstimateBreakdownItem {
  label: string;
  calls: number;
  hoursLow: number;
  hoursHigh: number;
  basis: string;
}

export interface MigrationEstimate {
  totalHoursLow: number;
  totalHoursHigh: number;
  costLow?: number;
  costHigh?: number;
  breakdown: EstimateBreakdownItem[];
  assumptions: EstimateAssumptions;
  disclaimer: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeEstimate(
  readiness: MigrationReadiness,
  overrides?: Partial<EstimateAssumptions>
): MigrationEstimate | null {
  if (readiness.grade === "not-applicable") return null;

  const assumptions: EstimateAssumptions = { ...DEFAULT_ASSUMPTIONS, ...overrides };
  const { automatableCalls, manualReviewCalls } = readiness;

  const automationHours = automatableCalls * assumptions.automationHoursPerCall;

  const manualHoursLow = manualReviewCalls * assumptions.manualReviewHoursPerCall;
  // High-end uncertainty: manual review calls carry 1.5× variance (harder calls take longer)
  const manualHoursHigh = manualReviewCalls * assumptions.manualReviewHoursPerCall * 1.5;

  const subTotalLow = automationHours + manualHoursLow;
  const subTotalHigh = automationHours + manualHoursHigh;

  const validationHoursLow = subTotalLow * assumptions.validationMultiplier;
  const validationHoursHigh = subTotalHigh * assumptions.validationMultiplier;

  const totalHoursLow = round1(subTotalLow + validationHoursLow);
  const totalHoursHigh = round1(subTotalHigh + validationHoursHigh);

  const breakdown: EstimateBreakdownItem[] = [
    {
      label: "Automatable calls",
      calls: automatableCalls,
      hoursLow: round1(automationHours),
      hoursHigh: round1(automationHours),
      basis: `${assumptions.automationHoursPerCall}h per automatable call`,
    },
    {
      label: "Manual review calls",
      calls: manualReviewCalls,
      hoursLow: round1(manualHoursLow),
      hoursHigh: round1(manualHoursHigh),
      basis: `${assumptions.manualReviewHoursPerCall}h per manual-review call`,
    },
    {
      label: "Validation & testing",
      calls: 0,
      hoursLow: round1(validationHoursLow),
      hoursHigh: round1(validationHoursHigh),
      basis: `${assumptions.validationMultiplier * 100}% of migration work`,
    },
  ];

  const result: MigrationEstimate = {
    totalHoursLow,
    totalHoursHigh,
    breakdown,
    assumptions,
    disclaimer: ESTIMATE_DISCLAIMER,
  };

  if (assumptions.hourlyRate !== undefined) {
    result.costLow = Math.round(totalHoursLow * assumptions.hourlyRate);
    result.costHigh = Math.round(totalHoursHigh * assumptions.hourlyRate);
  }

  return result;
}
