import type { Edit, GetSelector, SgNode, Transform } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import type TS from "codemod:ast-grep/langs/typescript";
import type TSX from "codemod:ast-grep/langs/tsx";
import type {
  MigrationInventoryItem,
  MigrationValueType,
} from "../../../src/types.js";
import { planMigrationEditsForBinding } from "../../../src/migrator/rewrite-plan.js";

type JavaScriptOrTypeScript = JS | TS | TSX;
type Node = SgNode<JavaScriptOrTypeScript>;

const LAUNCHDARKLY_PACKAGES = [
  "launchdarkly-node-server-sdk",
  "@launchdarkly/node-server-sdk",
] as const;
const DECLARATION_KINDS = ["const", "let", "var"] as const;
const MIGRATABLE_METHODS = [
  "variation",
  "boolVariation",
  "stringVariation",
  "numberVariation",
  "jsonVariation",
  "isFeatureEnabled",
] as const;

function capturedTexts(
  root: Node,
  patterns: string[],
  capture: string,
  topLevelOnly = false
): string[] {
  const values: string[] = [];
  for (const pattern of patterns) {
    for (const match of root.findAll({ rule: { pattern } })) {
      if (topLevelOnly && match.parent()?.kind() !== "program") continue;
      const captured = match.getMatch(capture)?.text();
      if (captured) values.push(captured);
    }
  }
  return values;
}

function hasPattern(root: Node, pattern: string, topLevelOnly = false): boolean {
  return root
    .findAll({ rule: { pattern } })
    .some((match) => !topLevelOnly || match.parent()?.kind() === "program");
}

function collectLaunchDarklyClients(root: Node): Set<string> {
  const namespaces = new Set<string>();
  const initFunctions = new Set<string>();

  for (const packageName of LAUNCHDARKLY_PACKAGES) {
    for (const value of capturedTexts(
      root,
      [
        `import $NAMESPACE from "${packageName}"`,
        `import * as $NAMESPACE from "${packageName}"`,
        `const $NAMESPACE = require("${packageName}")`,
        `let $NAMESPACE = require("${packageName}")`,
        `var $NAMESPACE = require("${packageName}")`,
      ],
      "NAMESPACE",
      true
    )) {
      namespaces.add(value);
    }

    for (const value of capturedTexts(
      root,
      [
        `import { init as $INIT } from "${packageName}"`,
        `const { init: $INIT } = require("${packageName}")`,
        `let { init: $INIT } = require("${packageName}")`,
        `var { init: $INIT } = require("${packageName}")`,
      ],
      "INIT",
      true
    )) {
      initFunctions.add(value);
    }

    if (
      hasPattern(root, `import { init } from "${packageName}"`, true) ||
      hasPattern(root, `const { init } = require("${packageName}")`, true) ||
      hasPattern(root, `let { init } = require("${packageName}")`, true) ||
      hasPattern(root, `var { init } = require("${packageName}")`, true)
    ) {
      initFunctions.add("init");
    }
  }

  const clients = new Set<string>();
  for (const declaration of DECLARATION_KINDS) {
    for (const namespace of namespaces) {
      for (const value of capturedTexts(
        root,
        [`${declaration} $CLIENT = ${namespace}.init($$$ARGS)`],
        "CLIENT"
      )) {
        clients.add(value);
      }
    }
    for (const initFunction of initFunctions) {
      for (const value of capturedTexts(
        root,
        [`${declaration} $CLIENT = ${initFunction}($$$ARGS)`],
        "CLIENT"
      )) {
        clients.add(value);
      }
    }
  }
  return clients;
}

