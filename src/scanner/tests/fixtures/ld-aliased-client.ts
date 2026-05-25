// Fixture: LaunchDarkly client stored under a non-obvious local variable name.
// Regression guard: real clients are detected from SDK initialization provenance,
// regardless of whether the local variable name looks like a LaunchDarkly client.
/* eslint-disable @typescript-eslint/no-explicit-any */
import LaunchDarkly from 'launchdarkly-node-server-sdk';

const featureGate = LaunchDarkly.init(process.env.LD_SDK_KEY ?? '');
declare const context: any;

// boolVariation() on an aliased LaunchDarkly client.
export const aliasedBool = featureGate.boolVariation('aliased-client-flag', context, false);

// variation() on an aliased LaunchDarkly client.
export const aliasedVariation = featureGate.variation('aliased-variation-flag', context, false);
