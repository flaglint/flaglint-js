// Fixture: one real LaunchDarkly client and one unrelated client in the same file.
// Only calls on the real LD client must be detected.
//
// featureFlags  — initialized from LDClient.init(); must be detected.
//
// analyticsClient — a plain object with no LD relationship; must NOT be detected.
//
// Purpose: prevent an implementation that treats every .variation() call in a file
// that imports LaunchDarkly as an LD SDK usage (file-level taint would be wrong).
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as LDClient from "@launchdarkly/node-server-sdk";

const featureFlags = LDClient.init(process.env["LD_SDK_KEY"] ?? "");
const analyticsClient = {
  variation: (_key: string, _context: unknown, fallback: string) => fallback,
};

const context = { key: "user-123" };

// real-launchdarkly-flag — SHOULD be detected (featureFlags is a real LD client)
featureFlags.variation("real-launchdarkly-flag", context, false);

// analytics-experiment — must NOT be detected (analyticsClient is not an LD client)
analyticsClient.variation("analytics-experiment", context, "A");
