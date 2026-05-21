import { readFile } from "fs/promises";
import { relative } from "path";
import fg from "fast-glob";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/types";
import type { CallType, FlagUsage, ScanResult, FlagLintConfig } from "../types.js";

const LD_MEMBER_METHODS = new Set(["variation", "variationDetail", "allFlags"]);
const LD_CLIENT_PATTERN = /ld|client/i;
const LD_HOOKS = new Set(["useFlags", "useLDClient"]);
const STALE_KEY_WORDS = ["old", "deprecated", "legacy", "temp", "tmp", "test", "demo"];
const STALE_FILE_RE = /\.(test|spec|mock)\.[jt]sx?$/;
const STALE_PATH_RE = /\/deprecated\/|\/old\/|\/legacy\//;
const DEFAULT_EXCLUDE = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**"];

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

function checkStale(flagKey: string, filePath: string): boolean {
  if (STALE_FILE_RE.test(filePath)) return true;
  if (STALE_PATH_RE.test(filePath)) return true;
  const lk = flagKey.toLowerCase();
  return STALE_KEY_WORDS.some((kw) => lk.includes(kw));
}

function walk(node: TSESTree.Node | null | undefined, visit: (n: TSESTree.Node) => void): void {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === "object" && "type" in item) {
          walk(item as TSESTree.Node, visit);
        }
      }
    } else if (val && typeof val === "object" && "type" in val) {
      walk(val as TSESTree.Node, visit);
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
          usages.push({
            flagKey: "*",
            isDynamic: false,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: "allFlags",
            isStale: checkStale("*", filePath),
          });
        } else {
          const { flagKey, isDynamic } = extractFlagKey(call.arguments[0]);
          usages.push({
            flagKey,
            isDynamic,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: method,
            isStale: checkStale(flagKey, filePath),
          });
        }
        return;
      }

      if (callee.type === "Identifier") {
        const name = (callee as TSESTree.Identifier).name;

        // isFeatureEnabled(flagKey, ...)
        if (name === "isFeatureEnabled") {
          const { flagKey, isDynamic } = extractFlagKey(call.arguments[0]);
          usages.push({
            flagKey,
            isDynamic,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: "isFeatureEnabled",
            isStale: checkStale(flagKey, filePath),
          });
          return;
        }

        // useFlags() / useLDClient()
        if (LD_HOOKS.has(name)) {
          usages.push({
            flagKey: "*",
            isDynamic: false,
            file: filePath,
            line: loc.line,
            column: loc.column,
            callType: name === "useFlags" ? "hook-useFlags" : "hook-useLDClient",
            isStale: checkStale("*", filePath),
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
        usages.push({
          flagKey: "*",
          isDynamic: false,
          file: filePath,
          line: loc.line,
          column: loc.column,
          callType: "hoc",
          isStale: checkStale("*", filePath),
        });
        return;
      }
    }

    // JSX: <LDProvider ...>
    if (node.type === "JSXOpeningElement") {
      const jsx = node as TSESTree.JSXOpeningElement;
      if (jsx.name.type === "JSXIdentifier" && (jsx.name as TSESTree.JSXIdentifier).name === "LDProvider") {
        const loc = jsx.loc?.start ?? { line: 0, column: 0 };
        usages.push({
          flagKey: "*",
          isDynamic: false,
          file: filePath,
          line: loc.line,
          column: loc.column,
          callType: "provider",
          isStale: checkStale("*", filePath),
        });
      }
    }
  });

  return usages;
}

export async function scan(
  dir: string,
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

  const files = await fg(config.include, {
    cwd: dir,
    absolute: true,
    ignore: [...DEFAULT_EXCLUDE, ...config.exclude],
    onlyFiles: true,
  });

  const allUsages: FlagUsage[] = [];
  const warnings: string[] = [];
  let scannedFiles = 0;

  for (const file of files) {
    scannedFiles++;
    onProgress?.(scannedFiles);

    let code: string;
    try {
      code = await readFile(file, "utf8");
    } catch {
      continue;
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
      warnings.push(`warn: failed to parse ${relative(dir, file)}`);
      continue;
    }

    allUsages.push(...detectUsages(ast, file));
  }

  if (config.staleThreshold > 0) {
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
        if (fileCount <= config.staleThreshold) {
          usage.isStale = true;
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
