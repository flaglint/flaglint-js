import LaunchDarkly from 'launchdarkly-node-server-sdk'
const ldClient = LaunchDarkly.init('sdk-key')
ldClient.isFeatureEnabled('is-premium-user', context)
ldClient.isFeatureEnabled(dynamicFlagKey, context)
