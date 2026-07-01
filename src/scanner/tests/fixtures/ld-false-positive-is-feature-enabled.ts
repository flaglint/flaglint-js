// Custom isFeatureEnabled function — not from LaunchDarkly.
// The scanner must NOT detect calls to this as LD usage.
function isFeatureEnabled(userId: string, feature: string): boolean {
  return userId === 'admin' && feature === 'beta'
}

isFeatureEnabled('user-123', 'dark-mode')
isFeatureEnabled('user-456', 'new-checkout')
