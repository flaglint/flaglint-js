import { OpenFeature } from "@openfeature/server-sdk";

const openFeatureClient = OpenFeature.getClient();

export function evaluate(context: unknown) {
  const LaunchDarkly = require("launchdarkly-node-server-sdk");
  const ldClient = LaunchDarkly.init("sdk-key");
  return ldClient.boolVariation("checkout-v2", context, false);
}
