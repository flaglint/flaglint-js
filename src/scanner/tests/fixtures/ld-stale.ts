import LaunchDarkly from 'launchdarkly-node-server-sdk'
const ldClient = LaunchDarkly.init('sdk-key')
const oldFeature = ldClient.variation('old-checkout', context, false)
const tempFlag = ldClient.variation('temp-debug-mode', context, false)
