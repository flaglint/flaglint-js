// Fixture: various valid LD client variable names — all must be detected.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const ctx: any;
const myClient: any      = {};
const featureClient: any = {};
export const r1 = myClient.variation("my-client-flag", ctx, false);
export const r2 = featureClient.variation("feature-client-flag", ctx, false);
