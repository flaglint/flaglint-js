import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
// Use the pre-built dist entry so that tsup defines (__PKG_VERSION__, __PKG_DESCRIPTION__) are resolved.
const ENTRY = join(ROOT, "dist/bin/flaglint.js");
const FIXTURES = join(ROOT, "src/scanner/tests/fixtures");

function cli(...args: string[]) {
  return spawnSync(process.execPath, [ENTRY, ...args], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

function makeTmpDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "flaglint-cli-test-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

// ── exit codes ────────────────────────────────────────────────────────────────

describe("CLI — exit codes", () => {
  it("exits 2 on invalid --format before doing any I/O", () => {
    const r = cli("scan", "--format", "bogus", FIXTURES);
    expect(r.status).toBe(2);
  });

  it("exits 1 when stale flags are found", () => {
    // FIXTURES contains old-checkout and temp-debug-mode — both stale by keyword
    const r = cli("scan", FIXTURES);
    expect(r.status).toBe(1);
  });

  it("exits 0 when no LaunchDarkly usage found", () => {
    const dir = makeTmpDir({ "plain.ts": "const x = 1 + 2;" });
    const r = cli("scan", dir);
    expect(r.status).toBe(0);
  });

  it("exits 0 when LD usage exists but no flags are stale", () => {
    // Hook-only usage produces flagKey="*" which is excluded from stale checks
    const dir = makeTmpDir({
      "hooks.tsx": `import { useLDClient } from 'launchdarkly-react-client-sdk'\nconst c = useLDClient()`,
    });
    const r = cli("scan", dir);
    expect(r.status).toBe(0);
  });

  it("exits 1 on directory not found", () => {
    const r = cli("scan", "/nonexistent-flaglint-test-dir-xyz");
    expect(r.status).toBe(1);
  });
});

// ── stdout / stderr routing ───────────────────────────────────────────────────

describe("CLI — stdout/stderr routing", () => {
  it("writes the report body to stdout, summary to stderr", () => {
    const r = cli("scan", "--format", "json", FIXTURES);
    // Report (JSON) goes to stdout
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    // Summary goes to stderr, not stdout
    expect(r.stdout).not.toContain("flag usages found");
    expect(r.stderr).toContain("flag usages found");
  });

  it("stderr contains stale warning when stale flags exist", () => {
    const r = cli("scan", FIXTURES);
    expect(r.stderr).toContain("stale");
  });

  it("stderr contains the invalid-format error, not stdout", () => {
    const r = cli("scan", "--format", "bad");
    expect(r.stderr).toContain("Invalid format");
    expect(r.stdout).toBe("");
  });
});

// ── json output validity ──────────────────────────────────────────────────────

describe("CLI — json output", () => {
  it("produces valid parseable JSON with --format json", () => {
    const r = cli("scan", "--format", "json", FIXTURES);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("scannedAt");
    expect(parsed).toHaveProperty("scanRoot");
    expect(parsed).toHaveProperty("scannedFiles");
    expect(parsed).toHaveProperty("usages");
    expect(parsed).toHaveProperty("generatedAt");
  });
});

// ── sarif output validity ─────────────────────────────────────────────────────

describe("CLI — sarif output", () => {
  it("produces valid SARIF with --format sarif", () => {
    const r = cli("scan", "--format", "sarif", FIXTURES);
    const parsed = JSON.parse(r.stdout) as {
      version: string;
      runs: Array<{ tool: { driver: { name: string } }; results: unknown[] }>;
    };
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0]?.tool.driver.name).toBe("FlagLint");
    expect(parsed.runs[0]?.results.length).toBeGreaterThan(0);
  });
});

// ── --output flag ─────────────────────────────────────────────────────────────

describe("CLI — --output flag", () => {
  it("writes report to file when --output is given", () => {
    const dir = makeTmpDir({});
    const outFile = join(dir, "report.json");
    const r = cli("scan", "--format", "json", "--output", outFile, FIXTURES);
    // stdout should be empty when writing to file
    expect(r.stdout.trim()).toBe("");
    // file should exist and be valid JSON
    const content = readFileSync(outFile, "utf8");
    expect(() => JSON.parse(content)).not.toThrow();
  });
});
