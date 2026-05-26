import { describe, expect, it } from "vitest";
import { FlagLintConfigSchema } from "../../config.js";
import { scan } from "../../scanner/index.js";
import { analyze } from "../index.js";
import { applyMigration, hasOpenFeatureClientBinding, ApplyError } from "../apply.js";
import type { WritableFileSource } from "../apply.js";
import type { ScanResult } from "../../types.js";

// ── In-memory writable file source ────────────────────────────────────────────

/**
 * Test double that satisfies WritableFileSource without touching the real
 * filesystem.  listFiles() returns all stored keys so glob patterns are
 * irrelevant in the test context.
 */
class MemoryWritableFileSource implements WritableFileSource {
  private store = new Map<string, string>();

  constructor(files: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(files)) this.store.set(k, v);
  }

  async listFiles(_include: string[], _exclude: string[]): Promise<string[]> {
    return [...this.store.keys()];
  }

  async readFile(path: string): Promise<string> {
    const content = this.store.get(path);
    if (content === undefined)
      throw new Error(`MemoryWritableFileSource: file not found: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.store.set(path, content);
  }

  getContent(path: string): string | undefined {
    return this.store.get(path);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_CONFIG = FlagLintConfigSchema.parse({ include: ["**"], exclude: [], minFileCount: 0 });

/** Bypass the real git check in all unit tests. */
const NO_DIRTY_CHECK = { isWorkingTreeDirty: async (): Promise<boolean> => false };

/** Scan + analyze an in-memory source, then apply and return everything. */
async function runApply(
  files: Record<string, string>,
  opts: { allowDirty?: boolean; isWorkingTreeDirty?: () => Promise<boolean> } = NO_DIRTY_CHECK,
  allowedBindings: Array<{ importName: string; modulePatterns: string[] }> = []
) {
  const source = new MemoryWritableFileSource(files);
  const scanResult = await scan(source, BASE_CONFIG);
  const analysis = analyze(scanResult);
  const applyResult = await applyMigration(analysis, source, { ...NO_DIRTY_CHECK, ...opts, allowedOpenFeatureClientBindings: allowedBindings });
  return { source, analysis, applyResult };
}

/** Build a minimal empty ScanResult for tests that only need the error path. */
function emptyScanResult(): ScanResult {
  return {
    scannedAt: new Date().toISOString(),
    scanRoot: "/",
    scannedFiles: 0,
    totalUsages: 0,
    uniqueFlags: [],
    usages: [],
    migrationInventory: [],
    scanDurationMs: 0,
    warnings: [],
  };
}

// ── hasOpenFeatureClientBinding — proof-rule unit tests ───────────────────────
//
// The guard requires two conditions BOTH to hold:
//   1. `@openfeature/server-sdk` is imported/required, binding the OpenFeature API.
//   2. `openFeatureClient` is assigned from `<OpenFeatureApi>.getClient(…)`.
//
// Anything less is not considered proven provenance and must return false.

describe("hasOpenFeatureClientBinding — proof rule", () => {
  // ── TRUE cases: real OpenFeature import + getClient assignment ───────────────

  it("ESM import + const assignment → proven (true)", () => {
    const code = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      "const openFeatureClient = OpenFeature.getClient();",
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(true);
  });

  it("ESM import with alias + const assignment → proven (true)", () => {
    const code = [
      'import { OpenFeature as OF } from "@openfeature/server-sdk";',
      "const openFeatureClient = OF.getClient();",
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(true);
  });

  it("let declaration from getClient → proven (true)", () => {
    const code = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      "let openFeatureClient = OpenFeature.getClient();",
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(true);
  });

  // CJS: deliberately implemented and tested
  it("CJS require + const assignment → proven (true)", () => {
    const code = [
      'const { OpenFeature } = require("@openfeature/server-sdk");',
      "const openFeatureClient = OpenFeature.getClient();",
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(true);
  });

  it("CJS require with property alias + const assignment → proven (true)", () => {
    const code = [
      'const { OpenFeature: OF } = require("@openfeature/server-sdk");',
      "const openFeatureClient = OF.getClient();",
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(true);
  });

  it("getClient with named scope arg → proven (true)", () => {
    const code = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const openFeatureClient = OpenFeature.getClient("my-scope");',
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(true);
  });

  // ── FALSE cases: missing import ──────────────────────────────────────────────

  it("getClient call without @openfeature/server-sdk import → unproven (false)", () => {
    // openFeatureClient is assigned from something called OpenFeature, but there
    // is no proof that OpenFeature comes from the SDK.
    expect(
      hasOpenFeatureClientBinding("const openFeatureClient = OpenFeature.getClient();")
    ).toBe(false);
  });

  it("const declaration with unrelated value → unproven (false)", () => {
    const code = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      // Assigned from something other than OpenFeature.getClient
      "const openFeatureClient = someService.createClient();",
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(false);
  });

  it("import from wrong package → unproven (false)", () => {
    // Import is from a local file, not @openfeature/server-sdk.
    expect(
      hasOpenFeatureClientBinding(
        'import { OpenFeature } from "./openfeature-wrapper.js";\n' +
          "const openFeatureClient = OpenFeature.getClient();"
      )
    ).toBe(false);
  });

  // ── FALSE cases: arbitrary openFeatureClient import ──────────────────────────

  it("import { openFeatureClient } from arbitrary local path → unproven (false)", () => {
    expect(
      hasOpenFeatureClientBinding('import { openFeatureClient } from "./client-factory.js";')
    ).toBe(false);
  });

  it("import { openFeatureClient } from arbitrary package → unproven (false)", () => {
    expect(
      hasOpenFeatureClientBinding('import { openFeatureClient } from "some-other-package";')
    ).toBe(false);
  });

  it("import { getClient as openFeatureClient } from arbitrary module → unproven (false)", () => {
    expect(
      hasOpenFeatureClientBinding(
        'import { getClient as openFeatureClient } from "./client.js";'
      )
    ).toBe(false);
  });

  // ── FALSE cases: usage only ──────────────────────────────────────────────────

  it("usage-only (no declaration) → unproven (false)", () => {
    expect(
      hasOpenFeatureClientBinding(
        'const val = openFeatureClient.getBooleanValue("flag", false, ctx);'
      )
    ).toBe(false);
  });

  it("unrelated codebase (LD only) → unproven (false)", () => {
    expect(
      hasOpenFeatureClientBinding(
        [
          'import LaunchDarkly from "launchdarkly-node-server-sdk";',
          'const ldClient = LaunchDarkly.init("key");',
        ].join("\n")
      )
    ).toBe(false);
  });

  // ── Regression: commented-out code must NOT be treated as proven ─────────────

  it("commented-out import + binding (// comment) → unproven (false)", () => {
    // Comments are not AST body nodes — the parser ignores them entirely.
    const code = [
      '// import { OpenFeature } from "@openfeature/server-sdk";',
      "// const openFeatureClient = OpenFeature.getClient();",
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(false);
  });

  it("block-commented import + binding (/* */) → unproven (false)", () => {
    const code = [
      "/*",
      ' * import { OpenFeature } from "@openfeature/server-sdk";',
      " * const openFeatureClient = OpenFeature.getClient();",
      " */",
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(false);
  });

  // ── Regression: string/template literals must NOT be treated as proven ────────

  it("import text inside string literal → unproven (false)", () => {
    // The string is a Literal node in the AST; its content is never parsed
    // as code, so the ImportDeclaration within it is invisible to the walker.
    const code = [
      `const note = 'import { OpenFeature } from "@openfeature/server-sdk";';`,
      `const setup = 'const openFeatureClient = OpenFeature.getClient();';`,
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(false);
  });

  it("import text inside template literal → unproven (false)", () => {
    const code = [
      "const guide = `import { OpenFeature } from \"@openfeature/server-sdk\";" +
        " const openFeatureClient = OpenFeature.getClient();`;",
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
    ].join("\n");
    expect(hasOpenFeatureClientBinding(code)).toBe(false);
  });
});

