// Fixture: ES module import from @launchdarkly/node-server-sdk (SDK v8+, new package name).
// Regression guard: the scoped Node server SDK package establishes an LD
// namespace for client initialization provenance.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ld from '@launchdarkly/node-server-sdk';

const ldClient = ld.init(process.env.LD_SDK_KEY ?? '');
declare const context: any;

// variation() via scoped Node server package.
export const esmVariation = ldClient.variation('esm-generic-flag', context, false);

// boolVariation() via scoped Node server package.
export const esmBool = ldClient.boolVariation('esm-sdk-flag', context, false);
