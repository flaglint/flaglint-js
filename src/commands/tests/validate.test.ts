import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
// Use the pre-built dist entry so that tsup defines (__PKG_VERSION__, __PKG_DESCRIPTION__) are resolved.
const ENTRY = join(ROOT, "dist/bin/flaglint.js");

function cli(...args: string[]) {
  return spawnSync(process.execPath, [ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

function makeTmpDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "flaglint-validate-test-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

// ── exit codes ────────────────────────────────────────────────────────────────

describe("validate command — exit codes", () => {
  it("exits 2 on invalid --format before doing any I/O", () => {
    const dir = makeTmpDir({ "plain.ts": "const x = 1;" });
    const r = cli("validate", "--format", "bogus", dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Invalid format");
    expect(r.stdout).toBe("");
  });

  it("exits 0 when no direct LD calls found with --no-direct-launchdarkly", () => {
    const dir = makeTmpDir({ "plain.ts": "const x = 1 + 2;" });
    const r = cli("validate", "--no-direct-launchdarkly", dir);
    expect(r.status).toBe(0);
  });

  it("exits 1 when direct LD calls found with --no-direct-launchdarkly", () => {
    const dir = makeTmpDir({
      "feature.ts": [
        "import LaunchDarkly from 'launchdarkly-node-server-sdk';",
        "const ldClient = LaunchDarkly.init('sdk-key');",
        "const enabled = ldClient.boolVariation('checkout-enabled', context, false);",
      ].join("\n"),
    });
    const r = cli("validate", "--no-direct-launchdarkly", dir);
    expect(r.status).toBe(1);
  });

  it("exits 0 without --no-direct-launchdarkly even when direct LD calls exist", () => {
    const dir = makeTmpDir({
      "feature.ts": [
        "import LaunchDarkly from 'launchdarkly-node-server-sdk';",
        "const ldClient = LaunchDarkly.init('sdk-key');",
        "const enabled = ldClient.boolVariation('checkout-enabled', context, false);",
      ].join("\n"),
    });
    const r = cli("validate", dir);
    expect(r.status).toBe(0);
  });

  it("exits 1 on directory not found", () => {
    const r = cli("validate", "/nonexistent-flaglint-validate-test-dir-xyz");
    expect(r.status).toBe(1);
  });
});

// ── stdout / stderr routing ───────────────────────────────────────────────────

describe("validate command — stdout/stderr routing", () => {
  it("writes invalid-format error to stderr, not stdout", () => {
    const dir = makeTmpDir({ "plain.ts": "const x = 1;" });
    const r = cli("validate", "--format", "bad", dir);
    expect(r.stderr).toContain("Invalid format");
    expect(r.stdout).toBe("");
  });

  it("writes validation report to stdout", () => {
    const dir = makeTmpDir({ "plain.ts": "const x = 1 + 2;" });
    const r = cli("validate", "--no-direct-launchdarkly", dir);
    expect(r.stdout).toContain("no direct LaunchDarkly evaluation calls found");
  });
});

// ── sarif output ──────────────────────────────────────────────────────────────

describe("validate command — sarif output", () => {
  it("produces valid SARIF with --format sarif", () => {
    const dir = makeTmpDir({ "plain.ts": "const x = 1 + 2;" });
    const r = cli("validate", "--no-direct-launchdarkly", "--format", "sarif", dir);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      version: string;
      runs: Array<{ tool: { driver: { name: string } }; results: unknown[] }>;
    };
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0]?.tool.driver.name).toBe("FlagLint");
  });
});
