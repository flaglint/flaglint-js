import pLimit from "p-limit";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/types";
import type { CallType, FileSource, FlagUsage, ScanResult, FlagLintConfig } from "../types.js";
import { checkStale } from "../stale.js";

const LD_MEMBER_METHODS = new Set(["variation", "variationDetail", "allFlags"]);
const LD_CLIENT_PATTERN = /^ld|client/i;
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

function detectUsages(ast: TSESTree.Program, filePath: string): FlagUsage[] {
  const usages: FlagUsage[] = [];

  walk(ast, (node) => {
    if (node.type === "CallExpression") {
      const call = node as TSESTree.CallExpression;
      const { callee } = call;
      const loc = call.loc?.start ?? { line: 0, column: 0 };

      // ldClient.variation / ldClient.variationDetail / ldClient.allFlags
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.object.type === "Identifier" &&
        callee.property.type === "Identifier" &&
        LD_CLIENT_PATTERN.test((callee.object as TSESTree.Identifier).name) &&
        LD_MEMBER_METHODS.has((callee.property as TSESTree.Identifier).name)
      ) {
        const method = (callee.property as TSESTree.Identifier).name as CallType;
        if (method === "allFlags") {
          const sig = checkStale("*", filePath);
          usages.push({
            flagKey: "*",
            isDynamic: false,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: "allFlags",
            stalenessSignals: sig ? [sig] : [],
          });
        } else {
          const { flagKey, isDynamic } = extractFlagKey(call.arguments[0]);
          const sig = checkStale(flagKey, filePath);
          usages.push({
            flagKey,
            isDynamic,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: method,
            stalenessSignals: sig ? [sig] : [],
          });
        }
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

  return usages;
}

export async function scan(
  source: FileSource,
  config: FlagLintConfig,
  onProgress?: (filesScanned: number) => void
): Promise<ScanResult> {
  const start = Date.now();

  for (const pattern of config.include) {
    if (pattern.startsWith("/") || pattern.startsWith("..")) {
      throw new Error(
        `Invalid include pattern: "${pattern}" — patterns must be relative and must not start with ".."`
      );
    }
  }

  const files = await source.listFiles(config.include, config.exclude);

  const allUsages: FlagUsage[] = [];
  const warnings: string[] = [];
  let scannedFiles = 0;

  async function processFile(file: string): Promise<{ usages: FlagUsage[]; warning: string | null }> {
    let code: string;
    try {
      code = await source.readFile(file);
    } catch (err) {
      const fsCode = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
      return { usages: [], warning: `warn: could not read ${file} (${fsCode})` };
    }

    let ast: TSESTree.Program;
    try {
      ast = parse(code, {
        jsx: true,
        loc: true,
        range: false,
        comment: false,
        tokens: false,
      });
    } catch {
      return { usages: [], warning: `warn: failed to parse ${file}` };
    }

    return { usages: detectUsages(ast, file), warning: null };
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

  const uniqueFlags = [
    ...new Set(
      allUsages
        .filter((u) => !u.isDynamic && u.flagKey !== "*")
        .map((u) => u.flagKey)
    ),
  ];

  return {
    scannedFiles,
    totalUsages: allUsages.length,
    uniqueFlags,
    usages: allUsages,
    scanDurationMs: Date.now() - start,
    warnings,
  };
}
