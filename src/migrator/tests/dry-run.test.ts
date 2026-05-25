import { describe, expect, it } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scan } from "../../scanner/index.js";
import { LocalFileSource } from "../../scanner/local-source.js";
import { FlagLintConfigSchema } from "../../config.js";
import { analyze } from "../index.js";
import { formatDryRunDiff } from "../dry-run.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

async function dryRunOutput(): Promise<string> {
  const source = new LocalFileSource(FIXTURES);
  const result = await scan(
    source,
    FlagLintConfigSchema.parse({ include: ["ld-dry-run.ts"], exclude: [], minFileCount: 0 })
  );
  return formatDryRunDiff(analyze(result), source);
}

describe("migrate --dry-run diffs", () => {
  it("generates reviewable diffs for safe typed and generic literal evaluations", async () => {
    await expect(dryRunOutput()).resolves.toMatchInlineSnapshot(`
      "# FlagLint migrate --dry-run

      These diffs use the placeholder \`openFeatureClient\` and require OpenFeature provider/client setup before they can be applied.
      No files are modified by dry-run output.

      Reviewable diffs: 6
      Diffs requiring provider setup: 6
      Skipped usages: 4

      ## Provider Setup (Required Before Applying Diffs)

      LaunchDarkly remains your feature flag provider.
      OpenFeature becomes the evaluation API your application code calls.
      You add one initialization step; **do not remove any LaunchDarkly packages** —
      the OpenFeature provider depends on them at runtime.

      ### 1. Install packages

      \`\`\`sh
      npm install @openfeature/server-sdk @launchdarkly/node-server-sdk @launchdarkly/openfeature-node-server
      \`\`\`

      ### 2. Initialize once at application startup

      Add the following to your application bootstrap (do not apply automatically):

      \`\`\`typescript
      import { OpenFeature } from "@openfeature/server-sdk";
      import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";

      const ldProvider = new LaunchDarklyProvider("<your-sdk-key>");
      await OpenFeature.setProviderAndWait(ldProvider);

      // Share this client across your application.
      // Replace the \`openFeatureClient\` placeholder in the diffs below.
      const openFeatureClient = OpenFeature.getClient();
      \`\`\`

      ### 3. Evaluation context — targeting key

      LaunchDarkly requires a \`targetingKey\` field in every evaluation context.
      Replace the context arguments shown in the diffs with an object that includes it:

      \`\`\`typescript
      { targetingKey: user.key, ...otherAttributes }
      \`\`\`

      ## Diffs
      \`\`\`diff
      diff --git a/ld-dry-run.ts b/ld-dry-run.ts
      --- a/ld-dry-run.ts
      +++ b/ld-dry-run.ts
      @@ -11,1 +11,1 @@
      -  const enabled = await ldClient.boolVariation("checkout-enabled", context, false);
      +  const enabled = await openFeatureClient.getBooleanValue("checkout-enabled", false, context);
      @@ -12,1 +12,1 @@
      -  const tier = ldClient.stringVariation("pricing-tier", orgContext, "standard");
      +  const tier = openFeatureClient.getStringValue("pricing-tier", "standard", orgContext);
      @@ -13,1 +13,1 @@
      -  const timeout = ldClient.numberVariation("timeout-ms", context, 2500);
      +  const timeout = openFeatureClient.getNumberValue("timeout-ms", 2500, context);
      @@ -14,1 +14,1 @@
      -  const config = ldClient.jsonVariation("checkout-config", orgContext, { layout: "modern" });
      +  const config = openFeatureClient.getObjectValue("checkout-config", { layout: "modern" }, orgContext);
      @@ -15,1 +15,1 @@
      -  const genericBool = ldClient.variation("generic-bool", context, true);
      +  const genericBool = openFeatureClient.getBooleanValue("generic-bool", true, context);
      @@ -16,1 +16,1 @@
      -  const genericString = ldClient.variation("generic-string", orgContext, "control");
      +  const genericString = openFeatureClient.getStringValue("generic-string", "control", orgContext);
      \`\`\`

      ## Skipped Usages
      - ld-dry-run.ts:17:18 — \`dynamicKey\` via \`boolVariation\`: dynamic key requires manual review
      - ld-dry-run.ts:18:18 — \`unknown-fallback\` via \`variation\`: unknown fallback type requires manual review
      - ld-dry-run.ts:19:17 — \`detail-flag\` via \`boolVariationDetail\`: detail methods skipped: OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires manual review
      - ld-dry-run.ts:20:14 — \`*\` via \`allFlagsState\`: bulk inventory call has no single-flag codemod
      "
    `);
  });

  it("preserves context/fallback order and does not replace non-boolean fallbacks with false", async () => {
    const output = await dryRunOutput();

    expect(output).toContain('openFeatureClient.getStringValue("pricing-tier", "standard", orgContext)');
    expect(output).toContain('openFeatureClient.getNumberValue("timeout-ms", 2500, context)');
    expect(output).toContain('openFeatureClient.getObjectValue("checkout-config", { layout: "modern" }, orgContext)');
    expect(output).not.toContain('openFeatureClient.getStringValue("pricing-tier", false');
    expect(output).not.toContain('openFeatureClient.getNumberValue("timeout-ms", false');
    expect(output).not.toContain('openFeatureClient.getObjectValue("checkout-config", false');
  });

  it("does not claim apply-safety before provider/client setup", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("require OpenFeature provider/client setup before they can be applied");
    expect(output).toContain("Diffs requiring provider setup: 6");
    expect(output).not.toContain("safe to apply");
    expect(output).not.toContain("ready to apply");
  });

  it("uses a placeholder client instead of inventing an already-wired client", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("openFeatureClient.getBooleanValue");
    expect(output).not.toContain(" client.getBooleanValue");
    expect(output).not.toContain(" client.getStringValue");
  });

  it("reports skipped dynamic, unknown, detail, and bulk usages", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("dynamic key requires manual review");
    expect(output).toContain("unknown fallback type requires manual review");
    expect(output).toContain("detail methods skipped");
    expect(output).toContain("bulk inventory call has no single-flag codemod");
  });

  // ── Await-preservation tests ────────────────────────────────────────────────
  // The `await` keyword sits *outside* the CallExpression range.
  // applyReplacements replaces only the range [rangeStart, rangeEnd].
  // For awaited calls, the outer `await ` is in code.slice(0, rangeStart) and is
  // preserved automatically.  For non-awaited calls, no `await` must be injected.

  it("await preservation: awaited LD call keeps outer await in the diff output", async () => {
    const output = await dryRunOutput();
    // Line 11: `await ldClient.boolVariation(...)` — the outer `await` is preserved.
    expect(output).toContain(
      '+  const enabled = await openFeatureClient.getBooleanValue("checkout-enabled", false, context);'
    );
    // Verify no double-await is introduced.
    expect(output).not.toContain("await await");
  });

  it("await preservation: non-awaited LD call does NOT get await injected into the diff output", async () => {
    const output = await dryRunOutput();
    // Line 12: `ldClient.stringVariation(...)` — no outer `await`; replacement must be bare.
    expect(output).toContain(
      '+  const tier = openFeatureClient.getStringValue("pricing-tier", "standard", orgContext);'
    );
    expect(output).not.toContain("+  const tier = await openFeatureClient");

    // Spot-check two more non-awaited lines.
    expect(output).toContain(
      '+  const timeout = openFeatureClient.getNumberValue("timeout-ms", 2500, context);'
    );
    expect(output).not.toContain("+  const timeout = await openFeatureClient");

    expect(output).toContain(
      '+  const genericBool = openFeatureClient.getBooleanValue("generic-bool", true, context);'
    );
    expect(output).not.toContain("+  const genericBool = await openFeatureClient");
  });
});

