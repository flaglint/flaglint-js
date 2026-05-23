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
  it("returns defaults when config path does not exist", async () => {
    const config = await loadConfig("/nonexistent/flaglint-config-xyz.json");
    expect(config.provider).toBe("launchdarkly");
    expect(config.minFileCount).toBe(1);
    expect(config.outputDir).toBe(".");
    expect(Array.isArray(config.include)).toBe(true);
    expect(Array.isArray(config.exclude)).toBe(true);
  });

  it("default include contains ts/tsx/js/jsx glob", async () => {
    const config = await loadConfig("/nonexistent/config.json");
    expect(config.include.some((p) => p.includes("{ts,tsx,js,jsx}"))).toBe(true);
  });

  it("default exclude contains node_modules pattern", async () => {
    const config = await loadConfig("/nonexistent/config.json");
    expect(config.exclude.some((p) => p.includes("node_modules"))).toBe(true);
  });

  it("reportTitle is undefined by default", async () => {
    const config = await loadConfig("/nonexistent/config.json");
    expect(config.reportTitle).toBeUndefined();
  });
});

describe("loadConfig — partial config merges with defaults", () => {
  it("overrides reportTitle while keeping other defaults", async () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { reportTitle: "My Project" });
    const config = await loadConfig(path);
    expect(config.reportTitle).toBe("My Project");
    expect(config.provider).toBe("launchdarkly");
    expect(config.minFileCount).toBe(1);
  });

  it("overrides provider while keeping other defaults", async () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { provider: "unleash" });
    const config = await loadConfig(path);
    expect(config.provider).toBe("unleash");
    expect(config.outputDir).toBe(".");
  });

  it("overrides include array", async () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { include: ["**/*.ts"] });
    const config = await loadConfig(path);
    expect(config.include).toEqual(["**/*.ts"]);
  });

  it("overrides minFileCount", async () => {
    const path = tracked(`flaglint-test-${Date.now()}.json`, { minFileCount: 30 });
    const config = await loadConfig(path);
    expect(config.minFileCount).toBe(30);
  });
});

describe("loadConfig — invalid config throws clear error", () => {
  it("throws when minFileCount is negative", async () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { minFileCount: -1 });
    await expect(loadConfig(path)).rejects.toThrow(/Error in/);
  });

  it("throws when provider is an unknown value", async () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { provider: "unknown-provider" });
    await expect(loadConfig(path)).rejects.toThrow(/Error in/);
  });

  it("throws when include is not an array", async () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { include: "**/*.ts" });
    await expect(loadConfig(path)).rejects.toThrow(/Error in/);
  });

  it("error message contains the field name for clarity", async () => {
    const path = tracked(`flaglint-bad-${Date.now()}.json`, { minFileCount: -99 });
    let msg = "";
    try {
      await loadConfig(path);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("minFileCount");
  });

  it("throws when file contains invalid JSON", async () => {
    const p = join(tmpdir(), `flaglint-invalid-json-${Date.now()}.json`);
    writeFileSync(p, "{ not valid json }", "utf8");
    created.push(p);
    await expect(loadConfig(p)).rejects.toThrow(/Error reading/);
  });
});
