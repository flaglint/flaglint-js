// Fixture: someClient is NOT a LaunchDarkly client.
// No LaunchDarkly import or initialization is present in this file.
// The scanner MUST NOT detect this as LD SDK usage.
//
// Regression guard: recognizing typed LaunchDarkly method names must not be
// enough to classify an unrelated object as a LaunchDarkly client.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const ctx: any;
const someClient: any = {};

export const result = someClient.boolVariation('not-launchdarkly', ctx, false);
