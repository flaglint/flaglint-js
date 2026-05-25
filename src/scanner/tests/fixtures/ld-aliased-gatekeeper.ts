// Fixture: a real LaunchDarkly client stored under a non-obvious variable name.
// The scanner MUST detect variation() on this variable because it IS a real LD client.
//
// Regression guard: client identity is determined by tracking the
// LDClient.init() binding, not by matching the local variable name.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as LDClient from "@launchdarkly/node-server-sdk";

const gatekeeper = LDClient.init(process.env["LD_SDK_KEY"] ?? "");
const context = { key: "user-123" };

// Should be detected — gatekeeper IS a real LD client initialized from LDClient.init()
gatekeeper.variation("aliased-generic-flag", context, false);
