import type { FileSource, MigrationAnalysis, MigrationInventoryItem, MigrationValueType } from "../types.js";

type Replacement = {
  item: MigrationInventoryItem;
  replacement: string;
  requiresProviderSetup: true;
};

type SkippedUsage = {
  item: MigrationInventoryItem;
  reason: string;
};

const DETAIL_METHODS = new Set([
  "variationDetail",
  "boolVariationDetail",
  "stringVariationDetail",
  "numberVariationDetail",
  "jsonVariationDetail",
]);

function methodForType(valueType: MigrationValueType): string | null {
  switch (valueType) {
    case "boolean":
      return "getBooleanValue";
    case "string":
      return "getStringValue";
    case "number":
      return "getNumberValue";
    case "object":
      return "getObjectValue";
    case "unknown":
      return null;
  }
}

function manualReason(item: MigrationInventoryItem): string {
  if (item.manualReviewReason === "dynamic-key") return "dynamic key requires manual review";
  if (item.manualReviewReason === "unknown-fallback") return "unknown fallback type requires manual review";
  if (item.manualReviewReason === "bulk-inventory-call") return "bulk inventory call has no single-flag codemod";
  return "manual review required";
}

function buildReplacement(item: MigrationInventoryItem): Replacement | SkippedUsage {
  if (DETAIL_METHODS.has(item.launchDarklyMethod)) {
    return {
      item,
      reason:
        "detail methods skipped: OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires manual review",
    };
  }

  if (!item.safelyAutomatable) {
    return { item, reason: manualReason(item) };
  }

  if (item.rangeStart == null || item.rangeEnd == null || !item.callExpression) {
    return { item, reason: "missing source range for reviewable diff" };
  }

  if (!item.flagKeyExpression || !item.fallbackExpression || !item.evaluationContextExpression) {
    return { item, reason: "missing flag key, fallback, or evaluation context evidence" };
  }

  const method = methodForType(item.valueType);
  if (!method) return { item, reason: "unsupported or unknown value type" };

  const call = `openFeatureClient.${method}(${item.flagKeyExpression}, ${item.fallbackExpression}, ${item.evaluationContextExpression})`;
  // The `await` keyword (if any) sits outside the CallExpression range and is
  // preserved verbatim by applyReplacements — never inject `await` here.
  // Awaited LD call  → source already has `await <call>`; replacement keeps it.
  // Non-awaited call → source has no `await`; replacement must not add one.
  return {
    item,
    replacement: call,
    requiresProviderSetup: true,
  };
}

function applyReplacements(code: string, replacements: Replacement[]): string {
  let next = code;
  for (const replacement of [...replacements].sort((a, b) => b.item.rangeStart! - a.item.rangeStart!)) {
    next =
      next.slice(0, replacement.item.rangeStart!) +
      replacement.replacement +
      next.slice(replacement.item.rangeEnd!);
  }
  return next;
}

function changedLineNumbers(before: string[], after: string[]): number[] {
  const changed: number[] = [];
  const length = Math.max(before.length, after.length);
  for (let i = 0; i < length; i++) {
    if (before[i] !== after[i]) changed.push(i);
  }
  return changed;
}

function formatFileDiff(file: string, beforeCode: string, afterCode: string): string[] {
  const before = beforeCode.split("\n");
  const after = afterCode.split("\n");
  const changed = changedLineNumbers(before, after);
  if (changed.length === 0) return [];

  const lines: string[] = [];
  lines.push(`diff --git a/${file} b/${file}`);
  lines.push(`--- a/${file}`);
  lines.push(`+++ b/${file}`);

  for (const index of changed) {
    const oldLine = before[index] ?? "";
    const newLine = after[index] ?? "";
    lines.push(`@@ -${index + 1},1 +${index + 1},1 @@`);
    lines.push(`-${oldLine}`);
    lines.push(`+${newLine}`);
  }

  return lines;
}

function itemLabel(item: MigrationInventoryItem): string {
  return item.staticFlagKey ?? item.flagKeyExpression ?? "*";
}

/**
 * Emit the manual provider-setup section.
 *
 * Rules enforced here:
 * - LaunchDarkly is stated as the ongoing provider, not something to remove.
 * - Three packages are listed; no removal instruction is emitted.
 * - The initialization snippet is marked "do not edit automatically".
 * - The targeting-key requirement is called out explicitly.
 */