// ── apply succeeds when OpenFeature binding is proven ────────────────────────
//
// Every fixture below includes BOTH:
//   import { OpenFeature } from "@openfeature/server-sdk"   ← proves SDK provenance
//   const openFeatureClient = OpenFeature.getClient()        ← proves assignment

describe("applyMigration — proven binding present", () => {
  it("rewrites a boolVariation call to getBooleanValue", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(1);
    expect(applyResult.skipped).toBe(0);
    expect(applyResult.transformedFiles).toEqual(["feature.ts"]);
    expect(source.getContent("feature.ts")).toContain(
      'openFeatureClient.getBooleanValue("my-flag", false, ctx)'
    );
  });

  it("rewrites stringVariation to getStringValue with correct arg order", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.stringVariation("pricing-tier", ctx, "standard");',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(1);
    expect(source.getContent("feature.ts")).toContain(
      'openFeatureClient.getStringValue("pricing-tier", "standard", ctx)'
    );
  });

  it("rewrites numberVariation to getNumberValue", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.numberVariation("timeout-ms", ctx, 2500);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(1);
    expect(source.getContent("feature.ts")).toContain(
      'openFeatureClient.getNumberValue("timeout-ms", 2500, ctx)'
    );
  });

  it("rewrites multiple calls in a single file", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      "export async function flags() {",
      '  const a = await ldClient.boolVariation("flag-a", ctx, false);',
      '  const b = ldClient.stringVariation("flag-b", ctx, "default");',
      "}",
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(2);
    const result = source.getContent("feature.ts")!;
    expect(result).toContain('openFeatureClient.getBooleanValue("flag-a", false, ctx)');
    expect(result).toContain('openFeatureClient.getStringValue("flag-b", "default", ctx)');
  });

  // ── CJS: deliberately implemented and tested ──────────────────────────────────

  it("CJS require binding: real require + getClient → applies", async () => {
    // Both the LD client and the OpenFeature client use CJS-style requires.
    const code = [
      'const LaunchDarkly = require("launchdarkly-node-server-sdk");',
      'const { OpenFeature } = require("@openfeature/server-sdk");',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'exports.r = ldClient.boolVariation("cjs-flag", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(1);
    expect(applyResult.skipped).toBe(0);
    expect(source.getContent("feature.ts")).toContain(
      'openFeatureClient.getBooleanValue("cjs-flag", false, ctx)'
    );
  });
});