function collectOpenFeatureClient(root: Node): string | null {
  const apiNames = new Set<string>();

  for (const value of capturedTexts(
    root,
    ['import { OpenFeature as $API } from "@openfeature/server-sdk"'],
    "API",
    true
  )) {
    apiNames.add(value);
  }
  if (hasPattern(root, 'import { OpenFeature } from "@openfeature/server-sdk"', true)) {
    apiNames.add("OpenFeature");
  }

  for (const value of capturedTexts(
    root,
    [
      'const { OpenFeature: $API } = require("@openfeature/server-sdk")',
      'let { OpenFeature: $API } = require("@openfeature/server-sdk")',
      'var { OpenFeature: $API } = require("@openfeature/server-sdk")',
    ],
    "API",
    true
  )) {
    apiNames.add(value);
  }
  if (
    hasPattern(root, 'const { OpenFeature } = require("@openfeature/server-sdk")', true) ||
    hasPattern(root, 'let { OpenFeature } = require("@openfeature/server-sdk")', true) ||
    hasPattern(root, 'var { OpenFeature } = require("@openfeature/server-sdk")', true)
  ) {
    apiNames.add("OpenFeature");
  }

  const clients: string[] = [];
  for (const declaration of DECLARATION_KINDS) {
    for (const apiName of apiNames) {
      for (const value of capturedTexts(
        root,
        [`${declaration} $CLIENT = ${apiName}.getClient($$$ARGS)`],
        "CLIENT"
      )) {
        clients.push(value);
      }
    }
  }

  return clients.length === 1 ? clients[0]! : null;
}

function isStaticString(node: Node | undefined): boolean {
  if (!node) return false;
  if (node.kind() === "string") return true;
  return (
    node.kind() === "template_string" &&
    node.find({ rule: { kind: "template_substitution" } }) == null
  );
}

function inferValueType(method: string, fallback: Node | undefined): MigrationValueType {
  if (method === "boolVariation") return "boolean";
  if (method === "stringVariation") return "string";
  if (method === "numberVariation") return "number";
  if (method === "jsonVariation") return "object";
  if (!fallback) return "unknown";

  switch (fallback.kind()) {
    case "true":
    case "false":
      return "boolean";
    case "string":
      return "string";
    case "number":
      return /n$/i.test(fallback.text()) ? "unknown" : "number";
    case "object":
    case "array":
      return "object";
    default:
      return "unknown";
  }
}

function buildInventoryItem(
  call: Node,
  method: (typeof MIGRATABLE_METHODS)[number],
  args: Node[]
): MigrationInventoryItem {
  const key = args[0];
  const context = args[1];
  const fallback = args[2];
  const staticKey = isStaticString(key);
  const valueType = inferValueType(method, fallback);
  const safelyAutomatable =
    staticKey && valueType !== "unknown" && context != null && fallback != null;
  const callExpression = call.text();

  return {
    file: "",
    line: 0,
    column: 0,
    launchDarklyMethod: method,
    callExpression,
    rangeStart: 0,
    rangeEnd: callExpression.length,
    isDynamic: !staticKey,
    valueType,
    flagKeyExpression: key?.text(),
    fallbackExpression: fallback?.text(),
    evaluationContextExpression: context?.text(),
    safelyAutomatable,
    manualReviewReason: !staticKey
      ? "dynamic-key"
      : valueType === "unknown"
        ? "unknown-fallback"
        : undefined,
  };
}

export const getSelector: GetSelector<JavaScriptOrTypeScript> = () => ({
  rule: {
    any: MIGRATABLE_METHODS.map((method) => ({
      pattern: `$CLIENT.${method}($$$ARGS)`,
    })),
  },
});

const codemod: Transform<JavaScriptOrTypeScript> = async (root) => {
  const rootNode = root.root();
  const launchDarklyClients = collectLaunchDarklyClients(rootNode);
  const openFeatureClient = collectOpenFeatureClient(rootNode);
  if (launchDarklyClients.size === 0 || !openFeatureClient) return null;

  const edits: Edit[] = [];
  const seen = new Set<number>();
  for (const client of launchDarklyClients) {
    for (const method of MIGRATABLE_METHODS) {
      const pattern = `${client}.${method}($$$ARGS)`;
      for (const call of rootNode.findAll({ rule: { pattern } })) {
        if (seen.has(call.id())) continue;
        seen.add(call.id());

        const args =
          call.field("arguments")?.children().filter((child) => child.isNamed()) ?? [];
        const item = buildInventoryItem(call, method, args);
        const planned = planMigrationEditsForBinding(
          item.callExpression!,
          [item],
          openFeatureClient
        );
        if (planned.length === 1) {
          edits.push(call.replace(planned[0]!.replacement));
        }
      }
    }
  }

  return edits.length === 0 ? null : rootNode.commitEdits(edits);
};

export default codemod;
