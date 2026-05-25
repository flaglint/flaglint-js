import LaunchDarkly from 'launchdarkly-node-server-sdk'
const ldClient = LaunchDarkly.init('sdk-key')
const flagKey = getFlagKey(userId)
const result = ldClient.variation(flagKey, context, false)
const all = ldClient.allFlags(context)
