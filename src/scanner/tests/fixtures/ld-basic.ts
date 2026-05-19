import LaunchDarkly from 'launchdarkly-node-server-sdk'
const ldClient = LaunchDarkly.init('sdk-key')
const showBanner = ldClient.variation('show-banner', context, false)
const theme = ldClient.variation('ui-theme', context, 'light')
const price = ldClient.variationDetail('premium-price', context, 9.99)
