import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/types";
import micromatch from "micromatch";
import type { FileSource, MigrationAnalysis, MigrationInventoryItem, MigrationValueType } from "../types.js";

/**
 * Returns true when the module specifier matches the glob pattern.
 * Relative traversal prefixes (./ and ../) are stripped before matching so that
 * a double-star glob like `**\/platform/feature-flags` resolves
 * `../platform/feature-flags` and `../../shared/platform/feature-flags`
 * equally, while NOT matching `../platform/feature-flags-legacy` or
 * `../other/platform/feature-flags-backup`.
 */
function moduleSpecifierMatchesGlob(specifier: string, pattern: string): boolean {
  const normalized = specifier.replace(/^(?:\.\.?\/)+/, "");
  return micromatch.isMatch(normalized, pattern);
}

const execFileAsync = promisify(execFile);

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * A FileSource that can also write files back.
 * LocalFileSource satisfies this interface; tests use MemoryWritableFileSource.
 */
export interface WritableFileSource extends FileSource {
  writeFile(path: string, content: string): Promise<void>;
}

export interface ApplyResult {
  /** Individual call-sites rewritten across all files. */
  transformed: number;
  /** Files skipped because they lacked an openFeatureClient binding. */
  skipped: number;
  /** Relative paths of files that were rewritten. */
  transformedFiles: string[];
  /** Files that were skipped and the reason for each. */
  skippedFiles: Array<{ file: string; reason: string }>;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class ApplyError extends Error {
  constructor(
    public readonly kind: "dirty-tree",
    message: string
  ) {
    super(message);
    this.name = "ApplyError";
  }
}

// ── Binding detection (AST-grounded) ─────────────────────────────────────────

const OF_SERVER_SDK = "@openfeature/server-sdk";

/**
 * Parse source text into a TSESTree AST.
 * Tries plain TypeScript (no JSX) first; falls back to TSX on parse failure.
 * Returns null when neither mode succeeds — the safe outcome is "do not apply".
 */
function tryParse(code: string): TSESTree.Program | null {
  for (const jsx of [false, true] as const) {
    try {
      return parse(code, { jsx, comment: false });
    } catch {
      /* try next mode */
    }
  }
  return null;
}

/**
 * Iterative depth-first AST walk.
 *
 * Visits every AST node in the tree.  Because only real AST nodes are in the
 * tree, text inside comments (not part of the body), string literals (parsed
 * as Literal nodes, not ImportDeclaration etc.), and template literals is
 * never mistaken for actual import/binding statements.
 */
function walkNodes(root: TSESTree.Node, visit: (node: TSESTree.Node) => void): void {
  const stack: TSESTree.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    visit(node);
    for (const val of Object.values(node)) {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item !== null && typeof item === "object" && "type" in item) {
            stack.push(item as TSESTree.Node);
          }
        }
      } else if (val !== null && typeof val === "object" && "type" in val) {
        stack.push(val as TSESTree.Node);
      }
    }
  }
}

/**
 * Returns true when the file proves an OpenFeature client binding named
 * `openFeatureClient` with known SDK provenance — grounded in the AST,
 * so text in comments, strings, or templates is never matched.
 *
 * Both conditions must hold:
 *   1. The file imports/requires the OpenFeature API from "@openfeature/server-sdk".
 *   2. A VariableDeclarator `openFeatureClient = <OpenFeatureApi>.getClient(…)` exists.
 *
 * Supported import forms:
 *   import { OpenFeature } from "@openfeature/server-sdk"            ESM
 *   import { OpenFeature as OF } from "@openfeature/server-sdk"      ESM alias
 *   const { OpenFeature } = require("@openfeature/server-sdk")       CJS
 *   const { OpenFeature: OF } = require("@openfeature/server-sdk")   CJS alias
 *
 * Rejected:
 *   - Commented-out import/binding (comments are not AST body nodes)
 *   - Import/binding text inside a string or template literal
 *   - const openFeatureClient = unrelatedValue
 *   - import { openFeatureClient } from any arbitrary module
 *   - const openFeatureClient = OpenFeature.getClient() without the SDK import
 */
/**
 * Returns the local identifier name of a proven OpenFeature client binding in
 * `code`, or `null` if none is found. Recognizes two safe patterns:
 * 1) Local initialization: `const openFeatureClient = OpenFeature.getClient()`
 *    where `OpenFeature` is imported from "@openfeature/server-sdk".
 * 2) Imported binding: `import { openFeatureClient } from "../platform/feature-flags"`
 *    or `const { openFeatureClient } = require("../platform/feature-flags")`.
 *
 * The imported-binding form only accepts relative module sources (starting
 * with `.`) to avoid treating arbitrary package imports as proven provider
 * bindings.
 */
