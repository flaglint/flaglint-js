import { describe, it, expect } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scan } from "../index.js";
import { LocalFileSource } from "../local-source.js";
import { FlagLintConfigSchema } from "../../config.js";
import { isStale } from "../../types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function cfg(filename: string) {
  return FlagLintConfigSchema.parse({ include: [filename], exclude: [] });
}

describe("scanner — ld-basic.ts", () => {
  it("detects ldClient.variation() with correct callType", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    const variationUsages = result.usages.filter((u) => u.callType === "variation");
    expect(variationUsages.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts string literal flag key as isDynamic: false", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    const banner = result.usages.find((u) => u.flagKey === "show-banner");
    expect(banner).toBeDefined();
    expect(banner!.isDynamic).toBe(false);
    expect(banner!.callType).toBe("variation");
  });

  it("reports correct file path", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    expect(result.usages.every((u) => u.file.includes("ld-basic.ts"))).toBe(true);
  });

  it("reports correct line number (1-indexed)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    const banner = result.usages.find((u) => u.flagKey === "show-banner");
    expect(banner!.line).toBe(3);
  });

  it("detects variationDetail with correct callType", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    const detail = result.usages.find((u) => u.callType === "variationDetail");
    expect(detail).toBeDefined();
    expect(detail!.flagKey).toBe("premium-price");
  });

  it("populates uniqueFlags with static flag keys only", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    expect(result.uniqueFlags).toContain("show-banner");
    expect(result.uniqueFlags).toContain("ui-theme");
    expect(result.uniqueFlags).toContain("premium-price");
  });
});

describe("scanner — ld-dynamic.ts", () => {
  it("marks variable flag key as isDynamic: true", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-dynamic.ts"));
    const dynamic = result.usages.find((u) => u.callType === "variation");
    expect(dynamic).toBeDefined();
    expect(dynamic!.isDynamic).toBe(true);
    expect(dynamic!.flagKey).toBe("dynamic");
  });

  it("detects allFlags() with flagKey '*'", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-dynamic.ts"));
    const allFlags = result.usages.find((u) => u.callType === "allFlags");
    expect(allFlags).toBeDefined();
    expect(allFlags!.flagKey).toBe("*");
    expect(allFlags!.isDynamic).toBe(false);
  });

  it("does not add dynamic keys to uniqueFlags", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-dynamic.ts"));
    expect(result.uniqueFlags).not.toContain("dynamic");
  });
});

describe("scanner — ld-react.tsx", () => {
  it("detects useFlags() hook", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-react.tsx"));
    const hook = result.usages.find((u) => u.callType === "hook-useFlags");
    expect(hook).toBeDefined();
    expect(hook!.flagKey).toBe("*");
  });

  it("detects useLDClient() hook", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-react.tsx"));
    const hook = result.usages.find((u) => u.callType === "hook-useLDClient");
    expect(hook).toBeDefined();
  });

  it("detects LDProvider JSX usage", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-react.tsx"));
    const provider = result.usages.find((u) => u.callType === "provider");
    expect(provider).toBeDefined();
    expect(provider!.flagKey).toBe("*");
  });

  it("detects withLDConsumer HOC pattern", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-react.tsx"));
    const hoc = result.usages.find((u) => u.callType === "hoc");
    expect(hoc).toBeDefined();
    expect(hoc!.flagKey).toBe("*");
  });
});

describe("scanner — ld-stale.ts", () => {
  it("marks flag with 'old' in key as isStale: true", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-stale.ts"));
    const oldFlag = result.usages.find((u) => u.flagKey === "old-checkout");
    expect(oldFlag).toBeDefined();
    expect(isStale(oldFlag!)).toBe(true);
  });

  it("marks flag with 'temp' in key as isStale: true", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-stale.ts"));
    const tempFlag = result.usages.find((u) => u.flagKey === "temp-debug-mode");
    expect(tempFlag).toBeDefined();
    expect(isStale(tempFlag!)).toBe(true);
  });

  it("marks all stale fixture flags as stale", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-stale.ts"));
    expect(result.usages.length).toBe(2);
    expect(result.usages.every(isStale)).toBe(true);
  });
});

describe("scanner — no-ld.ts", () => {
  it("returns empty usages for file with no LD usage", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("no-ld.ts"));
    expect(result.usages).toHaveLength(0);
    expect(result.totalUsages).toBe(0);
  });

  it("still counts the file as scanned", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("no-ld.ts"));
    expect(result.scannedFiles).toBe(1);
  });
});

describe("scanner — syntax-error.ts", () => {
  it("does not throw on a file with syntax errors", async () => {
    await expect(scan(new LocalFileSource(FIXTURES), cfg("syntax-error.ts"))).resolves.not.toThrow();
  });

  it("skips the broken file and returns zero usages", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("syntax-error.ts"));
    expect(result.usages).toHaveLength(0);
  });

  it("still counts the broken file as scanned", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("syntax-error.ts"));
    expect(result.scannedFiles).toBe(1);
  });
});

describe("scanner — --exclude-tests patterns", () => {
  it("excludes .test.tsx fixture when test patterns are in config.exclude", async () => {
    const config = FlagLintConfigSchema.parse({
      include: ["ld-provider-test-file.test.tsx"],
      exclude: ["**/*.test.tsx"],
    });
    const result = await scan(new LocalFileSource(FIXTURES), config);
    expect(result.usages).toHaveLength(0);
    expect(result.scannedFiles).toBe(0);
  });
});

