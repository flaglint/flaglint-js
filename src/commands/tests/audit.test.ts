import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTRY = join(ROOT, "dist/bin/flaglint.js");
const ENTERPRISE_SRC = join(
  ROOT,
  "examples/enterprise-checkout-service/src"
);

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

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "flaglint-audit-test-"));
  tmpDirs.push(dir);
  return dir;
}

describe("audit command — exit codes", () => {
  it("exits 0 on valid directory with LD usage", () => {
    const r = cli("audit", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
  });

  it("exits 0 on directory with no LD usage", () => {
    const r = cli("audit", join(ROOT, "docs-src"));
    expect(r.status).toBe(0);
  });

  it("exits 2 on invalid --format", () => {
    const r = cli("audit", "--format", "bogus", ENTERPRISE_SRC);
    expect(r.status).toBe(2);
  });

  it("exits 1 on directory not found", () => {
    const r = cli("audit", "/nonexistent-flaglint-audit-test-dir-xyz");
    expect(r.status).toBe(1);
  });
});

describe("audit command — output formats", () => {
  it("--format json produces valid parseable JSON with expected fields", () => {
    const r = cli("audit", "--format", "json", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("flags");
    const summary = parsed.summary as Record<string, unknown>;
    expect(summary).toHaveProperty("totalFlags");
    expect(summary).toHaveProperty("highRisk");
    expect(summary).toHaveProperty("mediumRisk");
    expect(summary).toHaveProperty("lowRisk");
  });

  it("--format markdown produces output containing 'FlagLint Audit Report'", () => {
    const r = cli("audit", "--format", "markdown", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("FlagLint Audit Report");
  });

  it("--format html produces output containing '<html' and 'FlagLint'", () => {
    const r = cli("audit", "--format", "html", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("<html");
    expect(r.stdout).toContain("FlagLint");
  });
});

describe("audit command — --output flag", () => {
  it("writes report to file when --output is given", () => {
    const dir = makeTmpDir();
    const outFile = join(dir, "audit.json");
    const r = cli("audit", "--format", "json", "--output", outFile, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("");
    const content = readFileSync(outFile, "utf8");
    expect(() => JSON.parse(content)).not.toThrow();
  });
});

describe("audit command — stderr summary", () => {
  it("stderr contains the summary line with flag counts", () => {
    const r = cli("audit", ENTERPRISE_SRC);
    expect(r.stderr).toContain("Audit complete");
    expect(r.stderr).toContain("flags");
    expect(r.stderr).toContain("high risk");
  });
});
