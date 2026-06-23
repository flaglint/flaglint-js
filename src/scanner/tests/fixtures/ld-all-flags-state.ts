// Fixture: allFlagsState() bulk inventory method.
// allFlagsState() returns an EvaluationSeriesContext containing all flag
// evaluations for a given context — it is a bulk inventory call, not a
// single-flag evaluation. The scanner must represent it with flagKey='*'
// and callType='allFlagsState'.
/* eslint-disable @typescript-eslint/no-explicit-any */
import LaunchDarkly from 'launchdarkly-node-server-sdk';

const ldClient = LaunchDarkly.init('sdk-key');
declare const context: any;

export const allState = ldClient.allFlagsState(context);
