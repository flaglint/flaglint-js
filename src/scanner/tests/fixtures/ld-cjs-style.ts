// Fixture: CommonJS-style require() pattern.
// Regression guard: require('launchdarkly-node-server-sdk') establishes an LD
// namespace, and variables initialized from namespace.init() are proven LD
// clients for both generic and typed evaluation methods.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const LaunchDarkly: any = require('launchdarkly-node-server-sdk');
const ldClient: any = LaunchDarkly.init('sdk-key');
declare const context: any;

// variation() via CJS require.
export const cjsVariation = ldClient.variation('cjs-require-flag', context, false);

// boolVariation() via CJS require.
export const cjsBool = ldClient.boolVariation('cjs-bool-flag', context, false);