// ── apply skips when binding is absent or unproven ───────────────────────────

describe("applyMigration — binding absent or unproven", () => {
  it("skips when there is no openFeatureClient at all", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
    expect(applyResult.skippedFiles[0]!.file).toBe("feature.ts");
    expect(applyResult.skippedFiles[0]!.reason).toContain("OpenFeature client setup required");
    expect(applyResult.skippedFiles[0]!.reason).toContain("--dry-run");
    expect(source.getContent("feature.ts")).toBe(code);
  });

  it("skips when openFeatureClient is assigned but @openfeature/server-sdk is not imported", async () => {
    // This is the core bug fix: a fake variable must NOT pass the guard.
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      // Assignment looks right but there is no SDK import to prove provenance.
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
    expect(source.getContent("feature.ts")).toBe(code);
  });

  it("skips when openFeatureClient is imported from an arbitrary local path", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { openFeatureClient } from "./client-factory.js";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
    expect(source.getContent("feature.ts")).toBe(code);
  });

  it("skips when multiple possible client bindings exist (ambiguous)", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      'const openFeatureClient = OpenFeature.getClient();',
      'const flags = OpenFeature.getClient();',
      'declare const ctx: unknown;',
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });
    // ambiguous binding -> apply must skip
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
  });

  it("skips when multiple configured imports map to multiple locals (ambiguous)", async () => {
    const providerA = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'export const openFeatureClient = OpenFeature.getClient();',
    ].join("\n");
    const providerB = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'export const openFeatureClient = OpenFeature.getClient();',
    ].join("\n");
    const service = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { openFeatureClient } from "./platform/a";',
      'import { openFeatureClient as flags } from "./platform/b";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      'declare const ctx: unknown;',
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");
    const files = {"platform/a.ts": providerA, "platform/b.ts": providerB, "service.ts": service};
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["platform/a", "platform/b"] }];
    const { source, applyResult } = await runApply(files, NO_DIRTY_CHECK, allowed);
    // ambiguous imports -> apply must skip
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
  });

  it("skips when openFeatureClient is assigned from an unrelated object's getClient", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      // Assigned from someOtherService, not OpenFeature.getClient()
      "const openFeatureClient = someOtherService.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({ "feature.ts": code });

    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
    expect(source.getContent("feature.ts")).toBe(code);
  });

  it("skips file but transforms a sibling that has proven binding", async () => {
    const withProvenBinding = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("a", ctx, false);',
    ].join("\n");

    const withoutBinding = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("b", ctx, false);',
    ].join("\n");

    const { source, applyResult } = await runApply({
      "with-binding.ts": withProvenBinding,
      "without-binding.ts": withoutBinding,
    });

    expect(applyResult.transformed).toBe(1);
    expect(applyResult.skipped).toBe(1);
    expect(applyResult.transformedFiles).toEqual(["with-binding.ts"]);
    expect(source.getContent("with-binding.ts")).toContain(
      'openFeatureClient.getBooleanValue("a", false, ctx)'
    );
    expect(source.getContent("without-binding.ts")).toBe(withoutBinding);
  });
});

