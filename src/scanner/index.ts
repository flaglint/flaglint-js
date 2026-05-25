import pLimit from "p-limit";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/types";
import type {
  CallType,
  FileSource,
  FlagUsage,
  MigrationInventoryItem,
  MigrationManualReviewReason,
  MigrationValueType,
  ScanResult,
  ScanConfig,
  StalenessEvaluator,
  ScanWarning,
} from "../types.js";
import { checkStale } from "../stale.js";

// Known LaunchDarkly Node.js server-side SDK package specifiers.
// MVP scope: inventory Node server-side LaunchDarkly SDK usage for future
// OpenFeature migration while keeping LaunchDarkly as the provider.
const LD_NODE_SERVER_PACKAGES = new Set([
  "launchdarkly-node-server-sdk",
  "@launchdarkly/node-server-sdk",
]);

// Client methods where the first argument is the flag key.
const LD_FLAG_KEY_METHODS = new Set([
  "variation",
  "variationDetail",
  "boolVariation",
  "boolVariationDetail",
  "stringVariation",
  "stringVariationDetail",
  "numberVariation",
  "numberVariationDetail",
  "jsonVariation",
  "jsonVariationDetail",
]);

// Client methods that enumerate all flags — no flag key, use '*'.
// TODO: bulk inventory calls must not be auto-migrated as normal single-flag
// evaluations; they need a separate manual-review migration path.
const LD_ALL_FLAGS_METHODS = new Set(["allFlags", "allFlagsState"]);

const LD_HOOKS = new Set(["useFlags", "useLDClient"]);
export const DEFAULT_EXCLUDE = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**"];

function extractFlagKey(arg: TSESTree.Node | undefined): { flagKey: string; isDynamic: boolean } {
  if (!arg) return { flagKey: "dynamic", isDynamic: true };

  if (arg.type === "Literal" && typeof (arg as TSESTree.StringLiteral).value === "string") {
    return { flagKey: (arg as TSESTree.StringLiteral).value, isDynamic: false };
  }

  if (
    arg.type === "TemplateLiteral" &&
    (arg as TSESTree.TemplateLiteral).expressions.length === 0
  ) {
    const cooked = (arg as TSESTree.TemplateLiteral).quasis[0]?.value.cooked;
    if (cooked != null) return { flagKey: cooked, isDynamic: false };
  }

  return { flagKey: "dynamic", isDynamic: true };
}

function expressionText(code: string, node: TSESTree.Node | undefined): string | undefined {
  const range = (node as (TSESTree.Node & { range?: [number, number] }) | undefined)?.range;
  if (!range) return undefined;
  return code.slice(range[0], range[1]);
}

function expressionRange(node: TSESTree.Node | undefined): [number, number] | undefined {
  return (node as (TSESTree.Node & { range?: [number, number] }) | undefined)?.range;
}

function isAwaitedCall(code: string, call: TSESTree.CallExpression): boolean {
  const range = expressionRange(call);
  if (!range) return false;

  let i = range[0] - 1;
  while (i >= 0 && /\s/.test(code[i]!)) i--;
  const end = i + 1;
  while (i >= 0 && /[A-Za-z_$]/.test(code[i]!)) i--;
  return code.slice(i + 1, end) === "await";
}

function inferValueType(methodName: string, fallback: TSESTree.Node | undefined): MigrationValueType {
  if (methodName === "boolVariation" || methodName === "boolVariationDetail") return "boolean";
  if (methodName === "stringVariation" || methodName === "stringVariationDetail") return "string";
  if (methodName === "numberVariation" || methodName === "numberVariationDetail") return "number";
  if (methodName === "jsonVariation" || methodName === "jsonVariationDetail") return "object";

  if (!fallback) return "unknown";
  if (fallback.type === "Literal") {
    const value = (fallback as TSESTree.Literal).value;
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    return "unknown";
  }
  if (fallback.type === "ObjectExpression" || fallback.type === "ArrayExpression") return "object";

  return "unknown";
}

