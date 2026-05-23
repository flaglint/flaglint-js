import { describe, it, expect } from "vitest";
import { formatReport } from "../index.js";
import type { FlagUsage, ScanResult } from "../../types.js";
import { isStale } from "../../types.js";

const staleUsage: FlagUsage = {
  flagKey: "old-flag",
  isDynamic: false,
  file: "/src/legacy.ts",
  line: 5,
  column: 0,
  callType: "variation",
  stalenessSignals: [{ source: "keyword", keyword: "old" }],
};

const activeUsage: FlagUsage = {
  flagKey: "my-flag",
  isDynamic: false,
  file: "/src/Header.tsx",
  line: 10,
  column: 0,
  callType: "variation",
  stalenessSignals: [],
};

const dynamicUsage: FlagUsage = {
  flagKey: "dynamic",
  isDynamic: true,
  file: "/src/util.ts",
  line: 3,
  column: 0,
  callType: "variation",
  stalenessSignals: [],
};

const resultWithStale: ScanResult = {
  scannedFiles: 2,
  totalUsages: 3,
  uniqueFlags: ["my-flag", "old-flag"],
  usages: [activeUsage, staleUsage, dynamicUsage],
  scanDurationMs: 42,
  warnings: [],
};

const resultNoStale: ScanResult = {
  scannedFiles: 1,
  totalUsages: 1,
  uniqueFlags: ["my-flag"],
  usages: [activeUsage],
  scanDurationMs: 10,
  warnings: [],
};

// ── markdown ──────────────────────────────────────────────────────────────────

describe("reporter — markdown format", () => {
  it("contains the flag key in output", () => {
    const output = formatReport(resultWithStale, { format: "markdown" });
    expect(output).toContain("my-flag");
    expect(output).toContain("old-flag");
  });

  it("contains the stale section when stale flags exist", () => {
    const output = formatReport(resultWithStale, { format: "markdown" });
    expect(output).toContain("Stale Flag Candidates");
    expect(output).toContain("old-flag");
  });

  it("omits the stale section when no stale flags", () => {
    const output = formatReport(resultNoStale, { format: "markdown" });
    expect(output).not.toContain("Stale Flag Candidates");
  });

  it("contains dynamic section when dynamic keys exist", () => {
    const output = formatReport(resultWithStale, { format: "markdown" });
    expect(output).toContain("Dynamic Flag Keys");
  });

  it("omits dynamic section when no dynamic keys", () => {
    const output = formatReport(resultNoStale, { format: "markdown" });
    expect(output).not.toContain("Dynamic Flag Keys");
  });

  it("contains the scan summary stats", () => {
    const output = formatReport(resultWithStale, { format: "markdown" });
    expect(output).toContain("Scanned");
    expect(output).toContain("Flag usages");
    expect(output).toContain("Stale candidates");
  });

  it("stale candidates count is unique flag keys, not usage count", () => {
    // Two stale usages of the same key — count should be 1, not 2
    const staleUsage2: FlagUsage = {
      flagKey: "old-flag",
      isDynamic: false,
      file: "/src/other.ts",
      line: 20,
      column: 0,
      callType: "variation",
      stalenessSignals: [{ source: "keyword", keyword: "old" }],
    };
    const result: ScanResult = {
      scannedFiles: 2,
      totalUsages: 2,
      uniqueFlags: ["old-flag"],
      usages: [staleUsage, staleUsage2],
      scanDurationMs: 5,
      warnings: [],
    };
    const output = formatReport(result, { format: "markdown" });
    expect(output).toContain("**Stale candidates:** 1 flags flagged for review");
  });

  it("renders optional title when provided", () => {
    const output = formatReport(resultWithStale, { format: "markdown", title: "My Project" });
    expect(output).toContain("My Project");
  });

  it("stale flags appear before active flags (sorted stale-first)", () => {
    const output = formatReport(resultWithStale, { format: "markdown" });
    const staleIdx = output.indexOf("old-flag");
    const activeIdx = output.indexOf("my-flag");
    expect(staleIdx).toBeLessThan(activeIdx);
  });

  it("contains usages by file section with line number", () => {
    const output = formatReport(resultWithStale, { format: "markdown" });
    expect(output).toContain("Usages by File");
    expect(output).toContain("Line 10");
  });
});

// ── json ─────────────────────────────────────────────────────────────────────

describe("reporter — json format", () => {
  it("produces valid parseable JSON", () => {
    const output = formatReport(resultWithStale, { format: "json" });
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes generatedAt ISO timestamp at top level", () => {
    const output = formatReport(resultWithStale, { format: "json" });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("generatedAt");
    expect(typeof parsed["generatedAt"]).toBe("string");
    expect(() => new Date(parsed["generatedAt"] as string)).not.toThrow();
  });

  it("includes expected ScanResult fields", () => {
    const output = formatReport(resultWithStale, { format: "json" });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("scannedFiles");
    expect(parsed).toHaveProperty("totalUsages");
    expect(parsed).toHaveProperty("uniqueFlags");
    expect(parsed).toHaveProperty("usages");
    expect(parsed).toHaveProperty("scanDurationMs");
  });

  it("flag keys are present in usages array", () => {
    const output = formatReport(resultWithStale, { format: "json" });
    const parsed = JSON.parse(output) as { usages: Array<{ flagKey: string }> };
    const keys = parsed.usages.map((u) => u.flagKey);
    expect(keys).toContain("my-flag");
    expect(keys).toContain("old-flag");
  });
});

// ── html ─────────────────────────────────────────────────────────────────────

describe("reporter — html format", () => {
  it("produces output starting with <!DOCTYPE html>", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it("contains the flag key", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output).toContain("my-flag");
    expect(output).toContain("old-flag");
  });

  it("marks stale rows with css class", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output).toContain('class="stale"');
  });

  it("marks dynamic rows with css class", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output).toContain('class="dynamic"');
  });

  it("includes a filter input element", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output).toContain('id="filter"');
  });

  it("includes summary cards", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output).toContain("card-num");
  });

  it("includes a footer with FlagLint attribution", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output.toLowerCase()).toContain("generated by flaglint");
  });

  it("includes prefers-color-scheme media query", () => {
    const output = formatReport(resultWithStale, { format: "html" });
    expect(output).toContain("prefers-color-scheme");
  });
});
