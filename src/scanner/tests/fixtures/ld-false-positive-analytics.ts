// Fixture: analyticsClient is NOT a LaunchDarkly client.
// No LaunchDarkly import or initialization is present in this file.
// The scanner MUST NOT flag this as LD SDK usage.
//
// Historical bug: the previous identifier-name heuristic incorrectly
// classified analyticsClient.variation(...) as LaunchDarkly usage.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const ctx: any;
const analyticsClient: any = {};

export const result = analyticsClient.variation('analytics-experiment', ctx, 'A');