// ── configured imported binding tests ─────────────────────────────────────────
describe("applyMigration — configured imported bindings", () => {
  it("applies when service imports configured named binding", async () => {
    const provider = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'export const openFeatureClient = OpenFeature.getClient();',
    ].join("\n");
    const service = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { openFeatureClient } from "./platform/feature-flags";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      'declare const ctx: unknown;',
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");
    const files = { "platform/feature-flags.ts": provider, "service.ts": service };
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["platform/feature-flags"] }];
    const { source, applyResult } = await runApply(files, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(1);
    expect(source.getContent("service.ts")).toContain('openFeatureClient.getBooleanValue("my-flag", false, ctx)');
  });

  it("applies using the local alias for an aliased import", async () => {
    const provider = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'export const openFeatureClient = OpenFeature.getClient();',
    ].join("\n");
    const service = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { openFeatureClient as flags } from "./platform/feature-flags";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      'declare const ctx: unknown;',
      'export const r = ldClient.boolVariation("a-flag", ctx, false);',
    ].join("\n");
    const files = {"platform/feature-flags.ts": provider, "service.ts": service};
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["platform/feature-flags"] }];
    const { source, applyResult } = await runApply(files, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(1);
    expect(source.getContent("service.ts")).toContain('flags.getBooleanValue("a-flag", false, ctx)');
  });

  it("skips when imported binding is not configured", async () => {
    const provider = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'export const openFeatureClient = OpenFeature.getClient();',
    ].join("\n");
    const service = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { openFeatureClient } from "./platform/feature-flags";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      'declare const ctx: unknown;',
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");
    const files = {"platform/feature-flags.ts": provider, "service.ts": service};
    const { source, applyResult } = await runApply(files);
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
  });

  it("skips when modulePatterns do not match import source", async () => {
    const provider = [
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'export const openFeatureClient = OpenFeature.getClient();',
    ].join("\n");
    const service = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { openFeatureClient } from "./platform/feature-flags";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      'declare const ctx: unknown;',
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");
    const files = {"platform/feature-flags.ts": provider, "service.ts": service};
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["other-pattern"] }];
    const { source, applyResult } = await runApply(files, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
  });
});

