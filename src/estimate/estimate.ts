import type { MigrationReadiness } from "../readiness/readiness.js";

export const ESTIMATE_DISCLAIMER =
  "Estimates are directional planning guides based on call-site complexity. Actual effort depends on test coverage, team familiarity, and provider setup. FlagLint does not access runtime data or LaunchDarkly billing.";

export interface EstimationAssumptions {
  automationHoursPerCall: number;
  manualReviewHoursPerCall: number;
  validationMultiplier: number;
  minimumHours: number;
}

// Conservative planning heuristics, not observed industry benchmarks.
export const DEFAULT_ASSUMPTIONS: EstimationAssumptions = {
  automationHoursPerCall: 0.25,
  manualReviewHoursPerCall: 1.5,
  validationMultiplier: 0.3,
  minimumHours: 4,
};

export interface EstimateBreakdownItem {
  label: string;
  calls: number;
  hoursLow: number;
  hoursHigh: number;
  basis: string;
}

export interface MigrationEstimate {
  hoursLow: number;
  hoursHigh: number;
  costLow?: number;
  costHigh?: number;
  hourlyRate?: number;
  breakdown: EstimateBreakdownItem[];
  assumptions: EstimationAssumptions;
  disclaimer: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeEstimate(
  readiness: MigrationReadiness,
  overrides?: Partial<EstimationAssumptions>,
  hourlyRate?: number
): MigrationEstimate | null {
  if (readiness.grade === "not-applicable") return null;

  const assumptions: EstimationAssumptions = { ...DEFAULT_ASSUMPTIONS, ...overrides };
  const { automatableCalls, manualReviewCalls } = readiness;

  const automationLow = automatableCalls * assumptions.automationHoursPerCall;
  const automationHigh = automationLow * 1.5;

  const manualLow = manualReviewCalls * assumptions.manualReviewHoursPerCall;
  const manualHigh = manualLow * 2;

  const validationLow = (automationLow + manualLow) * assumptions.validationMultiplier;
  const validationHigh = (automationHigh + manualHigh) * assumptions.validationMultiplier;

  // Totals computed from unrounded phase values, then rounded to 1 decimal
  const rawLow = automationLow + manualLow + validationLow;
  const rawHigh = automationHigh + manualHigh + validationHigh;
  const hoursLow = Math.max(assumptions.minimumHours, round1(rawLow));
  const hoursHigh = Math.max(assumptions.minimumHours, round1(rawHigh));

  const breakdown: EstimateBreakdownItem[] = [
    {
      label: "Automatable calls",
      calls: automatableCalls,
      hoursLow: round1(automationLow),
      hoursHigh: round1(automationHigh),
      basis: `${assumptions.automationHoursPerCall}h per automatable call`,
    },
    {
      label: "Manual review calls",
      calls: manualReviewCalls,
      hoursLow: round1(manualLow),
      hoursHigh: round1(manualHigh),
      basis: `${assumptions.manualReviewHoursPerCall}h per manual-review call`,
    },
    {
      label: "Validation & testing",
      calls: 0,
      hoursLow: round1(validationLow),
      hoursHigh: round1(validationHigh),
      basis: `${assumptions.validationMultiplier * 100}% of migration work`,
    },
  ];

  const result: MigrationEstimate = {
    hoursLow,
    hoursHigh,
    breakdown,
    assumptions,
    disclaimer: ESTIMATE_DISCLAIMER,
  };

  if (hourlyRate !== undefined) {
    result.hourlyRate = hourlyRate;
    result.costLow = Math.round(hoursLow * hourlyRate);
    result.costHigh = Math.round(hoursHigh * hourlyRate);
  }

  return result;
}
