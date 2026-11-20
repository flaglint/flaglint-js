import type { MigrationInventoryItem, MigrationValueType } from "../types.js";

type Replacement = {
  item: MigrationInventoryItem;
  replacement: string;
};

type SkippedItem = {
  item: MigrationInventoryItem;
  reason: string;
};

export interface MigrationTextEdit {
  /** Start offset in JavaScript UTF-16 code units. */
  start: number;
  /** End offset in JavaScript UTF-16 code units. */
  end: number;
  replacement: string;
}

const DETAIL_METHODS = new Set([
  "variationDetail",
  "boolVariationDetail",
  "stringVariationDetail",
  "numberVariationDetail",
  "jsonVariationDetail",
]);

function methodForType(valueType: MigrationValueType): string | null {
  switch (valueType) {
    case "boolean": return "getBooleanValue";
    case "string": return "getStringValue";
    case "number": return "getNumberValue";
    case "object": return "getObjectValue";
    case "unknown": return null;
  }
}

function buildReplacement(
  item: MigrationInventoryItem,
  code: string,
  clientBindingName: string
): Replacement | SkippedItem {
  if (DETAIL_METHODS.has(item.launchDarklyMethod)) {
    return {
      item,
      reason:
        "detail methods skipped: OpenFeature detail result parity requires manual review",
    };
  }

  if (!item.safelyAutomatable) {
    return { item, reason: "manual review required" };
  }

  if (item.rangeStart == null || item.rangeEnd == null || !item.callExpression) {
    return { item, reason: "missing source range for apply" };
  }

  if (code.slice(item.rangeStart, item.rangeEnd) !== item.callExpression) {
    return {
      item,
      reason:
        "range content does not match original call — already transformed or stale analysis",
    };
  }

  if (!item.flagKeyExpression || !item.fallbackExpression || !item.evaluationContextExpression) {
    return { item, reason: "missing flag key, fallback, or evaluation context evidence" };
  }

  const method = methodForType(item.valueType);
  if (!method) return { item, reason: "unsupported or unknown value type" };

  return {
    item,
    replacement:
      `${clientBindingName}.${method}(${item.flagKeyExpression}, ${item.fallbackExpression}, ${item.evaluationContextExpression})`,
  };
}

/**
 * Plan safe edits after the caller has proven one OpenFeature client binding.
 *
 * This module intentionally has no parser, filesystem, or process dependency
 * so the CLI and sandboxed distribution adapters can share replacement logic.
 */
export function planMigrationEditsForBinding(
  code: string,
  items: MigrationInventoryItem[],
  clientBindingName: string
): MigrationTextEdit[] {
  const edits: MigrationTextEdit[] = [];
  for (const item of items) {
    const result = buildReplacement(item, code, clientBindingName);
    if ("reason" in result) continue;
    edits.push({
      start: result.item.rangeStart!,
      end: result.item.rangeEnd!,
      replacement: result.replacement,
    });
  }
  return edits;
}
