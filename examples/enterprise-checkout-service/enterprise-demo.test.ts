import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DEMO = join(ROOT, "examples/enterprise-checkout-service");
const ENTRY = join(ROOT, "dist/bin/flaglint.js");



const NPM_COMMAND =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";


const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeDemoCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "flaglint-enterprise-demo-"));
  tmpDirs.push(dir);
  const copy = join(dir, "enterprise-checkout-service");
  cpSync(DEMO, copy, {
    recursive: true,
    filter: (source) => !source.includes("node_modules"),
  });
  return copy;
}

function run(cwd: string, command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

describe("enterprise checkout service demo", () => {
  it("verifies the README walkthrough commands against a clean copy", () => {
    const demo = makeDemoCopy();

const install = spawnSync(
  NPM_COMMAND,
  ["install", "--ignore-scripts"],
  {
    cwd: demo,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    shell: process.platform === "win32",
  }
);


expect(install.status).toBe(0);
const scan = run(demo, process.execPath, [
  ENTRY,
  "scan",
  "./src",
  "--format",
  "html",
  "--output",
  "report.html",
]);


expect(scan.status).toBe(0);

    const dryRun = run(demo, process.execPath, [ENTRY, "migrate", "./src", "--dry-run"]);
    expect(dryRun.status).toBe(0);
    expect(dryRun.stdout).toContain("## Diffs");
    expect(dryRun.stdout).toContain("## Skipped Usages");

    const apply = run(demo, process.execPath, [ENTRY, "migrate", "./src", "--apply"]);
    expect(apply.status).toBe(0);
    expect(apply.stderr).toContain("Transformed:");

    expect(readFileSync(join(demo, "src/checkout.ts"), "utf8")).toContain(
      'openFeatureClient.getBooleanValue("checkout-v2", false, ctx)'
    );
    expect(readFileSync(join(demo, "src/pricing.ts"), "utf8")).toContain(
      'openFeatureClient.getNumberValue("discount-percentage", 0, ctx)'
    );
    expect(readFileSync(join(demo, "src/product.ts"), "utf8")).toContain(
      'openFeatureClient.getStringValue("recommendations-variant", "control", ctx)'
    );
    expect(readFileSync(join(demo, "src/analytics.ts"), "utf8")).toContain(
      "ldClient.boolVariationDetail"
    );

    const validate = run(demo, process.execPath, [
      ENTRY,
      "validate",
      "./src",
      "--no-direct-launchdarkly",
      "--bootstrap-exclude",
      "platform/feature-flags.ts",
    ]);
    expect(validate.status).toBe(1);
    expect(validate.stdout).toContain("direct LaunchDarkly evaluation call");

    const validateComplete = run(demo, process.execPath, [
      ENTRY,
      "validate",
      "./after-complete",
      "--no-direct-launchdarkly",
    ]);
    expect(validateComplete.status).toBe(0);
    expect(validateComplete.stdout).toContain("no direct LaunchDarkly evaluation calls found");
    expect(validateComplete.stdout).toContain("Scanned 5 file(s)");

    const completedCheckout = join(demo, "after-complete/checkout.ts");
    writeFileSync(
      completedCheckout,
      `${readFileSync(completedCheckout, "utf8")}

const regressionLaunchDarkly = require("launchdarkly-node-server-sdk");
const regressionLdClient = regressionLaunchDarkly.init("sdk-key");
export const regressionLeak = regressionLdClient.boolVariation(
  "regression-direct-ld",
  { key: "user-1" },
  false
);
`,
      "utf8"
    );

    const validateBrokenComplete = run(demo, process.execPath, [
      ENTRY,
      "validate",
      "./after-complete",
      "--no-direct-launchdarkly",
    ]);
    expect(validateBrokenComplete.status).toBe(1);
    expect(validateBrokenComplete.stdout).toContain("direct LaunchDarkly evaluation call");
  }, 30_000);
});
