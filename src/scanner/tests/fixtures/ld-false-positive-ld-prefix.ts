// Fixture: ldAnalytics is NOT a LaunchDarkly client despite its name starting with 'ld'.
// No LaunchDarkly import or initialization is present in this file.
// The scanner must NOT emit any usage for this call.
//
// Regression guard: a non-LaunchDarkly object whose name starts with "ld"
// must not be treated as a LaunchDarkly client.

const ldAnalytics = {
  variation: (_key: string, _context: unknown, fallback: boolean) => fallback,
};

const context = { key: "user-123" };

ldAnalytics.variation("not-a-launchdarkly-flag", context, false);
