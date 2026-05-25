import LaunchDarkly from 'launchdarkly-node-server-sdk'
const ldClient = LaunchDarkly.init('sdk-key')
export const enabled = ldClient.boolVariation('checkout-enabled', context, false)
