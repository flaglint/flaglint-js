const flagKey = getFlagKey(userId)
const result = ldClient.variation(flagKey, context, false)
const all = ldClient.allFlags(context)