function buildMigrationInventoryItem(
  code: string,
  filePath: string,
  loc: { line: number; column: number },
  call: TSESTree.CallExpression,
  methodName: string,
  args: readonly TSESTree.CallExpressionArgument[],
  flagKey: string,
  isDynamic: boolean
): MigrationInventoryItem {
  const callRange = expressionRange(call);

  if (LD_ALL_FLAGS_METHODS.has(methodName)) {
    return {
      file: filePath,
      line: loc.line,
      column: loc.column,
      launchDarklyMethod: methodName as CallType,
      callExpression: expressionText(code, call),
      rangeStart: callRange?.[0],
      rangeEnd: callRange?.[1],
      isAwaited: isAwaitedCall(code, call),
      isDynamic: false,
      valueType: "unknown",
      evaluationContextExpression: expressionText(code, args[0]),
      safelyAutomatable: false,
      manualReviewReason: "bulk-inventory-call",
    };
  }

  const fallback = args[2];
  const valueType = inferValueType(methodName, fallback);
  const manualReviewReason: MigrationManualReviewReason | undefined =
    isDynamic ? "dynamic-key" : valueType === "unknown" ? "unknown-fallback" : undefined;

  return {
    file: filePath,
    line: loc.line,
    column: loc.column,
    launchDarklyMethod: methodName as CallType,
    callExpression: expressionText(code, call),
    rangeStart: callRange?.[0],
    rangeEnd: callRange?.[1],
    isAwaited: isAwaitedCall(code, call),
    flagKeyExpression: expressionText(code, args[0]),
    staticFlagKey: isDynamic ? undefined : flagKey,
    isDynamic,
    valueType,
    fallbackExpression: expressionText(code, fallback),
    evaluationContextExpression: expressionText(code, args[1]),
    safelyAutomatable: manualReviewReason == null,
    manualReviewReason,
  };
}

function walk(root: TSESTree.Node | null | undefined, visit: (n: TSESTree.Node) => void): void {
  if (!root || typeof root !== "object") return;
  const stack: TSESTree.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    visit(node);
    const children: TSESTree.Node[] = [];
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const val = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === "object" && "type" in item) {
            children.push(item as TSESTree.Node);
          }
        }
      } else if (val && typeof val === "object" && "type" in val) {
        children.push(val as TSESTree.Node);
      }
    }
    // Push in reverse so pop() processes children in original Object.keys() order
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]!);
    }
  }
}

/**
 * Collect the set of local variable names that are proven LaunchDarkly clients.
 *
 * A variable is a proven LD client if and only if it is directly initialized
 * from `<LDNamespace>.init(...)` where <LDNamespace> was imported or required
 * from a known LaunchDarkly SDK package.
 *
 * No name-based heuristics are used: only import/require bindings establish
 * the namespace, and only `.init()` calls on those namespaces establish clients.
 */
function collectLDClients(ast: TSESTree.Program): Set<string> {
  // ── Step 1: collect namespace names from top-level LD imports / require() ──
  const ldNamespaces = new Set<string>();

  for (const stmt of ast.body) {
    // ESM: import * as X from 'launchdarkly-...'
    //      import X from 'launchdarkly-...'
    if (stmt.type === "ImportDeclaration") {
      const importDecl = stmt as TSESTree.ImportDeclaration;
      if (LD_NODE_SERVER_PACKAGES.has(importDecl.source.value)) {
        for (const spec of importDecl.specifiers) {
          if (
            spec.type === "ImportNamespaceSpecifier" ||
            spec.type === "ImportDefaultSpecifier"
          ) {
            ldNamespaces.add(spec.local.name);
          }
        }
      }
      continue;
    }

    // CJS: const X = require('launchdarkly-...')
    //      const X: any = require('launchdarkly-...')
    if (stmt.type === "VariableDeclaration") {
      const varDecl = stmt as TSESTree.VariableDeclaration;
      for (const decl of varDecl.declarations) {
        if (decl.id.type !== "Identifier" || !decl.init) continue;
        const init = decl.init;
        if (
          init.type === "CallExpression" &&
          (init as TSESTree.CallExpression).callee.type === "Identifier" &&
          ((init as TSESTree.CallExpression).callee as TSESTree.Identifier).name === "require" &&
          (init as TSESTree.CallExpression).arguments.length >= 1 &&
          (init as TSESTree.CallExpression).arguments[0]!.type === "Literal" &&
          LD_NODE_SERVER_PACKAGES.has(
            ((init as TSESTree.CallExpression).arguments[0] as TSESTree.StringLiteral).value as string
          )
        ) {
          ldNamespaces.add((decl.id as TSESTree.Identifier).name);
        }
      }
    }
  }

  if (ldNamespaces.size === 0) return new Set();

  // ── Step 2: collect variable names assigned from LDNamespace.init(...) ──
  const ldClients = new Set<string>();
  walk(ast, (node) => {
    if (node.type !== "VariableDeclaration") return;
    const varDecl = node as TSESTree.VariableDeclaration;
    for (const decl of varDecl.declarations) {
      if (
        decl.id.type !== "Identifier" ||
        !decl.init ||
        decl.init.type !== "CallExpression"
      ) continue;
      const initCall = decl.init as TSESTree.CallExpression;
      if (
        initCall.callee.type !== "MemberExpression" ||
        (initCall.callee as TSESTree.MemberExpression).computed
      ) continue;
      const initCallee = initCall.callee as TSESTree.MemberExpression;
      if (
        initCallee.object.type === "Identifier" &&
        initCallee.property.type === "Identifier" &&
        ldNamespaces.has((initCallee.object as TSESTree.Identifier).name) &&
        (initCallee.property as TSESTree.Identifier).name === "init"
      ) {
        ldClients.add((decl.id as TSESTree.Identifier).name);
      }
    }
  });

  return ldClients;
}

