// Fixture: two LD clients initialized from the same SDK namespace under non-standard names.
// Both must be detected as proven LD clients via binding tracking, not name heuristics.
/* eslint-disable @typescript-eslint/no-explicit-any */
import LaunchDarkly from 'launchdarkly-node-server-sdk';
declare const ctx: any;
const myClient = LaunchDarkly.init('key-1');
const featureClient = LaunchDarkly.init('key-2');
export const r1 = myClient.variation("my-client-flag", ctx, false);
export const r2 = featureClient.variation("feature-client-flag", ctx, false);
