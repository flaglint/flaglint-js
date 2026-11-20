const { init: ldInit } = require("@launchdarkly/node-server-sdk");
const { OpenFeature: OF } = require("@openfeature/server-sdk");

const featureClient = ldInit("sdk-key");
const client = OF.getClient();
declare const context: unknown;

export const tier = client.getStringValue("pricing-tier", "standard", context);
