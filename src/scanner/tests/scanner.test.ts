import { describe, it, expect } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scan } from "../index.js";
import { FlagLintConfigSchema } from "../../config.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function cfg(filename: string) {
  return FlagLintConfigSchema.parse({ include: [filename], exclude: [] });
}

describe("scanner — ld-basic.ts", () => {
  it("detects ldClient.variation() with correct callType", async () => {
    const result = await scan(FIXTURES, cfg("ld-basic.ts"));
    const variationUsages = result.usages.filter((u) => u.callType === "variation");
    expect(variationUsages.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts string literal flag key as isDynamic: false", async () => {
    const result = await scan(FIXTURES, cfg("ld-basic.ts"));
    const banner = result.usages.find((u) => u.flagKey === "show-banner");
    expect(banner).toBeDefined();
    expect(banner!.isDynamic).toBe(false);
    expect(banner!.callType).toBe("variation");
  });

  it("reports correct file path", async () => {
    const result = await scan(FIXTURES, cfg("ld-basic.ts"));
    expect(result.usages.every((u) => u.file.includes("ld-basic.ts"))).toBe(true);
  });

  it("reports correct line number (1-indexed)", async () => {
    const result = await scan(FIXTURES, cfg("ld-basic.ts"));
    const banner = result.usages.find((u) => u.flagKey === "show-banner");
    expect(banner!.line).toBe(3);
  });

  it("detects variationDetail with correct callType", async () => {
    const result = await scan(FIXTURES, cfg("ld-basic.ts"));
    const detail = result.usages.find((u) => u.callType === "variationDetail");
    expect(detail).toBeDefined();
    expect(detail!.flagKey).toBe("premium-price");
  });

  it("populates uniqueFlags with static flag keys only", async () => {
    const result = await scan(FIXTURES, cfg("ld-basic.ts"));
    expect(result.uniqueFlags).toContain("show-banner");
    expect(result.uniqueFlags).toContain("ui-theme");
    expect(result.uniqueFlags).toContain("premium-price");
  });
});

describe("scanner — ld-dynamic.ts", () => {
  it("marks variable flag key as isDynamic: true", async () => {
    const result = await scan(FIXTURES, cfg("ld-dynamic.ts"));
    const dynamic = result.usages.find((u) => u.callType === "variation");
    expect(dynamic).toBeDefined();
    expect(dynamic!.isDynamic).toBe(true);
    expect(dynamic!.flagKey).toBe("dynamic");
  });

  it("detects allFlags() with flagKey '*'", async () => {
    const result = await scan(FIXTURES, cfg("ld-dynamic.ts"));
    const allFlags = result.usages.find((u) => u.callType === "allFlags");
    expect(allFlags).toBeDefined();
    expect(allFlags!.flagKey).toBe("*");
    expect(allFlags!.isDynamic).toBe(false);
  });

  it("does not add dynamic keys to uniqueFlags", async () => {
    const result = await scan(FIXTURES, cfg("ld-dynamic.ts"));
    expect(result.uniqueFlags).not.toContain("dynamic");
  });
});

describe("scanner — ld-react.tsx", () => {
  it("detects useFlags() hook", async () => {
    const result = await scan(FIXTURES, cfg("ld-react.tsx"));
    const hook = result.usages.find((u) => u.callType === "hook-useFlags");
    expect(hook).toBeDefined();
    expect(hook!.flagKey).toBe("*");
  });

  it("detects useLDClient() hook", async () => {
    const result = await scan(FIXTURES, cfg("ld-react.tsx"));
    const hook = result.usages.find((u) => u.callType === "hook-useLDClient");
    expect(hook).toBeDefined();
  });

  it("detects LDProvider JSX usage", async () => {
    const result = await scan(FIXTURES, cfg("ld-react.tsx"));
    const provider = result.usages.find((u) => u.callType === "provider");
    expect(provider).toBeDefined();
    expect(provider!.flagKey).toBe("*");
  });

  it("detects withLDConsumer HOC pattern", async () => {
    const result = await scan(FIXTURES, cfg("ld-react.tsx"));
    const hoc = result.usages.find((u) => u.callType === "hoc");
    expect(hoc).toBeDefined();
    expect(hoc!.flagKey).toBe("*");
  });
});

describe("scanner — ld-stale.ts", () => {
  it("marks flag with 'old' in key as isStale: true", async () => {
    const result = await scan(FIXTURES, cfg("ld-stale.ts"));
    const oldFlag = result.usages.find((u) => u.flagKey === "old-checkout");
    expect(oldFlag).toBeDefined();
    expect(oldFlag!.isStale).toBe(true);
  });

  it("marks flag with 'temp' in key as isStale: true", async () => {
    const result = await scan(FIXTURES, cfg("ld-stale.ts"));
    const tempFlag = result.usages.find((u) => u.flagKey === "temp-debug-mode");
    expect(tempFlag).toBeDefined();
    expect(tempFlag!.isStale).toBe(true);
  });

  it("marks all stale fixture flags as stale", async () => {
    const result = await scan(FIXTURES, cfg("ld-stale.ts"));
    expect(result.usages.length).toBe(2);
    expect(result.usages.every((u) => u.isStale)).toBe(true);
  });
});

describe("scanner — no-ld.ts", () => {
  it("returns empty usages for file with no LD usage", async () => {
    const result = await scan(FIXTURES, cfg("no-ld.ts"));
    expect(result.usages).toHaveLength(0);
    expect(result.totalUsages).toBe(0);
  });

  it("still counts the file as scanned", async () => {
    const result = await scan(FIXTURES, cfg("no-ld.ts"));
    expect(result.scannedFiles).toBe(1);
  });
});

describe("scanner — syntax-error.ts", () => {
  it("does not throw on a file with syntax errors", async () => {
    await expect(scan(FIXTURES, cfg("syntax-error.ts"))).resolves.not.toThrow();
  });

  it("skips the broken file and returns zero usages", async () => {
    const result = await scan(FIXTURES, cfg("syntax-error.ts"));
    expect(result.usages).toHaveLength(0);
  });

  it("still counts the broken file as scanned", async () => {
    const result = await scan(FIXTURES, cfg("syntax-error.ts"));
    expect(result.scannedFiles).toBe(1);
  });
});

describe("scanner — scan() metadata", () => {
  it("returns scanDurationMs >= 0", async () => {
    const result = await scan(FIXTURES, cfg("no-ld.ts"));
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("fires onProgress callback per file", async () => {
    const calls: number[] = [];
    await scan(FIXTURES, cfg("ld-basic.ts"), (n) => calls.push(n));
    expect(calls).toEqual([1]);
  });
});
