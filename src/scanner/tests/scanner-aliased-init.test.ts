import { describe, expect, it } from "vitest";
import { FlagLintConfigSchema } from "../../config.js";
import { scan } from "../index.js";
import { analyze } from "../../migrator/index.js";
import { formatDryRunDiff } from "../../migrator/dry-run.js";
import { applyMigration } from "../../migrator/apply.js";
import { formatValidationSarif, validateScanResult } from "../../validator/index.js";

class MemoryWritableFileSource {
  readonly root = "/tmp/flaglint-aliased-init";
  private store: Record<string, string>;

  constructor(files: Record<string, string>) {
    this.store = { ...files };
  }

  async listFiles(): Promise<string[]> {
    return Object.keys(this.store);
  }

  async readFile(path: string): Promise<string> {
    const content = this.store[path];
    if (content == null) throw new Error(`file not found: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.store[path] = content;
  }
}

const cfg = FlagLintConfigSchema.parse({
  include: ["**/*.ts"],
  exclude: [],
  minFileCount: 0,
  openFeatureClientBindings: [
    {
      importName: "openFeatureClient",
      modulePatterns: ["**/platform/feature-flags"],
    },
  ],
});

function serviceWithAliasedInit(pkg: string): string {
  return [
    `import { init as ldInit } from "${pkg}";`,
    'import { openFeatureClient as flags } from "../platform/feature-flags.js";',
    "",
    'const ldClient = ldInit("sdk-key");',
    "",
    "export async function checkout(ctx: { key: string }) {",
    '  return await ldClient.boolVariation("checkout-v2", ctx, false);',
    "}",
  ].join("\n");
}

function serviceWithNamedInit(pkg: string): string {
  return [
    `import { init } from "${pkg}";`,
    "",
    'const ldClient = init("sdk-key");',
    "",
    "export async function checkout(ctx: { key: string }) {",
    '  return await ldClient.boolVariation("checkout-v2", ctx, false);',
    "}",
  ].join("\n");
}

function serviceWithNamespaceImport(pkg: string): string {
  return [
    `import * as LaunchDarkly from "${pkg}";`,
    "",
    'const ldClient = LaunchDarkly.init("sdk-key");',
    "",
    "export async function checkout(ctx: { key: string }) {",
    '  return await ldClient.boolVariation("checkout-v2", ctx, false);',
    "}",
  ].join("\n");
}

const provider = [
  'import { OpenFeature } from "@openfeature/server-sdk";',
  "export const openFeatureClient = OpenFeature.getClient();",
].join("\n");

describe("LaunchDarkly named init import provenance", () => {
  it("detects scoped SDK clients initialized from aliased named init imports", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": serviceWithAliasedInit("@launchdarkly/node-server-sdk"),
      "platform/feature-flags.ts": provider,
    });

    const result = await scan(source, cfg);

    expect(result.totalUsages).toBe(1);
    expect(result.uniqueFlags).toEqual(["checkout-v2"]);
    expect(result.usages[0]).toMatchObject({
      file: "src/checkout.ts",
      callType: "boolVariation",
      flagKey: "checkout-v2",
      isDynamic: false,
    });
    expect(result.migrationInventory?.[0]).toMatchObject({
      staticFlagKey: "checkout-v2",
      valueType: "boolean",
      fallbackExpression: "false",
      evaluationContextExpression: "ctx",
      safelyAutomatable: true,
    });
  });

  it("detects legacy SDK clients initialized from aliased named init imports", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": serviceWithAliasedInit("launchdarkly-node-server-sdk"),
      "platform/feature-flags.ts": provider,
    });

    const result = await scan(source, cfg);

    expect(result.totalUsages).toBe(1);
    expect(result.uniqueFlags).toEqual(["checkout-v2"]);
  });

  it("keeps namespace init import detection unchanged", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": serviceWithNamespaceImport("@launchdarkly/node-server-sdk"),
    });

    const result = await scan(source, cfg);

    expect(result.totalUsages).toBe(1);
    expect(result.uniqueFlags).toEqual(["checkout-v2"]);
  });

  it("keeps unaliased named init import detection covered", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": serviceWithNamedInit("@launchdarkly/node-server-sdk"),
    });

    const result = await scan(source, cfg);

    expect(result.totalUsages).toBe(1);
    expect(result.uniqueFlags).toEqual(["checkout-v2"]);
  });

  it("does not match aliased init imported from a non-LaunchDarkly module", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": [
        'import { init as ldInit } from "./not-launchdarkly";',
        "",
        'const ldClient = ldInit("sdk-key");',
        'export const enabled = ldClient.boolVariation("checkout-v2", ctx, false);',
      ].join("\n"),
    });

    const result = await scan(source, cfg);

    expect(result.totalUsages).toBe(0);
    expect(result.uniqueFlags).toEqual([]);
  });

  it("strict validate fails and SARIF reports flaglint.direct-launchdarkly for aliased init usage", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": serviceWithAliasedInit("@launchdarkly/node-server-sdk"),
      "platform/feature-flags.ts": provider,
    });
    const result = await scan(source, cfg);

    const validation = validateScanResult(result, { noDirectLaunchDarkly: true });
    const sarif = JSON.parse(formatValidationSarif(validation, result.scanRoot, result.scannedAt)) as {
      runs: Array<{ tool: { driver: { rules: Array<{ id: string }> } }; results: Array<{ ruleId: string }> }>;
    };

    expect(validation.passed).toBe(false);
    expect(validation.violations).toHaveLength(1);
    expect(validation.violations[0]).toMatchObject({
      callType: "boolVariation",
      flagKey: "checkout-v2",
      file: "src/checkout.ts",
    });
    expect(sarif.runs[0]!.tool.driver.rules[0]!.id).toBe("flaglint.direct-launchdarkly");
    expect(sarif.runs[0]!.results[0]!.ruleId).toBe("flaglint.direct-launchdarkly");
  });

  it("dry-run previews proven OpenFeature alias binding for aliased init usage", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": serviceWithAliasedInit("@launchdarkly/node-server-sdk"),
      "platform/feature-flags.ts": provider,
    });
    const result = await scan(source, cfg);

    const output = await formatDryRunDiff(analyze(result), source, cfg.openFeatureClientBindings);

    expect(output).toContain('flags.getBooleanValue("checkout-v2", false, ctx)');
    expect(output).toContain("Diffs requiring provider setup: 0");
    expect(output).toContain("use proven OpenFeature client bindings");
    expect(output).not.toContain("placeholder `openFeatureClient`");
  });

  it("apply transforms aliased init usage only when a proven OpenFeature binding exists", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": serviceWithAliasedInit("@launchdarkly/node-server-sdk"),
      "platform/feature-flags.ts": provider,
    });
    const result = await scan(source, cfg);

    const applyResult = await applyMigration(analyze(result), source, {
      allowDirty: true,
      allowedOpenFeatureClientBindings: cfg.openFeatureClientBindings,
    });

    expect(applyResult.transformed).toBe(1);
    expect(applyResult.skipped).toBe(0);
    await expect(source.readFile("src/checkout.ts")).resolves.toContain(
      'return await flags.getBooleanValue("checkout-v2", false, ctx);'
    );
  });

  it("missing OpenFeature binding remains setup-required in dry-run and skipped by apply", async () => {
    const source = new MemoryWritableFileSource({
      "src/checkout.ts": [
        'import { init as ldInit } from "@launchdarkly/node-server-sdk";',
        "",
        'const ldClient = ldInit("sdk-key");',
        "export async function checkout(ctx: { key: string }) {",
        '  return await ldClient.boolVariation("checkout-v2", ctx, false);',
        "}",
      ].join("\n"),
    });
    const result = await scan(source, cfg);

    const output = await formatDryRunDiff(analyze(result), source, cfg.openFeatureClientBindings);
    const applyResult = await applyMigration(analyze(result), source, {
      allowDirty: true,
      allowedOpenFeatureClientBindings: cfg.openFeatureClientBindings,
    });

    expect(output).toContain('openFeatureClient.getBooleanValue("checkout-v2", false, ctx)');
    expect(output).toContain("Diffs requiring provider setup: 1");
    expect(output).toContain("placeholder `openFeatureClient`");
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
    await expect(source.readFile("src/checkout.ts")).resolves.toContain(
      'ldClient.boolVariation("checkout-v2", ctx, false)'
    );
  });
});