function formatProviderSetupSection(): string[] {
  const lines: string[] = [];

  lines.push("## Provider Setup (Required Before Applying Diffs)");
  lines.push("");
  lines.push("LaunchDarkly remains your feature flag provider.");
  lines.push("OpenFeature becomes the evaluation API your application code calls.");
  lines.push("You add one initialization step; **do not remove any LaunchDarkly packages** —");
  lines.push("the OpenFeature provider depends on them at runtime.");
  lines.push("");

  lines.push("### 1. Install packages");
  lines.push("");
  lines.push("```sh");
  lines.push(
    "npm install @openfeature/server-sdk @launchdarkly/node-server-sdk @launchdarkly/openfeature-node-server"
  );
  lines.push("```");
  lines.push("");

  lines.push("### 2. Initialize once at application startup");
  lines.push("");
  lines.push("Add the following to your application bootstrap (do not apply automatically):");
  lines.push("");
  lines.push("```typescript");
  lines.push('import { OpenFeature } from "@openfeature/server-sdk";');
  lines.push('import { LaunchDarklyProvider } from "@launchdarkly/openfeature-node-server";');
  lines.push("");
  lines.push('const ldProvider = new LaunchDarklyProvider("<your-sdk-key>");');
  lines.push("await OpenFeature.setProviderAndWait(ldProvider);");
  lines.push("");
  lines.push("// Share this client across your application.");
  lines.push("// Replace the `openFeatureClient` placeholder in the diffs below.");
  lines.push("const openFeatureClient = OpenFeature.getClient();");
  lines.push("```");
  lines.push("");

  lines.push("### 3. Evaluation context — targeting key");
  lines.push("");
  lines.push("LaunchDarkly requires a `targetingKey` field in every evaluation context.");
  lines.push("Replace the context arguments shown in the diffs with an object that includes it:");
  lines.push("");
  lines.push("```typescript");
  lines.push("{ targetingKey: user.key, ...otherAttributes }");
  lines.push("```");
  lines.push("");

  return lines;
}

export async function formatDryRunDiff(analysis: MigrationAnalysis, source: FileSource): Promise<string> {
  const replacementsByFile = new Map<string, Replacement[]>();
  const skipped: SkippedUsage[] = [];

  for (const item of analysis.inventoryItems) {
    const result = buildReplacement(item);
    if ("reason" in result) {
      skipped.push(result);
      continue;
    }

    if (!replacementsByFile.has(item.file)) replacementsByFile.set(item.file, []);
    replacementsByFile.get(item.file)!.push(result);
  }

  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push("# FlagLint migrate --dry-run");
  lines.push("");
  lines.push(
    "These diffs use the placeholder `openFeatureClient` and require OpenFeature provider/client setup before they can be applied."
  );
  lines.push("No files are modified by dry-run output.");
  lines.push("");
  lines.push(`Reviewable diffs: ${[...replacementsByFile.values()].reduce((sum, items) => sum + items.length, 0)}`);
  lines.push(
    `Diffs requiring provider setup: ${[...replacementsByFile.values()].reduce((sum, items) => sum + items.filter((item) => item.requiresProviderSetup).length, 0)}`
  );
  lines.push(`Skipped usages: ${skipped.length}`);
  lines.push("");

  // ── Provider setup guidance (always present; must be done before applying diffs) ──
  lines.push(...formatProviderSetupSection());

  // ── Call-site diffs ───────────────────────────────────────────────────────
  if (replacementsByFile.size > 0) {
    lines.push("## Diffs");
    lines.push("```diff");
    for (const [file, replacements] of [...replacementsByFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const before = await source.readFile(file);
      const after = applyReplacements(before, replacements);
      lines.push(...formatFileDiff(file, before, after));
    }
    lines.push("```");
    lines.push("");
  }

  // ── Skipped / manual-review usages ───────────────────────────────────────
  if (skipped.length > 0) {
    lines.push("## Skipped Usages");
    for (const { item, reason } of skipped) {
      lines.push(`- ${item.file}:${item.line}:${item.column} — \`${itemLabel(item)}\` via \`${item.launchDarklyMethod}\`: ${reason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
