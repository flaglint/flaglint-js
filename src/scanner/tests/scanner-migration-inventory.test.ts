import { describe, expect, it } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scan } from "../index.js";
import { LocalFileSource } from "../local-source.js";
import { FlagLintConfigSchema } from "../../config.js";
import type { MigrationInventoryItem, ScanResult } from "../../types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function cfg(filename: string) {
  return FlagLintConfigSchema.parse({ include: [filename], exclude: [], minFileCount: 0 });
}

async function inventory(): Promise<MigrationInventoryItem[]> {
  const result = await scanFixture();
  return result.migrationInventory ?? [];
}

async function scanFixture(): Promise<ScanResult> {
  return scan(new LocalFileSource(FIXTURES), cfg("ld-migration-inventory.ts"));
}

function byStaticKey(items: MigrationInventoryItem[], key: string): MigrationInventoryItem {
  const item = items.find((entry) => entry.staticFlagKey === key);
  expect(item).toBeDefined();
  return item!;
}

describe("scanner migration inventory", () => {
  it("does not change existing usages and uniqueFlags behavior", async () => {
    const result = await scanFixture();

    expect(result.usages).toHaveLength(13);
    expect(result.uniqueFlags).toEqual([
      "typed-bool",
      "typed-string",
      "typed-number",
      "typed-object",
      "generic-bool",
      "generic-string",
      "generic-number",
      "generic-object",
      "generic-unknown",
      "generic-detail-unknown",
    ]);
    expect(result.uniqueFlags).not.toContain("dynamic");
    expect(result.uniqueFlags).not.toContain("*");
  });

  it("maps typed LaunchDarkly methods to value types", async () => {
    const items = await inventory();

    expect(byStaticKey(items, "typed-bool")).toMatchObject({
      launchDarklyMethod: "boolVariation",
      valueType: "boolean",
      safelyAutomatable: true,
    });
    expect(byStaticKey(items, "typed-string")).toMatchObject({
      launchDarklyMethod: "stringVariationDetail",
      valueType: "string",
      safelyAutomatable: true,
    });
    expect(byStaticKey(items, "typed-number")).toMatchObject({
      launchDarklyMethod: "numberVariation",
      valueType: "number",
      safelyAutomatable: true,
    });
    expect(byStaticKey(items, "typed-object")).toMatchObject({
      launchDarklyMethod: "jsonVariationDetail",
      valueType: "object",
      safelyAutomatable: true,
    });
  });

  it("infers generic variation types from literal fallback values", async () => {
    const items = await inventory();

    expect(byStaticKey(items, "generic-bool").valueType).toBe("boolean");
    expect(byStaticKey(items, "generic-string").valueType).toBe("string");
    expect(byStaticKey(items, "generic-number").valueType).toBe("number");
    expect(byStaticKey(items, "generic-object").valueType).toBe("object");
  });

  it("preserves flag key, fallback, and evaluation context expressions", async () => {
    const items = await inventory();
    const stringDetail = byStaticKey(items, "typed-string");
    const objectFallback = byStaticKey(items, "generic-object");

    expect(stringDetail).toMatchObject({
      file: "ld-migration-inventory.ts",
      line: 11,
      column: 27,
      flagKeyExpression: "\"typed-string\"",
      fallbackExpression: "\"control\"",
      evaluationContextExpression: "orgContext",
    });
    expect(objectFallback).toMatchObject({
      flagKeyExpression: "\"generic-object\"",
      fallbackExpression: "{ mode: \"compact\" }",
      evaluationContextExpression: "orgContext",
    });
  });

  it("marks dynamic keys as manual review", async () => {
    const items = await inventory();
    const dynamic = items.find((entry) => entry.flagKeyExpression === "dynamicKey");

    expect(dynamic).toMatchObject({
      launchDarklyMethod: "boolVariation",
      staticFlagKey: undefined,
      isDynamic: true,
      valueType: "boolean",
      fallbackExpression: "false",
      evaluationContextExpression: "context",
      safelyAutomatable: false,
      manualReviewReason: "dynamic-key",
    });
  });

  it("marks generic unknown fallback values as manual review", async () => {
    const items = await inventory();

    expect(byStaticKey(items, "generic-unknown")).toMatchObject({
      launchDarklyMethod: "variation",
      valueType: "unknown",
      fallbackExpression: "fallbackFromConfig",
      safelyAutomatable: false,
      manualReviewReason: "unknown-fallback",
    });
    expect(byStaticKey(items, "generic-detail-unknown")).toMatchObject({
      launchDarklyMethod: "variationDetail",
      valueType: "unknown",
      fallbackExpression: "fallbackFromConfig",
      safelyAutomatable: false,
      manualReviewReason: "unknown-fallback",
    });
  });

  it("marks allFlags and allFlagsState calls as bulk manual review", async () => {
    const items = await inventory();
    const bulk = items.filter(
      (entry) => entry.launchDarklyMethod === "allFlags" || entry.launchDarklyMethod === "allFlagsState"
    );

    expect(bulk).toHaveLength(2);
    for (const item of bulk) {
      expect(item).toMatchObject({
        valueType: "unknown",
        evaluationContextExpression: "context",
        safelyAutomatable: false,
        manualReviewReason: "bulk-inventory-call",
      });
      expect(item.staticFlagKey).toBeUndefined();
      expect(item.flagKeyExpression).toBeUndefined();
    }
  });
});