function detectUsages(
  ast: TSESTree.Program,
  code: string,
  filePath: string,
  wrappers: string[]
): { usages: FlagUsage[]; migrationInventory: MigrationInventoryItem[] } {
  const usages: FlagUsage[] = [];
  const migrationInventory: MigrationInventoryItem[] = [];

  // Establish the set of proven LD client variables for this file.
  const ldClients = collectLDClients(ast);

  walk(ast, (node) => {
    if (node.type === "CallExpression") {
      const call = node as TSESTree.CallExpression;
      const { callee } = call;
      const loc = call.loc?.start ?? { line: 0, column: 0 };

      // ── Proven LD client method calls ─────────────────────────────────────
      // Matches: ldClient.variation(...), ldClient.boolVariation(...),
      //          ldClient.allFlags(...), ldClient.allFlagsState(...), etc.
      // Identity is established through import/require + init() binding only;
      // variable naming plays no role.
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.object.type === "Identifier" &&
        callee.property.type === "Identifier" &&
        ldClients.has((callee.object as TSESTree.Identifier).name)
      ) {
        const methodName = (callee.property as TSESTree.Identifier).name;

        if (LD_ALL_FLAGS_METHODS.has(methodName)) {
          const sig = checkStale("*", filePath);
          usages.push({
            flagKey: "*",
            isDynamic: false,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: methodName as unknown as CallType,
            stalenessSignals: sig ? [sig] : [],
          });
          migrationInventory.push(
            buildMigrationInventoryItem(code, filePath, loc, call, methodName, call.arguments, "*", false)
          );
          return;
        }

        if (LD_FLAG_KEY_METHODS.has(methodName)) {
          const { flagKey, isDynamic } = extractFlagKey(call.arguments[0]);
          const sig = checkStale(flagKey, filePath);
          usages.push({
            flagKey,
            isDynamic,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: methodName as unknown as CallType,
            stalenessSignals: sig ? [sig] : [],
          });
          migrationInventory.push(
            buildMigrationInventoryItem(code, filePath, loc, call, methodName, call.arguments, flagKey, isDynamic)
          );
          return;
        }

        // Method not in recognized set (e.g. .track(), .flush()) — skip.
        return;
      }

      if (callee.type === "Identifier") {
        const name = (callee as TSESTree.Identifier).name;

        // isFeatureEnabled(flagKey, ...)
        if (name === "isFeatureEnabled") {
          const { flagKey, isDynamic } = extractFlagKey(call.arguments[0]);
          const sig = checkStale(flagKey, filePath);
          usages.push({
            flagKey,
            isDynamic,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: "isFeatureEnabled",
            stalenessSignals: sig ? [sig] : [],
          });
          return;
        }

        // useFlags() / useLDClient()
        if (LD_HOOKS.has(name)) {
          const sig = checkStale("*", filePath);
          usages.push({
            flagKey: "*",
            isDynamic: false,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: name === "useFlags" ? "hook-useFlags" : "hook-useLDClient",
            stalenessSignals: sig ? [sig] : [],
          });
          return;
        }
      }

      // Wrapper function detection — e.g. flagPredicate('my-flag', false)
      if (
        wrappers.length > 0 &&
        callee.type === "Identifier" &&
        wrappers.includes((callee as TSESTree.Identifier).name) &&
        call.arguments.length >= 1
      ) {
        const { flagKey, isDynamic } = extractFlagKey(call.arguments[0]);
        const sig = checkStale(flagKey, filePath);
        usages.push({
          flagKey,
          isDynamic,
          file: filePath,
          line: loc.line,
          column: loc.column,
          callType: "variation",
          stalenessSignals: sig ? [sig] : [],
        });
        return;
      }

      // withLDConsumer()(...) — callee is itself a CallExpression
      if (
        callee.type === "CallExpression" &&
        (callee as TSESTree.CallExpression).callee.type === "Identifier" &&
        ((callee as TSESTree.CallExpression).callee as TSESTree.Identifier).name === "withLDConsumer"
      ) {
        const sig = checkStale("*", filePath);
        usages.push({
          flagKey: "*",
          isDynamic: false,
          file: filePath,
          line: loc.line,
          column: loc.column,
          callType: "hoc",
          stalenessSignals: sig ? [sig] : [],
        });
        return;
      }
    }

    // JSX: <LDProvider ...>
    if (node.type === "JSXOpeningElement") {
      const jsx = node as TSESTree.JSXOpeningElement;
      if (jsx.name.type === "JSXIdentifier" && (jsx.name as TSESTree.JSXIdentifier).name === "LDProvider") {
        const loc = jsx.loc?.start ?? { line: 0, column: 0 };
        const sigP = checkStale("*", filePath);
        usages.push({
          flagKey: "*",
          isDynamic: false,
          file: filePath,
          line: loc.line,
          column: loc.column,
          callType: "provider",
          stalenessSignals: sigP ? [sigP] : [],
        });
      }
    }
  });

  return { usages, migrationInventory };
}