// ── glob modulePatterns regression tests ─────────────────────────────────────
describe("applyMigration — glob modulePatterns matching", () => {
  const makeService = (importPath: string) =>
    [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      `import { openFeatureClient } from "${importPath}";`,
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("glob-flag", ctx, false);',
    ].join("\n");

  // A — single-level relative path matches **/platform/feature-flags
  it("A: ../platform/feature-flags matches **/platform/feature-flags", async () => {
    const service = makeService("../platform/feature-flags");
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["**/platform/feature-flags"] }];
    const { source, applyResult } = await runApply({ "service.ts": service }, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(1);
    expect(source.getContent("service.ts")).toContain('openFeatureClient.getBooleanValue("glob-flag", false, ctx)');
  });

  // B — deep nested path matches **/platform/feature-flags
  it("B: ../../shared/platform/feature-flags matches **/platform/feature-flags", async () => {
    const service = makeService("../../shared/platform/feature-flags");
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["**/platform/feature-flags"] }];
    const { source, applyResult } = await runApply({ "service.ts": service }, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(1);
    expect(source.getContent("service.ts")).toContain('openFeatureClient.getBooleanValue("glob-flag", false, ctx)');
  });

  // C — lookalike suffix must NOT match
  it("C: ../platform/feature-flags-legacy does NOT match **/platform/feature-flags", async () => {
    const service = makeService("../platform/feature-flags-legacy");
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["**/platform/feature-flags"] }];
    const { applyResult } = await runApply({ "service.ts": service }, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
  });

  // D — wrong directory must NOT match
  it("D: ../legacy/feature-flags does NOT match **/platform/feature-flags", async () => {
    const service = makeService("../legacy/feature-flags");
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["**/platform/feature-flags"] }];
    const { applyResult } = await runApply({ "service.ts": service }, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
  });

  // E — aliased import: apply uses the local alias name, not the importName
  it("E: aliased import { openFeatureClient as flags } produces flags.getBooleanValue(…)", async () => {
    const service = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { openFeatureClient as flags } from "../platform/feature-flags";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("alias-flag", ctx, false);',
    ].join("\n");
    const allowed = [{ importName: "openFeatureClient", modulePatterns: ["**/platform/feature-flags"] }];
    const { source, applyResult } = await runApply({ "service.ts": service }, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(1);
    expect(source.getContent("service.ts")).toContain('flags.getBooleanValue("alias-flag", false, ctx)');
    expect(source.getContent("service.ts")).not.toContain("openFeatureClient.getBooleanValue");
  });

  // F — two configured bindings both match in same file → ambiguous → skips
  it("F: two matching configured bindings in same file → ambiguous → skips", async () => {
    const service = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { flagsClient } from "../platform/feature-flags";',
      'import { anotherClient } from "../platform/other-flags";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("ambig-flag", ctx, false);',
    ].join("\n");
    const allowed = [
      { importName: "flagsClient", modulePatterns: ["**/platform/feature-flags"] },
      { importName: "anotherClient", modulePatterns: ["**/platform/other-flags"] },
    ];
    const { applyResult } = await runApply({ "service.ts": service }, NO_DIRTY_CHECK, allowed);
    expect(applyResult.transformed).toBe(0);
    expect(applyResult.skipped).toBe(1);
  });
});

// ── dirty-tree protection ─────────────────────────────────────────────────────

