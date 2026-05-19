import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig } from "../../config.js";

function tmpFile(name: string, content: unknown): string {
  const p = join(tmpdir(), name);
  writeFileSync(p, JSON.stringify(content), "utf8");
  return p;
}

const created: string[] = [];

function tracked(name: string, content: unknown): string {
  const p = tmpFile(name, content);
  created.push(p);
  return p;
}

afterEach(() => {
  for (const p of created.splice(0)) {
    if (existsSync(p)) unlinkSync(p);
  }
});

describe("loadConfig — defaults", () => {
  it("returns defaults when config path does not exist", () => {
    const config = loadConfig("/nonexistent/flaglint-config-xyz.json");
    expect(config.provider).toBe("launchdarkly");
    expect(config.staleThreshold).toBe(1);
    expect(config.outputDir).toBe(".");
    expect(Array.isArray(config.include)).toBe(true);
    expect(Array.isArray(config.exclude)).toBe(true);
  });

  it("default include contains ts/tsx/js/jsx glob", () => {
    const config = loadConfig("/nonexistent/config.json");
    expect(config.include.some((p) => p.includes("{ts,tsx,js,jsx}"))).toBe(true);
  });

  it("default exclude contains node_modules pattern", () => {
    const config = loadConfig("/nonexistent/config.json");
    expect(config.exclude.some((p) => p.includes("node_modules"))).toBe(true);
  });

  it("reportTitle is undefined by default", () => {
    const config = loadConfig("/nonexistent/config.json");
    expect(config.reportTitle).toBeUndefined();
  });
});

describe("loadConfig — partial config merges with defaults", () => {
  it("overrides reportTitle while keeping other defaults", () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { reportTitle: "My Project" });
    const config = loadConfig(path);
    expect(config.reportTitle).toBe("My Project");
    expect(config.provider).toBe("launchdarkly");
    expect(config.staleThreshold).toBe(1);
  });

  it("overrides provider while keeping other defaults", () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { provider: "unleash" });
    const config = loadConfig(path);
    expect(config.provider).toBe("unleash");
    expect(config.outputDir).toBe(".");
  });

  it("overrides include array", () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { include: ["**/*.ts"] });
    const config = loadConfig(path);
    expect(config.include).toEqual(["**/*.ts"]);
  });

  it("overrides staleThreshold", () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { staleThreshold: 30 });
    const config = loadConfig(path);
    expect(config.staleThreshold).toBe(30);
  });
});

describe("loadConfig — invalid config throws clear error", () => {
  it("throws when staleThreshold is negative", () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { staleThreshold: -1 });
    expect(() => loadConfig(path)).toThrow(/Error in/);
  });

  it("throws when provider is an unknown value", () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { provider: "unknown-provider" });
    expect(() => loadConfig(path)).toThrow(/Error in/);
  });

  it("throws when include is not an array", () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { include: "**/*.ts" });
    expect(() => loadConfig(path)).toThrow(/Error in/);
  });

  it("error message contains the field name for clarity", () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { staleThreshold: -99 });
    let msg = "";
    try {
      loadConfig(path);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("staleThreshold");
  });

  it("throws when file contains invalid JSON", () => {
    const p = join(tmpdir(), `flaglint-invalid-json-${Date.now()}.json`);
    writeFileSync(p, "{ not valid json }", "utf8");
    created.push(p);
    expect(() => loadConfig(p)).toThrow(/Error reading/);
  });
});