export async function scan(
  source: FileSource,
  config: ScanConfig,
  onProgress?: (filesScanned: number) => void,
  evaluator?: StalenessEvaluator
): Promise<ScanResult> {
  const start = Date.now();
  const scannedAt = new Date().toISOString();

  for (const pattern of config.include) {
    if (pattern.startsWith("/") || pattern.startsWith("..")) {
      throw new Error(
        `Invalid include pattern: "${pattern}" — patterns must be relative and must not start with ".."`
      );
    }
  }

  const files = await source.listFiles(config.include, config.exclude);

  const allUsages: FlagUsage[] = [];
  const migrationInventory: MigrationInventoryItem[] = [];
  const warnings: ScanWarning[] = [];
  let scannedFiles = 0;

  async function processFile(
    file: string
  ): Promise<{ usages: FlagUsage[]; migrationInventory: MigrationInventoryItem[]; warning: ScanWarning | null }> {
    let code: string;
    try {
      code = await source.readFile(file);
    } catch (err) {
      const fsCode = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
      return { usages: [], migrationInventory: [], warning: { kind: "read-failure", file, fsCode } };
    }

    let ast: TSESTree.Program;
    try {
      ast = parse(code, {
        jsx: true,
        loc: true,
        range: true,
        comment: false,
        tokens: false,
        filePath: file,
      });
    } catch {
      return { usages: [], migrationInventory: [], warning: { kind: "parse-failure", file } };
    }

    return { ...detectUsages(ast, code, file, config.wrappers), warning: null };
  }

  const limit = pLimit(50);

  const results = await Promise.all(
    files.map((file) =>
      limit(async () => {
        scannedFiles++;
        onProgress?.(scannedFiles);
        return processFile(file);
      })
    )
  );

  for (const r of results) {
    allUsages.push(...r.usages);
    migrationInventory.push(...r.migrationInventory);
    if (r.warning) warnings.push(r.warning);
  }

  if (config.minFileCount > 0) {
    const flagFileCount = new Map<string, Set<string>>();
    for (const usage of allUsages) {
      if (!usage.isDynamic && usage.flagKey !== "*") {
        if (!flagFileCount.has(usage.flagKey)) {
          flagFileCount.set(usage.flagKey, new Set());
        }
        flagFileCount.get(usage.flagKey)!.add(usage.file);
      }
    }
    for (const usage of allUsages) {
      if (!usage.isDynamic && usage.flagKey !== "*") {
        const fileCount = flagFileCount.get(usage.flagKey)?.size ?? 0;
        if (fileCount <= config.minFileCount) {
          usage.stalenessSignals.push({
            source: "minFileCount",
            fileCount,
            threshold: config.minFileCount,
          });
        }
      }
    }
  }

  if (evaluator) {
    await evaluator.evaluate(allUsages, config);
  }

  const uniqueFlags = [
    ...new Set(
      allUsages
        .filter((u) => !u.isDynamic && u.flagKey !== "*")
        .map((u) => u.flagKey)
    ),
  ];

  return {
    scannedAt,
    scanRoot: source.root ?? ".",
    scannedFiles,
    totalUsages: allUsages.length,
    uniqueFlags,
    usages: allUsages,
    migrationInventory,
    scanDurationMs: Date.now() - start,
    warnings,
  };
}
