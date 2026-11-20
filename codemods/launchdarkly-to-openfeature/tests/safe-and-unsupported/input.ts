import LaunchDarkly from "launchdarkly-node-server-sdk";
import { OpenFeature } from "@openfeature/server-sdk";

const ldClient = LaunchDarkly.init("sdk-key");
const openFeatureClient = OpenFeature.getClient();
declare const context: unknown;
declare const dynamicKey: string;
declare const unknownFallback: unknown;

export async function evaluateFlags() {
  const safe = await ldClient.boolVariation("checkout-v2", context, false);
  const detail = await ldClient.boolVariationDetail("checkout-v2", context, false);
  const dynamic = await ldClient.stringVariation(dynamicKey, context, "default");
  const unknown = await ldClient.variation("unknown", context, unknownFallback);
  const bigint = await ldClient.variation("bigint", context, 1n);
  const all = await ldClient.allFlagsState(context);
  return { safe, detail, dynamic, unknown, bigint, all };
}