// ── Prompt 7: provider setup guidance ─────────────────────────────────────────
// These tests lock in the package names, the "do not remove LD" contract,
// the section ordering, and the absence of any automatic-apply language.

describe("migrate --dry-run provider setup guidance", () => {
  it("lists all three required packages in the correct install command", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("@openfeature/server-sdk");
    expect(output).toContain("@launchdarkly/node-server-sdk");
    expect(output).toContain("@launchdarkly/openfeature-node-server");
    // All three on a single install line so users can copy it directly.
    expect(output).toContain(
      "npm install @openfeature/server-sdk @launchdarkly/node-server-sdk @launchdarkly/openfeature-node-server"
    );
  });

  it("names LaunchDarklyProvider as the provider class to instantiate", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("LaunchDarklyProvider");
    expect(output).toContain('import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server"');
  });

  it("names OpenFeature.setProviderAndWait as the initializer", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("OpenFeature.setProviderAndWait");
    expect(output).toContain('import { OpenFeature } from "@openfeature/server-sdk"');
  });

  it("does NOT instruct users to remove LaunchDarkly packages", async () => {
    const output = await dryRunOutput();

    // None of these removal patterns should appear.
    expect(output).not.toContain("npm uninstall launchdarkly");
    expect(output).not.toContain("npm uninstall @launchdarkly");
    expect(output).not.toContain("remove launchdarkly");
    expect(output).not.toContain("remove @launchdarkly");
    expect(output).not.toContain("uninstall launchdarkly");
    expect(output).not.toContain("delete launchdarkly");
  });

  it("explicitly states that LaunchDarkly packages must NOT be removed", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("do not remove any LaunchDarkly packages");
  });

  it("explains that LaunchDarkly remains the provider", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("LaunchDarkly remains your feature flag provider");
  });

  it("explains that OpenFeature becomes the evaluation API, not the provider", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("OpenFeature becomes the evaluation API your application code calls");
  });

  it("mentions the targetingKey requirement for evaluation context", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("targetingKey");
    expect(output).toContain("targeting key");
  });

  it("marks initialization as manual (not auto-applied)", async () => {
    const output = await dryRunOutput();

    expect(output).toContain("do not apply automatically");
  });

  it("places the provider setup section between the summary and the call-site diffs", async () => {
    const output = await dryRunOutput();

    const setupPos = output.indexOf("## Provider Setup");
    const diffsPos = output.indexOf("## Diffs");
    const skippedPos = output.indexOf("## Skipped Usages");

    // Setup comes before diffs.
    expect(setupPos).toBeGreaterThan(0);
    expect(diffsPos).toBeGreaterThan(setupPos);
    // Diffs come before skipped usages.
    expect(skippedPos).toBeGreaterThan(diffsPos);
  });

  it("does not claim that applying the diffs alone completes the migration", async () => {
    const output = await dryRunOutput();

    expect(output).not.toContain("migration complete");
    expect(output).not.toContain("fully migrated");
    expect(output).not.toContain("safe to apply");
    expect(output).not.toContain("ready to apply");
    expect(output).not.toContain("apply these changes");
  });
});