export function getOpenFeatureClientBindingName(
  code: string,
  // Allowed bindings are declared by the user via config. Each entry names an
  // import/local identifier and a set of module path patterns that are allowed
  // sources for that identifier. If empty, imported bindings are not accepted.
  allowedBindings: Array<{ importName: string; modulePatterns: string[] }> = []
): string | null {
  const ast = tryParse(code);
  if (!ast) return null;

  // ── Pass 1: collect local names bound to the OpenFeature API object ──────────
  const ofApiNames = new Set<string>();

  for (const stmt of ast.body) {
    if (stmt.type === "ImportDeclaration" && stmt.source.value === OF_SERVER_SDK) {
      for (const spec of stmt.specifiers) {
        if (spec.type === "ImportSpecifier") {
          const importedName =
            spec.imported.type === "Identifier"
              ? (spec.imported as TSESTree.Identifier).name
              : (spec.imported as TSESTree.StringLiteral).value;
          if (importedName === "OpenFeature") {
            ofApiNames.add(spec.local.name);
          }
        }
      }
      continue;
    }

    if (stmt.type === "VariableDeclaration") {
      for (const decl of stmt.declarations) {
        const init = decl.init;
        if (
          init?.type === "CallExpression" &&
          init.callee.type === "Identifier" &&
          (init.callee as TSESTree.Identifier).name === "require" &&
          init.arguments.length === 1 &&
          init.arguments[0]?.type === "Literal" &&
          (init.arguments[0] as TSESTree.StringLiteral).value === OF_SERVER_SDK &&
          decl.id.type === "ObjectPattern"
        ) {
          for (const prop of (decl.id as TSESTree.ObjectPattern).properties) {
            if (
              prop.type === "Property" &&
              prop.key.type === "Identifier" &&
              (prop.key as TSESTree.Identifier).name === "OpenFeature" &&
              prop.value.type === "Identifier"
            ) {
              ofApiNames.add((prop.value as TSESTree.Identifier).name);
            }
          }
        }
      }
    }
  }

  // ── Pass 2: check for local initialization from OpenFeature.getClient() ─────
  const candidates: string[] = [];
  walkNodes(ast, (node) => {
    if (node.type !== "VariableDeclarator") return;

    const decl = node as TSESTree.VariableDeclarator;
    if (decl.id.type !== "Identifier") return;
    if (decl.init?.type !== "CallExpression") return;

    const call = decl.init as TSESTree.CallExpression;
    if (call.callee.type !== "MemberExpression") return;

    const member = call.callee as TSESTree.MemberExpression;
    if (member.computed) return;
    if (member.object.type !== "Identifier") return;
    if (!ofApiNames.has((member.object as TSESTree.Identifier).name)) return;
    if (member.property.type !== "Identifier") return;
    if ((member.property as TSESTree.Identifier).name !== "getClient") return;

    candidates.push(decl.id.name);
  });

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return null; // ambiguous — do not prove binding

  // ── Pass 3: check for imported/required client binding from a relative module ─
  for (const stmt of ast.body) {
    if (stmt.type === "ImportDeclaration") {
      const source = String(stmt.source.value || "");
      // Only consider relative module imports (internal project modules)
      if (!source.startsWith(".")) continue;

      for (const spec of stmt.specifiers) {
        if (spec.type === "ImportSpecifier") {
          const importedName =
            spec.imported.type === "Identifier"
              ? (spec.imported as TSESTree.Identifier).name
              : (spec.imported as TSESTree.StringLiteral).value;

          // Must be a configured importName and the source must match at least
          // one of its configured modulePatterns.
          const allowed = allowedBindings.find((b) => b.importName === importedName);
          if (!allowed) continue;
          if (!allowed.modulePatterns.some((p) => moduleSpecifierMatchesGlob(source, p))) continue;
          // record candidate
          candidates.push(spec.local.name);
        }
        if (spec.type === "ImportDefaultSpecifier") {
          const local = (spec.local as TSESTree.Identifier).name;
          const allowed = allowedBindings.find((b) => b.importName === local);
          if (!allowed) continue;
          if (!allowed.modulePatterns.some((p) => moduleSpecifierMatchesGlob(source, p))) continue;
          candidates.push(local);
        }
      }
    }

    if (stmt.type === "VariableDeclaration") {
      for (const decl of stmt.declarations) {
        const init = decl.init;
        if (
          init?.type === "CallExpression" &&
          init.callee.type === "Identifier" &&
          (init.callee as TSESTree.Identifier).name === "require" &&
          init.arguments.length === 1 &&
          init.arguments[0]?.type === "Literal"
        ) {
          const source = String((init.arguments[0] as TSESTree.StringLiteral).value || "");
          if (!source.startsWith(".")) continue;

          // const { X as Y } = require('../module')
          if (decl.id.type === "ObjectPattern") {
            for (const prop of (decl.id as TSESTree.ObjectPattern).properties) {
              if (prop.type !== "Property" || prop.key.type !== "Identifier") continue;
              const importedName = (prop.key as TSESTree.Identifier).name;
              const local = prop.value.type === "Identifier" ? (prop.value as TSESTree.Identifier).name : null;
              if (!local) continue;

              const allowed = allowedBindings.find((b) => b.importName === importedName);
              if (!allowed) continue;
              if (!allowed.modulePatterns.some((p) => moduleSpecifierMatchesGlob(source, p))) continue;
              candidates.push(local);
            }
          }
        }
      }
    }
  }

  if (candidates.length === 1) return candidates[0];
  return null;
}

