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
