import LaunchDarkly from 'launchdarkly-node-server-sdk'
const ldClient = LaunchDarkly.init('sdk-key')
const val = ldClient.variation(`show-banner`, context, false)