describe("applyMigration — dirty-tree guard", () => {
  it("throws ApplyError(dirty-tree) when working tree is dirty", async () => {
    const source = new MemoryWritableFileSource();
    const analysis = analyze(emptyScanResult());

    await expect(
      applyMigration(analysis, source, { isWorkingTreeDirty: async () => true })
    ).rejects.toBeInstanceOf(ApplyError);

    await expect(
      applyMigration(analysis, source, { isWorkingTreeDirty: async () => true })
    ).rejects.toThrow("uncommitted changes");
  });

  it("error kind is 'dirty-tree'", async () => {
    const source = new MemoryWritableFileSource();
    const analysis = analyze(emptyScanResult());
    let caught: ApplyError | undefined;

    try {
      await applyMigration(analysis, source, { isWorkingTreeDirty: async () => true });
    } catch (err) {
      caught = err as ApplyError;
    }

    expect(caught).toBeInstanceOf(ApplyError);
    expect(caught!.kind).toBe("dirty-tree");
  });

  it("error message directs user to --dry-run provider guidance", async () => {
    const source = new MemoryWritableFileSource();
    const analysis = analyze(emptyScanResult());

    await expect(
      applyMigration(analysis, source, { isWorkingTreeDirty: async () => true })
    ).rejects.toThrow("--dry-run");
  });

  it("proceeds when allowDirty is true even if working tree is dirty", async () => {
    const source = new MemoryWritableFileSource();
    const analysis = analyze(emptyScanResult());

    const result = await applyMigration(analysis, source, {
      isWorkingTreeDirty: async () => true,
      allowDirty: true,
    });

    expect(result.transformed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("proceeds normally when working tree is clean", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const source = new MemoryWritableFileSource({ "f.ts": code });
    const scanResult = await scan(source, BASE_CONFIG);
    const analysis = analyze(scanResult);

    const result = await applyMigration(analysis, source, {
      isWorkingTreeDirty: async () => false,
    });

    expect(result.transformed).toBe(1);
  });
});

// ── context / fallback / await preservation ───────────────────────────────────

describe("applyMigration — arg order and await preservation", () => {
  it("puts fallback as arg 2 and context as arg 3 (reversed from LD order)", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      // LD order: key, context, fallback
      'export const r = ldClient.stringVariation("pricing-tier", ctx, "standard");',
    ].join("\n");

    const { source } = await runApply({ "f.ts": code });

    // OF order: key, fallback, context
    expect(source.getContent("f.ts")).toContain(
      'openFeatureClient.getStringValue("pricing-tier", "standard", ctx)'
    );
    // Must NOT have the LD arg order
    expect(source.getContent("f.ts")).not.toContain(
      'openFeatureClient.getStringValue("pricing-tier", ctx, "standard")'
    );
  });

  it("preserves the outer await for an awaited LD call", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      "export async function f() {",
      '  const x = await ldClient.boolVariation("flag", ctx, false);',
      "}",
    ].join("\n");

    const { source } = await runApply({ "f.ts": code });
    const result = source.getContent("f.ts")!;

    // outer await preserved
    expect(result).toContain('await openFeatureClient.getBooleanValue("flag", false, ctx)');
    // no double-await
    expect(result).not.toContain("await await");
  });

  it("does NOT inject await for a non-awaited LD call", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      '  const tier = ldClient.stringVariation("pricing-tier", ctx, "standard");',
    ].join("\n");

    const { source } = await runApply({ "f.ts": code });
    const result = source.getContent("f.ts")!;

    expect(result).toContain('openFeatureClient.getStringValue("pricing-tier", "standard", ctx)');
    expect(result).not.toContain("await openFeatureClient.getStringValue");
  });

  it("preserves the exact flag key string", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("checkout-v2-enabled", ctx, false);',
    ].join("\n");

    const { source } = await runApply({ "f.ts": code });

    // The flag key must appear verbatim in the transformed call.
    expect(source.getContent("f.ts")).toContain(
      'openFeatureClient.getBooleanValue("checkout-v2-enabled", false, ctx)'
    );
  });
});

// ── unsupported usages are never modified ─────────────────────────────────────

