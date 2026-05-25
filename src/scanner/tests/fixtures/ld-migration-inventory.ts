import LaunchDarkly from "launchdarkly-node-server-sdk";

const ldClient = LaunchDarkly.init("sdk-key");

declare const context: unknown;
declare const orgContext: unknown;
declare const dynamicKey: string;
declare const fallbackFromConfig: unknown;

export const typedBool = ldClient.boolVariation("typed-bool", context, false);
export const typedString = ldClient.stringVariationDetail("typed-string", orgContext, "control");
export const typedNumber = ldClient.numberVariation("typed-number", context, 3000);
export const typedObject = ldClient.jsonVariationDetail("typed-object", orgContext, { layout: "modern" });

export const genericBool = ldClient.variation("generic-bool", context, true);
export const genericString = ldClient.variationDetail("generic-string", context, "fallback");
export const genericNumber = ldClient.variation("generic-number", context, 42);
export const genericObject = ldClient.variation("generic-object", orgContext, { mode: "compact" });

export const dynamicBool = ldClient.boolVariation(dynamicKey, context, false);
export const unknownFallback = ldClient.variation("generic-unknown", context, fallbackFromConfig);
export const unknownDetailFallback = ldClient.variationDetail("generic-detail-unknown", context, fallbackFromConfig);
export const bulkAllFlags = ldClient.allFlags(context);
export const bulkAllFlagsState = ldClient.allFlagsState(context);