export function hasOpenFeatureClientBinding(code: string): boolean {
  return getOpenFeatureClientBindingName(code) != null;
}

// ── Internal replacement types ────────────────────────────────────────────────

type Replacement = {
  item: MigrationInventoryItem;
  replacement: string;
};

type SkippedItem = {
  item: MigrationInventoryItem;
  reason: string;
};

// Detail methods: skip — parity between LD and OpenFeature detail results requires manual review.
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
    case "string":  return "getStringValue";
    case "number":  return "getNumberValue";
    case "object":  return "getObjectValue";
    case "unknown": return null;
  }
}

/**
 * Decide whether an inventory item can be automatically rewritten.
 * Returns a Replacement on success, a SkippedItem on any guard condition.
 *
 * NEVER modifies: detail methods, dynamic keys, unknown fallbacks, bulk calls.
 * PRESERVES: await (the keyword sits outside the CallExpression range and is
 * left intact by applyReplacements — do not inject it here).
 *
 * @param item  The inventory item to evaluate.
 * @param code  The current file content — used to verify the range still
 *              points at the expected LD call (stale-analysis guard).
 */
function buildReplacement(item: MigrationInventoryItem, code: string, clientBindingName: string): Replacement | SkippedItem {
  if (DETAIL_METHODS.has(item.launchDarklyMethod)) {
    return {
      item,
      reason:
        "detail methods skipped: OpenFeature detail APIs exist, but LaunchDarkly/OpenFeature detail result parity requires manual review",
    };
  }

  if (!item.safelyAutomatable) {
    const reason =
      item.manualReviewReason === "dynamic-key"
        ? "dynamic key requires manual review"
        : item.manualReviewReason === "unknown-fallback"
          ? "unknown fallback type requires manual review"
          : item.manualReviewReason === "bulk-inventory-call"
            ? "bulk inventory call has no single-flag codemod"
            : "manual review required";
    return { item, reason };
  }

  if (item.rangeStart == null || item.rangeEnd == null || !item.callExpression) {
    return { item, reason: "missing source range for apply" };
  }

  // Stale-analysis guard: verify the text at the recorded range still matches
  // the original LD call expression.  After one successful apply the range
  // points at OF code (different bytes), so this guard prevents a second
  // write and guards against misapplication of a stale analysis object.
  const currentText = code.slice(item.rangeStart, item.rangeEnd);
  if (currentText !== item.callExpression) {
    return {
      item,
      reason:
        "range content does not match original call — already transformed or stale analysis; skipping",
    };
  }

  if (!item.flagKeyExpression || !item.fallbackExpression || !item.evaluationContextExpression) {
    return { item, reason: "missing flag key, fallback, or evaluation context evidence" };
  }

  const method = methodForType(item.valueType);
  if (!method) return { item, reason: "unsupported or unknown value type" };

  // The `await` keyword (if any) sits outside the CallExpression range.
  // applyReplacements uses code.slice(0, rangeStart), which preserves the
  // outer `await ` verbatim.  Never inject `await` inside this replacement.
  const call =
    `${clientBindingName}.${method}(${item.flagKeyExpression}, ${item.fallbackExpression}, ${item.evaluationContextExpression})`;
  return { item, replacement: call };
}

