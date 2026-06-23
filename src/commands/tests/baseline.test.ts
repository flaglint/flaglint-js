import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTRY = join(ROOT, "dist/bin/flaglint.js");
const ENTERPRISE_SRC = join(ROOT, "examples/enterprise-checkout-service/src");

function cli(...args: string[]) {
  return spawnSync(process.execPath, [ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "flaglint-baseline-test-"));
  tmpDirs.push(dir);
  return dir;
}

// ── 1. --write-baseline creates valid baseline JSON ──────────────────────────

describe("audit --write-baseline", () => {
  it("creates a valid baseline JSON file with correct structure", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");

    const r = cli("audit", "--write-baseline", baselineFile, ENTERPRISE_SRC);
    expect(r.status).toBe(0);

    const raw = readFileSync(baselineFile, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed["version"]).toBe("1");
    expect(typeof parsed["createdAt"]).toBe("string");
    expect(typeof parsed["flaglintVersion"]).toBe("string");
    expect(Array.isArray(parsed["fingerprints"])).toBe(true);

    // All fingerprints should be strings
    const fingerprints = parsed["fingerprints"] as unknown[];
    for (const fp of fingerprints) {
      expect(typeof fp).toBe("string");
    }
  });

  it("fingerprints array is sorted and deduplicated", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");

    const r = cli("audit", "--write-baseline", baselineFile, ENTERPRISE_SRC);
    expect(r.status).toBe(0);

    const raw = readFileSync(baselineFile, "utf8");
    const parsed = JSON.parse(raw) as { fingerprints: string[] };
    const fps = parsed.fingerprints;

    // Should be sorted
    const sorted = [...fps].sort();
    expect(fps).toEqual(sorted);

    // Should be deduplicated
    const unique = [...new Set(fps)];
    expect(fps.length).toBe(unique.length);
  });

  it("prints success message to stderr", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");

    const r = cli("audit", "--write-baseline", baselineFile, ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("Baseline written to");
    expect(r.stderr).toContain(baselineFile);
  });

  it("creates parent directories if they do not exist", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "nested", "deep", "baseline.json");

    const r = cli("audit", "--write-baseline", baselineFile, ENTERPRISE_SRC);
    expect(r.status).toBe(0);

    const raw = readFileSync(baselineFile, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

// ── 2. --baseline with no new findings exits 0 ────────────────────────────────

describe("validate --baseline with no new findings", () => {
  it("exits 0 when all current findings are in the baseline", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");

    // First capture the baseline from the scan target
    const writeResult = cli("audit", "--write-baseline", baselineFile, ENTERPRISE_SRC);
    expect(writeResult.status).toBe(0);

    // Now validate against that baseline — no new findings expected
    const r = cli("validate", "--baseline", baselineFile, "--fail-on-new", ENTERPRISE_SRC);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("No new findings beyond baseline");
  });
});

// ── 3. --baseline + --fail-on-new with new findings exits 1 ──────────────────

describe("validate --baseline --fail-on-new with new findings", () => {
  it("exits 1 when findings are not in the baseline", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");

    // Write an empty baseline (no known findings)
    const emptyBaseline = {
      version: "1",
      createdAt: new Date().toISOString(),
      flaglintVersion: "0.9.0",
      fingerprints: [],
    };
    writeFileSync(baselineFile, JSON.stringify(emptyBaseline, null, 2) + "\n", "utf8");

    // Scan a directory that has LD usage — all findings will be "new"
    const r = cli("validate", "--baseline", baselineFile, "--fail-on-new", ENTERPRISE_SRC);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("new finding");
  });

  it("lists new fingerprints in the error message", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");

    const emptyBaseline = {
      version: "1",
      createdAt: new Date().toISOString(),
      flaglintVersion: "0.9.0",
      fingerprints: [],
    };
    writeFileSync(baselineFile, JSON.stringify(emptyBaseline, null, 2) + "\n", "utf8");

    const r = cli("validate", "--baseline", baselineFile, "--fail-on-new", ENTERPRISE_SRC);
    expect(r.status).toBe(1);
    // Fingerprints are listed with " - " prefix
    expect(r.stderr).toMatch(/- \w+/);
  });
});

// ── 4. --baseline with missing file exits 2 ───────────────────────────────────

describe("validate --baseline with missing file", () => {
  it("exits 2 when the baseline file does not exist", () => {
    const r = cli(
      "validate",
      "--baseline",
      "/nonexistent-flaglint-baseline-xyz/baseline.json",
      ENTERPRISE_SRC
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("not found");
  });
});

// ── 5. --baseline with malformed JSON exits 2 ────────────────────────────────

describe("validate --baseline with malformed JSON", () => {
  it("exits 2 when the baseline file contains invalid JSON", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");
    writeFileSync(baselineFile, "{ not valid json }", "utf8");

    const r = cli("validate", "--baseline", baselineFile, ENTERPRISE_SRC);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Invalid JSON");
  });

  it("exits 2 when the baseline has wrong version", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");
    const badVersion = {
      version: "99",
      createdAt: new Date().toISOString(),
      flaglintVersion: "0.9.0",
      fingerprints: [],
    };
    writeFileSync(baselineFile, JSON.stringify(badVersion, null, 2), "utf8");

    const r = cli("validate", "--baseline", baselineFile, ENTERPRISE_SRC);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Unsupported baseline version");
  });

  it("exits 2 when the baseline has missing fingerprints array", () => {
    const dir = makeTmpDir();
    const baselineFile = join(dir, "baseline.json");
    const missingFingerprints = {
      version: "1",
      createdAt: new Date().toISOString(),
      flaglintVersion: "0.9.0",
    };
    writeFileSync(baselineFile, JSON.stringify(missingFingerprints, null, 2), "utf8");

    const r = cli("validate", "--baseline", baselineFile, ENTERPRISE_SRC);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("fingerprints");
  });
});
