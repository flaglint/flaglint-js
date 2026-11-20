import LaunchDarkly from "launchdarkly-node-server-sdk";

const ldClient = LaunchDarkly.init("sdk-key");
declare const context: unknown;

export const enabled = ldClient.boolVariation("checkout-v2", context, false);
