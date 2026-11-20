//#region src/migrator/rewrite-plan.ts
const DETAIL_METHODS = new Set([
	"variationDetail",
	"boolVariationDetail",
	"stringVariationDetail",
	"numberVariationDetail",
	"jsonVariationDetail"
]);
function methodForType(valueType) {
	switch (valueType) {
		case "boolean": return "getBooleanValue";
		case "string": return "getStringValue";
		case "number": return "getNumberValue";
		case "object": return "getObjectValue";
		case "unknown": return null;
	}
}
function buildReplacement(item, code, clientBindingName) {
	if (DETAIL_METHODS.has(item.launchDarklyMethod)) return {
		item,
		reason: "detail methods skipped: OpenFeature detail result parity requires manual review"
	};
	if (!item.safelyAutomatable) return {
		item,
		reason: "manual review required"
	};
	if (item.rangeStart == null || item.rangeEnd == null || !item.callExpression) return {
		item,
		reason: "missing source range for apply"
	};
	if (code.slice(item.rangeStart, item.rangeEnd) !== item.callExpression) return {
		item,
		reason: "range content does not match original call — already transformed or stale analysis"
	};
	if (!item.flagKeyExpression || !item.fallbackExpression || !item.evaluationContextExpression) return {
		item,
		reason: "missing flag key, fallback, or evaluation context evidence"
	};
	const method = methodForType(item.valueType);
	if (!method) return {
		item,
		reason: "unsupported or unknown value type"
	};
	return {
		item,
		replacement: `${clientBindingName}.${method}(${item.flagKeyExpression}, ${item.fallbackExpression}, ${item.evaluationContextExpression})`
	};
}
/**
* Plan safe edits after the caller has proven one OpenFeature client binding.
*
* This module intentionally has no parser, filesystem, or process dependency
* so the CLI and sandboxed distribution adapters can share replacement logic.
*/
function planMigrationEditsForBinding(code, items, clientBindingName) {
	const edits = [];
	for (const item of items) {
		const result = buildReplacement(item, code, clientBindingName);
		if ("reason" in result) continue;
		edits.push({
			start: result.item.rangeStart,
			end: result.item.rangeEnd,
			replacement: result.replacement
		});
	}
	return edits;
}

