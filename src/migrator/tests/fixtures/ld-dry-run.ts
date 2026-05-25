import LaunchDarkly from "launchdarkly-node-server-sdk";

const ldClient = LaunchDarkly.init("sdk-key");

declare const context: unknown;
declare const orgContext: unknown;
declare const dynamicKey: string;
declare const fallbackFromConfig: unknown;

export async function evaluateFlags() {
  const enabled = await ldClient.boolVariation("checkout-enabled", context, false);
  const tier = ldClient.stringVariation("pricing-tier", orgContext, "standard");
  const timeout = ldClient.numberVariation("timeout-ms", context, 2500);
  const config = ldClient.jsonVariation("checkout-config", orgContext, { layout: "modern" });
  const genericBool = ldClient.variation("generic-bool", context, true);
  const genericString = ldClient.variation("generic-string", orgContext, "control");
  const dynamic = ldClient.boolVariation(dynamicKey, context, false);
  const unknown = ldClient.variation("unknown-fallback", context, fallbackFromConfig);
  const detail = ldClient.boolVariationDetail("detail-flag", context, false);
  const all = ldClient.allFlagsState(context);

  return { enabled, tier, timeout, config, genericBool, genericString, dynamic, unknown, detail, all };
}
