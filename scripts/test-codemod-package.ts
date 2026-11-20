import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "dist", "bin", "flaglint.js");
const codemod = join(root, "node_modules", ".bin", "codemod");
const workflow = join(root, "codemods", "launchdarkly-to-openfeature");
const fixturePath = join(root, "src", "migrator", "tests", "fixtures", "ld-dry-run.ts");

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n")
    );
  }
}

const tempRoot = await mkdtemp(join(root, ".flaglint-codemod-parity-"));
try {
  const cliTarget = join(tempRoot, "cli");
  const codemodTarget = join(tempRoot, "codemod");
  await Promise.all([mkdir(cliTarget), mkdir(codemodTarget)]);

  const baseFixture = await readFile(fixturePath, "utf8");
  const fixture = baseFixture
    .replace(
      'import LaunchDarkly from "launchdarkly-node-server-sdk";',
      [
        'import LaunchDarkly from "launchdarkly-node-server-sdk";',
        'import { OpenFeature } from "@openfeature/server-sdk";',
      ].join("\n")
    )
    .replace(
      'const ldClient = LaunchDarkly.init("sdk-key");',
      [
        'const ldClient = LaunchDarkly.init("sdk-key");',
        'const openFeatureClient = OpenFeature.getClient();',
        'const unicodePrefix = "✅ café";',
      ].join("\n")
    );

  const fixtures: Record<string, string> = {
    "fixture.ts": fixture,
    "fixture.js": [
      'const LaunchDarkly = require("launchdarkly-node-server-sdk");',
      'const { OpenFeature } = require("@openfeature/server-sdk");',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      'const context = { key: "user-1" };',
      'module.exports = ldClient.stringVariation("pricing-tier", context, "standard");',
      "",
    ].join("\n"),
    "fixture.tsx": [
      'import LaunchDarkly from "@launchdarkly/node-server-sdk";',
      'import { OpenFeature } from "@openfeature/server-sdk";',
      'const ldClient = LaunchDarkly.init("sdk-key");',
      "const openFeatureClient = OpenFeature.getClient();",
      'const context = { key: "user-1" };',
      'export const Banner = () => <div>{ldClient.boolVariation("banner", context, false)}</div>;',
      "",
    ].join("\n"),
  };
  await Promise.all(
    Object.entries(fixtures).flatMap(([filename, contents]) => [
      writeFile(join(cliTarget, filename), contents, "utf8"),
      writeFile(join(codemodTarget, filename), contents, "utf8"),
    ])
  );

  run(process.execPath, [cli, "migrate", ".", "--apply", "--allow-dirty"], cliTarget);
  run(
    codemod,
    [
      "workflow",
      "run",
      "-w",
      workflow,
      "-t",
      codemodTarget,
      "--allow-dirty",
      "--no-interactive",
      "--disable-analytics",
    ],
    root
  );

  const outputs = await Promise.all(
    Object.keys(fixtures).map(async (filename) => ({
      filename,
      cli: await readFile(join(cliTarget, filename), "utf8"),
      codemod: await readFile(join(codemodTarget, filename), "utf8"),
    }))
  );
  for (const output of outputs) {
    if (output.codemod !== output.cli) {
      throw new Error(
        `Codemod output differs from flaglint migrate --apply for ${output.filename}`
      );
    }
  }
  const codemodOutput = outputs.find((output) => output.filename === "fixture.ts")!.codemod;
  if (!codemodOutput.includes("openFeatureClient.getBooleanValue")) {
    throw new Error("Parity fixture did not transform a proven-safe call");
  }
  for (const untouched of [
    "ldClient.boolVariation(dynamicKey",
    "ldClient.boolVariationDetail",
    "ldClient.allFlagsState",
  ]) {
    if (!codemodOutput.includes(untouched)) {
      throw new Error(`Unsafe call was unexpectedly changed: ${untouched}`);
    }
  }

  process.stdout.write("Codemod output matches flaglint migrate --apply.\n");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
