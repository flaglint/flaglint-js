import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTRY = join(ROOT, "dist/bin/flaglint.js");

function cli(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [ENTRY, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 15000,
  });
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

function makeTmpDir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "flaglint-init-test-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

describe("CLI — flaglint init", () => {
  it("creates flaglint.config.json with default content", () => {
    const dir = makeTmpDir();
    const r = cli(dir, "init");

    expect(r.status).toBe(0);

    const configPath = join(dir, "flaglint.config.json");
    expect(existsSync(configPath)).toBe(true);

    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(parsed).toHaveProperty("include");
    expect(parsed).toHaveProperty("exclude");
    expect(parsed).toHaveProperty("provider", "launchdarkly");
    expect(parsed).toHaveProperty("minFileCount", 0);
    expect(parsed).toHaveProperty("wrappers");
    expect(parsed).toHaveProperty("openFeatureClientBindings");
  });

  it("writes valid JSON that flaglint can parse", () => {
    const dir = makeTmpDir();
    cli(dir, "init");

    // Run a scan using the generated config — should not error on config parse
    const r = cli(dir, "scan", dir);
    expect(r.status).not.toBe(2); // exit 2 = invalid input, would mean config parse failed
  });

  it("exits 0 and prints the config filename in stderr", () => {
    const dir = makeTmpDir();
    const r = cli(dir, "init");

    expect(r.status).toBe(0);
    expect(r.stderr).toContain("flaglint.config.json");
  });

  it("accepts --output to write to a custom filename", () => {
    const dir = makeTmpDir();
    const r = cli(dir, "init", "--output", ".flaglintrc.json");

    expect(r.status).toBe(0);
    expect(existsSync(join(dir, ".flaglintrc.json"))).toBe(true);
    expect(existsSync(join(dir, "flaglint.config.json"))).toBe(false);
  });

  it("exits 2 if config file already exists", () => {
    const dir = makeTmpDir({ "flaglint.config.json": "{}" });
    const r = cli(dir, "init");

    expect(r.status).toBe(2);
    expect(r.stderr).toContain("already exists");
  });

  it("--force overwrites an existing config file", () => {
    const dir = makeTmpDir({ "flaglint.config.json": '{"include":[]}' });
    const r = cli(dir, "init", "--force");

    expect(r.status).toBe(0);
    const parsed = JSON.parse(readFileSync(join(dir, "flaglint.config.json"), "utf8")) as Record<string, unknown>;
    expect(Array.isArray(parsed["include"])).toBe(true);
    expect((parsed["include"] as string[]).length).toBeGreaterThan(0);
  });

  it("warns when a higher-precedence config exists (.flaglintrc shadows flaglint.config.json)", () => {
    // .flaglintrc (index 0) has higher precedence than flaglint.config.json (index 2)
    const dir = makeTmpDir({ ".flaglintrc": "{}" });
    const r = cli(dir, "init"); // writes flaglint.config.json

    expect(r.status).toBe(0);
    expect(r.stderr).toContain("warn");
    expect(r.stderr).toContain("takes precedence");
    expect(existsSync(join(dir, "flaglint.config.json"))).toBe(true);
  });

  it("does not warn when only a lower-precedence config exists", () => {
    // flaglint.config.json (index 2) has lower precedence than .flaglintrc.json (index 1)
    // so creating .flaglintrc.json should NOT warn about flaglint.config.json
    const dir = makeTmpDir({ "flaglint.config.json": "{}" });
    const r = cli(dir, "init", "--output", ".flaglintrc.json");

    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain("warn");
    expect(existsSync(join(dir, ".flaglintrc.json"))).toBe(true);
  });
});
