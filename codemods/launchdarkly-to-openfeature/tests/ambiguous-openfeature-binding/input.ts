import LaunchDarkly from "launchdarkly-node-server-sdk";
import { OpenFeature } from "@openfeature/server-sdk";

const ldClient = LaunchDarkly.init("sdk-key");
const openFeatureClient = OpenFeature.getClient("outer");

export function evaluate(context: unknown) {
  const openFeatureClient = OpenFeature.getClient("inner");
  return ldClient.boolVariation("checkout-v2", context, false);
}
