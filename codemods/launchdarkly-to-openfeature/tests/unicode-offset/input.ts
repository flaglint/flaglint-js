import LaunchDarkly from "@launchdarkly/node-server-sdk";
import { OpenFeature as OF } from "@openfeature/server-sdk";

const ldClient = LaunchDarkly.init("sdk-key");
const openFeatureClient = OF.getClient();
const label = "✅ café";
declare const context: unknown;

export const enabled = ldClient.boolVariation("checkout-v2", context, false);