//#endregion
//#region codemods/launchdarkly-to-openfeature/scripts/codemod.ts
const LAUNCHDARKLY_PACKAGES = ["launchdarkly-node-server-sdk", "@launchdarkly/node-server-sdk"];
const DECLARATION_KINDS = [
	"const",
	"let",
	"var"
];
const MIGRATABLE_METHODS = [
	"variation",
	"boolVariation",
	"stringVariation",
	"numberVariation",
	"jsonVariation",
	"isFeatureEnabled"
];
function capturedTexts(root, patterns, capture, topLevelOnly = false) {
	const values = [];
	for (const pattern of patterns) for (const match of root.findAll({ rule: { pattern } })) {
		if (topLevelOnly && match.parent()?.kind() !== "program") continue;
		const captured = match.getMatch(capture)?.text();
		if (captured) values.push(captured);
	}
	return values;
}
function hasPattern(root, pattern, topLevelOnly = false) {
	return root.findAll({ rule: { pattern } }).some((match) => !topLevelOnly || match.parent()?.kind() === "program");
}
function collectLaunchDarklyClients(root) {
	const namespaces = /* @__PURE__ */ new Set();
	const initFunctions = /* @__PURE__ */ new Set();
	for (const packageName of LAUNCHDARKLY_PACKAGES) {
		for (const value of capturedTexts(root, [
			`import $NAMESPACE from "${packageName}"`,
			`import * as $NAMESPACE from "${packageName}"`,
			`const $NAMESPACE = require("${packageName}")`,
			`let $NAMESPACE = require("${packageName}")`,
			`var $NAMESPACE = require("${packageName}")`
		], "NAMESPACE", true)) namespaces.add(value);
		for (const value of capturedTexts(root, [
			`import { init as $INIT } from "${packageName}"`,
			`const { init: $INIT } = require("${packageName}")`,
			`let { init: $INIT } = require("${packageName}")`,
			`var { init: $INIT } = require("${packageName}")`
		], "INIT", true)) initFunctions.add(value);
		if (hasPattern(root, `import { init } from "${packageName}"`, true) || hasPattern(root, `const { init } = require("${packageName}")`, true) || hasPattern(root, `let { init } = require("${packageName}")`, true) || hasPattern(root, `var { init } = require("${packageName}")`, true)) initFunctions.add("init");
	}
	const clients = /* @__PURE__ */ new Set();
	for (const declaration of DECLARATION_KINDS) {
		for (const namespace of namespaces) for (const value of capturedTexts(root, [`${declaration} $CLIENT = ${namespace}.init($$$ARGS)`], "CLIENT")) clients.add(value);
		for (const initFunction of initFunctions) for (const value of capturedTexts(root, [`${declaration} $CLIENT = ${initFunction}($$$ARGS)`], "CLIENT")) clients.add(value);
	}
	return clients;
}
function collectOpenFeatureClient(root) {
	const apiNames = /* @__PURE__ */ new Set();
	for (const value of capturedTexts(root, ["import { OpenFeature as $API } from \"@openfeature/server-sdk\""], "API", true)) apiNames.add(value);
	if (hasPattern(root, "import { OpenFeature } from \"@openfeature/server-sdk\"", true)) apiNames.add("OpenFeature");
	for (const value of capturedTexts(root, [
		"const { OpenFeature: $API } = require(\"@openfeature/server-sdk\")",
		"let { OpenFeature: $API } = require(\"@openfeature/server-sdk\")",
		"var { OpenFeature: $API } = require(\"@openfeature/server-sdk\")"
	], "API", true)) apiNames.add(value);
	if (hasPattern(root, "const { OpenFeature } = require(\"@openfeature/server-sdk\")", true) || hasPattern(root, "let { OpenFeature } = require(\"@openfeature/server-sdk\")", true) || hasPattern(root, "var { OpenFeature } = require(\"@openfeature/server-sdk\")", true)) apiNames.add("OpenFeature");
	const clients = [];
	for (const declaration of DECLARATION_KINDS) for (const apiName of apiNames) for (const value of capturedTexts(root, [`${declaration} $CLIENT = ${apiName}.getClient($$$ARGS)`], "CLIENT")) clients.push(value);
	return clients.length === 1 ? clients[0] : null;
}
function isStaticString(node) {
	if (!node) return false;
	if (node.kind() === "string") return true;
	return node.kind() === "template_string" && node.find({ rule: { kind: "template_substitution" } }) == null;
}
function inferValueType(method, fallback) {
	if (method === "boolVariation") return "boolean";
	if (method === "stringVariation") return "string";
	if (method === "numberVariation") return "number";
	if (method === "jsonVariation") return "object";
	if (!fallback) return "unknown";
	switch (fallback.kind()) {
		case "true":
		case "false": return "boolean";
		case "string": return "string";
		case "number": return /n$/i.test(fallback.text()) ? "unknown" : "number";
		case "object":
		case "array": return "object";
		default: return "unknown";
	}
}
function buildInventoryItem(call, method, args) {
	const key = args[0];
	const context = args[1];
	const fallback = args[2];
	const staticKey = isStaticString(key);
	const valueType = inferValueType(method, fallback);
	const safelyAutomatable = staticKey && valueType !== "unknown" && context != null && fallback != null;
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
		manualReviewReason: !staticKey ? "dynamic-key" : valueType === "unknown" ? "unknown-fallback" : void 0
	};
}
const getSelector = () => ({ rule: { any: MIGRATABLE_METHODS.map((method) => ({ pattern: `$CLIENT.${method}($$$ARGS)` })) } });
const codemod = async (root) => {
	const rootNode = root.root();
	const launchDarklyClients = collectLaunchDarklyClients(rootNode);
	const openFeatureClient = collectOpenFeatureClient(rootNode);
	if (launchDarklyClients.size === 0 || !openFeatureClient) return null;
	const edits = [];
	const seen = /* @__PURE__ */ new Set();
	for (const client of launchDarklyClients) for (const method of MIGRATABLE_METHODS) {
		const pattern = `${client}.${method}($$$ARGS)`;
		for (const call of rootNode.findAll({ rule: { pattern } })) {
			if (seen.has(call.id())) continue;
			seen.add(call.id());
			const item = buildInventoryItem(call, method, call.field("arguments")?.children().filter((child) => child.isNamed()) ?? []);
			const planned = planMigrationEditsForBinding(item.callExpression, [item], openFeatureClient);
			if (planned.length === 1) edits.push(call.replace(planned[0].replacement));
		}
	}
	return edits.length === 0 ? null : rootNode.commitEdits(edits);
};
var codemod_default = codemod;

//#endregion
export { codemod_default as default, getSelector };