describe("scanner — provider in test file", () => {
  it("marks LDProvider usage in test file as isStale: true", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-provider-test-file.test.tsx"));
    const provider = result.usages.find((u) => u.callType === "provider");
    expect(provider).toBeDefined();
    expect(provider!.flagKey).toBe("*");
    expect(isStale(provider!)).toBe(true);
  });
});

describe("scanner — scan() metadata", () => {
  it("returns scanDurationMs >= 0", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("no-ld.ts"));
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("fires onProgress callback per file", async () => {
    const calls: number[] = [];
    await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"), (n) => calls.push(n));
    expect(calls).toEqual([1]);
  });
});

describe("scanner — template literal flag keys", () => {
  it("extracts static template literal as isDynamic: false", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-template-literal.ts"));
    const u = result.usages[0];
    expect(u?.flagKey).toBe("show-banner");
    expect(u?.isDynamic).toBe(false);
    expect(u?.callType).toBe("variation");
  });
});

describe("scanner — isFeatureEnabled", () => {
  it("detects isFeatureEnabled() with a static key", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-is-feature-enabled.ts"));
    const u = result.usages.find((u) => u.callType === "isFeatureEnabled" && !u.isDynamic);
    expect(u).toBeDefined();
    expect(u?.flagKey).toBe("is-premium-user");
    expect(u?.isDynamic).toBe(false);
  });

  it("detects isFeatureEnabled() with a dynamic key", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-is-feature-enabled.ts"));
    const u = result.usages.find((u) => u.callType === "isFeatureEnabled" && u.isDynamic);
    expect(u).toBeDefined();
    expect(u?.flagKey).toBe("dynamic");
  });

  it("static isFeatureEnabled key appears in uniqueFlags", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-is-feature-enabled.ts"));
    expect(result.uniqueFlags).toContain("is-premium-user");
  });
});

describe("scanner — LD_CLIENT_PATTERN false positive guard", () => {
  it("does NOT detect build.variation() as an LD call (false positive guard)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-false-positive-build.ts"));
    expect(result.usages).toHaveLength(0);
    expect(result.totalUsages).toBe(0);
  });

  it("still detects ldClient.variation() correctly (true positive)", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    expect(result.usages.length).toBeGreaterThan(0);
    expect(result.usages.every((u) => u.file.includes("ld-basic.ts"))).toBe(true);
  });

  it("still detects LDClient-named objects (starts with LD, case insensitive)", async () => {
    // ld-basic.ts uses ldClient — tests that ^ld anchor still matches correctly
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-basic.ts"));
    const variation = result.usages.find((u) => u.callType === "variation");
    expect(variation).toBeDefined();
  });
});

describe("scanner — generic arrow function parse fix", () => {
  it("parses generic arrow function in .ts file without warnings", async () => {
    const result = await scan(new LocalFileSource(FIXTURES), cfg("ld-generic-ts.ts"));
    expect(result.warnings).toHaveLength(0);
    expect(result.scannedFiles).toBe(1);
  });
});

describe("scanner — wrapper functions", () => {
  it("detects wrapper function calls when wrappers config is set", async () => {
    const config = FlagLintConfigSchema.parse({
      include: ["ld-wrapper.ts"],
      exclude: [],
      wrappers: ["flagPredicate"],
    });
    const result = await scan(new LocalFileSource(FIXTURES), config);
    expect(result.uniqueFlags).toContain("show-banner");
    expect(result.uniqueFlags).toContain("enable-dark-mode");
    expect(result.totalUsages).toBe(3);
    const dynamic = result.usages.find((u) => u.isDynamic);
    expect(dynamic).toBeDefined();
  });

  it("does not detect wrapper calls when wrappers config is empty", async () => {
    const config = FlagLintConfigSchema.parse({
      include: ["ld-wrapper.ts"],
      exclude: [],
      wrappers: [],
    });
    const result = await scan(new LocalFileSource(FIXTURES), config);
    expect(result.uniqueFlags).not.toContain("show-banner");
    expect(result.totalUsages).toBe(0);
  });

  it("wrapper static key appears in uniqueFlags", async () => {
    const config = FlagLintConfigSchema.parse({
      include: ["ld-wrapper.ts"],
      exclude: [],
      wrappers: ["flagPredicate"],
    });
    const result = await scan(new LocalFileSource(FIXTURES), config);
    expect(result.uniqueFlags).toContain("show-banner");
    expect(result.uniqueFlags).toContain("enable-dark-mode");
    expect(result.uniqueFlags).not.toContain("dynamic");
  });

  it("wrapper dynamic key is not added to uniqueFlags", async () => {
    const config = FlagLintConfigSchema.parse({
      include: ["ld-wrapper.ts"],
      exclude: [],
      wrappers: ["flagPredicate"],
    });
    const result = await scan(new LocalFileSource(FIXTURES), config);
    const dynamic = result.usages.find((u) => u.isDynamic);
    expect(dynamic).toBeDefined();
    expect(dynamic!.callType).toBe("variation");
    expect(result.uniqueFlags).not.toContain("dynamic");
  });
});

describe("scanner — path-traversal protection", () => {
  it("throws on include pattern starting with '..'", async () => {
    const config = FlagLintConfigSchema.parse({ include: ["../../../etc/**"], exclude: [] });
    await expect(scan(new LocalFileSource(FIXTURES), config)).rejects.toThrow(/Invalid include pattern/);
  });

  it("throws on include pattern starting with '/'", async () => {
    const config = FlagLintConfigSchema.parse({ include: ["/etc/passwd"], exclude: [] });
    await expect(scan(new LocalFileSource(FIXTURES), config)).rejects.toThrow(/Invalid include pattern/);
  });
});