/**
 * Apply replacements from last to first so earlier char-offsets are not
 * invalidated by prior edits.
 */
function applyReplacements(code: string, replacements: Replacement[]): string {
  let next = code;
  for (const r of [...replacements].sort((a, b) => b.item.rangeStart! - a.item.rangeStart!)) {
    next = next.slice(0, r.item.rangeStart!) + r.replacement + next.slice(r.item.rangeEnd!);
  }
  return next;
}

// ── Git guard ─────────────────────────────────────────────────────────────────

/**
 * Returns true when the working directory has uncommitted changes.
 * Returns false when git is unavailable or the path is not a repository — so
 * non-git projects are not blocked.
 */
async function defaultIsWorkingTreeDirty(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"]);
    return stdout.trim().length > 0;
  } catch {
    return false; // not a git repo or git not on PATH — permit apply
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Apply safe OpenFeature call-site transformations to source files.
 *
 * Safety contracts:
 * - Refuses if the git working tree is dirty (override with allowDirty).
 * - Skips any file that does not already contain an `openFeatureClient` binding.
 * - Never touches detail methods, dynamic keys, unknown fallbacks, or bulk calls.
 * - Preserves the `await` keyword exactly as it appeared in the original source.
 * - Idempotent: if a file was already transformed, re-scanning finds no LD calls
 *   → inventoryItems is empty → apply makes no changes.
 */
export async function applyMigration(
  analysis: MigrationAnalysis,
  source: WritableFileSource,
  options: {
    allowDirty?: boolean;
    /**
     * Injectable for tests — defaults to running `git status --porcelain`.
     * Return true to simulate a dirty working tree.
     */
    isWorkingTreeDirty?: () => Promise<boolean>;
    /**
     * Optional list of configured OpenFeature client bindings the project
     * declares.  When provided, imported bindings that match these entries are
     * accepted as proven safe by getOpenFeatureClientBindingName.
     */
    allowedOpenFeatureClientBindings?: Array<{ importName: string; modulePatterns: string[] }>;
  } = {}
): Promise<ApplyResult> {
  // ── 1. Dirty-tree guard ────────────────────────────────────────────────────
  if (!options.allowDirty) {
    const checkDirty = options.isWorkingTreeDirty ?? defaultIsWorkingTreeDirty;
    if (await checkDirty()) {
      throw new ApplyError(
        "dirty-tree",
        "Working tree has uncommitted changes.\n" +
          "Commit or stash your changes first, or pass --allow-dirty to override.\n" +
          "Review `flaglint migrate --dry-run` for provider setup guidance before applying."
      );
    }
  }

  // ── 2. Group inventory items by file ───────────────────────────────────────
  const itemsByFile = new Map<string, MigrationInventoryItem[]>();
  for (const item of analysis.inventoryItems) {
    if (!itemsByFile.has(item.file)) itemsByFile.set(item.file, []);
    itemsByFile.get(item.file)!.push(item);
  }

  // ── 3. Process each file ───────────────────────────────────────────────────
  const transformedFiles: string[] = [];
  const skippedFiles: Array<{ file: string; reason: string }> = [];
  let transformed = 0;

  for (const [file, items] of [...itemsByFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const code = await source.readFile(file);

    // Determine the proven OpenFeature client binding name (if any).
    const bindingName = getOpenFeatureClientBindingName(code, options.allowedOpenFeatureClientBindings ?? []);
    if (!bindingName) {
      skippedFiles.push({
        file,
        reason:
          "skipped — OpenFeature client setup required. " +
          "Review `flaglint migrate --dry-run` provider guidance first.",
      });
      continue;
    }

    // Build replacements; unsupported items (detail/dynamic/unknown/bulk) are silently skipped.
    // Pass `code` so buildReplacement can verify the range still holds the original call.
    const replacements: Replacement[] = [];
    for (const item of items) {
      const result = buildReplacement(item, code, bindingName);
      if ("reason" in result) continue;
      replacements.push(result);
    }

    if (replacements.length === 0) continue;

    const newCode = applyReplacements(code, replacements);
    if (newCode === code) continue; // already at target state — nothing to write

    await source.writeFile(file, newCode);
    transformedFiles.push(file);
    transformed += replacements.length;
  }

  return { transformed, skipped: skippedFiles.length, transformedFiles, skippedFiles };
}