describe("applyMigration — unsupported usages unchanged", () => {
  // Shared fixture: file has proven binding + one safe call + all unsupported variants.
  async function mixedFile() {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      "declare const dynamicKey: string;",
      "declare const fallbackVar: unknown;",
      "export async function f() {",
      '  const safe   = ldClient.boolVariation("safe-flag", ctx, false);',
      '  const detail = ldClient.boolVariationDetail("detail-flag", ctx, false);',
      "  const dyn    = ldClient.boolVariation(dynamicKey, ctx, false);",
      '  const unk    = ldClient.variation("unknown-fb", ctx, fallbackVar);',
      "  const bulk   = ldClient.allFlagsState(ctx);",
      "}",
    ].join("\n");

    return runApply({ "mixed.ts": code });
  }

  it("only transforms the safe call, not detail/dynamic/unknown/bulk", async () => {
    const { applyResult } = await mixedFile();
    // Only "safe-flag" boolVariation is automatable
    expect(applyResult.transformed).toBe(1);
  });

  it("leaves boolVariationDetail in the source unchanged", async () => {
    const { source } = await mixedFile();
    expect(source.getContent("mixed.ts")).toContain('ldClient.boolVariationDetail("detail-flag"');
  });

  it("leaves dynamic-key boolVariation in the source unchanged", async () => {
    const { source } = await mixedFile();
    expect(source.getContent("mixed.ts")).toContain("ldClient.boolVariation(dynamicKey");
  });

  it("leaves unknown-fallback variation in the source unchanged", async () => {
    const { source } = await mixedFile();
    expect(source.getContent("mixed.ts")).toContain('ldClient.variation("unknown-fb"');
  });

  it("leaves allFlagsState in the source unchanged", async () => {
    const { source } = await mixedFile();
    expect(source.getContent("mixed.ts")).toContain("ldClient.allFlagsState(ctx)");
  });
});

// ── repeat apply is idempotent ────────────────────────────────────────────────

describe("applyMigration — idempotency", () => {
  it("second apply on an already-migrated file transforms nothing", async () => {
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      "export async function flags() {",
      '  const a = await ldClient.boolVariation("flag-a", ctx, false);',
      '  const b = ldClient.stringVariation("flag-b", ctx, "default");',
      "}",
    ].join("\n");

    // ── First apply ───────────────────────────────────────────────────────────
    const source1 = new MemoryWritableFileSource({ "f.ts": code });
    const scan1 = await scan(source1, BASE_CONFIG);
    const analysis1 = analyze(scan1);
    const apply1 = await applyMigration(analysis1, source1, NO_DIRTY_CHECK);

    expect(apply1.transformed).toBe(2);

    // ── Second apply (re-scan the modified file) ──────────────────────────────
    const modifiedCode = source1.getContent("f.ts")!;
    const source2 = new MemoryWritableFileSource({ "f.ts": modifiedCode });
    const scan2 = await scan(source2, BASE_CONFIG);
    const analysis2 = analyze(scan2);
    const apply2 = await applyMigration(analysis2, source2, NO_DIRTY_CHECK);

    // No LD calls remain → nothing to transform
    expect(apply2.transformed).toBe(0);
    expect(apply2.skipped).toBe(0);
    // File content is stable
    expect(source2.getContent("f.ts")).toBe(modifiedCode);
  });

  it("applying twice with the same (stale) analysis does not double-transform", async () => {
    // After the first apply the file contains OF calls. On the second pass
    // buildReplacement checks that code.slice(rangeStart, rangeEnd) still
    // equals item.callExpression — it no longer does, so every item is skipped
    // and transformed remains 0. This prevents corruption from stale analysis.
    const code = [
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      "declare const ctx: unknown;",
      'export const r = ldClient.boolVariation("my-flag", ctx, false);',
    ].join("\n");

    const source = new MemoryWritableFileSource({ "f.ts": code });
    const scanResult = await scan(source, BASE_CONFIG);
    const analysis = analyze(scanResult);

    const first = await applyMigration(analysis, source, NO_DIRTY_CHECK);
    expect(first.transformed).toBe(1);

    // Second call: same analysis object, source now has OF code.
    // The stale-analysis guard (callExpression mismatch) catches this.
    const second = await applyMigration(analysis, source, NO_DIRTY_CHECK);
    expect(second.transformed).toBe(0);
    // File content is stable — no double-write.
    expect(source.getContent("f.ts")).toContain(
      'openFeatureClient.getBooleanValue("my-flag", false, ctx)'
    );
  });
});
