const LaunchDarkly: any = require("launchdarkly-node-server-sdk");
const ldClient: any = LaunchDarkly.init("sdk-key");

declare const ctx: any;

const { boolVariation } = ldClient;

export const destructuredMethod = boolVariation(
  "destructured-method-flag",
  ctx,
  false
);

const { init } = require("launchdarkly-node-server-sdk");

const secondClient = init("sdk-key");

export const destructuredInit = secondClient.boolVariation(
  "destructured-init-flag",
  ctx,
  false
);