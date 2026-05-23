import type { FlagUsage, MigrationAnalysis, MigrationItem, ScanResult } from "../types.js";

declare const __PKG_VERSION__: string;

// ── mapping helpers ───────────────────────────────────────────────────────────

function keyLiteral(usage: FlagUsage): string {
  return usage.isDynamic ? "flagKey" : `'${usage.flagKey}'`;
}

function buildItem(usage: FlagUsage): MigrationItem {
  const k = keyLiteral(usage);

  if (usage.isDynamic) {
    const isDetail = usage.callType === "variationDetail";
    const methodName = isDetail ? "variationDetail" : "variation";
    return {
      usage,
      openFeatureEquivalent: isDetail
        ? "client.getBooleanDetails()"
        : "client.getBooleanValue()",
      codeChangeBefore: `ldClient.${methodName}(flagKey, context, false)`,
      codeChangeAfter: isDetail
        ? `await client.getBooleanDetails(flagKey, false) // server SDK is async`
        : `await client.getBooleanValue(flagKey, false) // server SDK is async`,
      requiresManualReview: true,
      reviewReason:
        "Flag key determined at runtime; OpenFeature server SDK methods " +
        "are async — add await and make the enclosing function async",
    };
  }

  switch (usage.callType) {
    case "variation":
      return {
        usage,
        openFeatureEquivalent: "client.getBooleanValue()",
        codeChangeBefore: `ldClient.variation(${k}, context, false)`,
        codeChangeAfter: `await client.getBooleanValue(${k}, false) // server SDK is async`,
        requiresManualReview: true,
        reviewReason: "OpenFeature server SDK methods are async — add await and make the enclosing function async",
      };

    case "variationDetail":
      return {
        usage,
        openFeatureEquivalent: "client.getBooleanDetails()",
        codeChangeBefore: `ldClient.variationDetail(${k}, context, false)`,
        codeChangeAfter: `await client.getBooleanDetails(${k}, false) // server SDK is async`,
        requiresManualReview: true,
        reviewReason: "OpenFeature server SDK methods are async — add await and make the enclosing function async",
      };

    case "allFlags":
      return {
        usage,
        openFeatureEquivalent: null,
        codeChangeBefore: `ldClient.allFlags(context)`,
        codeChangeAfter: `// No direct OpenFeature equivalent — requires manual implementation`,
        requiresManualReview: true,
        reviewReason: "allFlags() has no direct OpenFeature equivalent",
      };

    case "isFeatureEnabled":
      return {
        usage,
        openFeatureEquivalent: "client.getBooleanValue()",
        codeChangeBefore: `isFeatureEnabled(${k}, context)`,
        codeChangeAfter: `await client.getBooleanValue(${k}, false) // server SDK is async`,
        requiresManualReview: true,
        reviewReason: "OpenFeature server SDK methods are async — add await and make the enclosing function async",
      };

    case "hook-useFlags":
      return {
        usage,
        openFeatureEquivalent: "useBooleanFlagValue()",
        codeChangeBefore: `const flags = useFlags()`,
        codeChangeAfter: `const flagValue = useBooleanFlagValue('your-flag-key', false) // TODO: one hook call per flag`,
        requiresManualReview: true,
        reviewReason: "useFlags() returns all flags; OpenFeature requires one useBooleanFlagValue() call per flag",
      };

    case "hook-useLDClient":
      return {
        usage,
        openFeatureEquivalent: "useOpenFeatureClient()",
        codeChangeBefore: `const client = useLDClient()`,
        codeChangeAfter: `const client = useOpenFeatureClient()`,
        requiresManualReview: false,
      };

    case "hoc":
      return {
        usage,
        openFeatureEquivalent: null,
        codeChangeBefore: `withLDConsumer()(Component)`,
        codeChangeAfter: `// withOpenFeature() does not exist in OpenFeature SDK 0.4+\n// Convert to a functional component and use useBooleanFlagValue() instead`,
        requiresManualReview: true,
        reviewReason: "withOpenFeature() HOC does not exist in OpenFeature SDK 0.4+; convert to a functional component with hooks",
      };

    case "provider":
      return {
        usage,
        openFeatureEquivalent: "OpenFeatureProvider",
        codeChangeBefore: `<LDProvider clientSideID="...">`,
        codeChangeAfter: `<OpenFeatureProvider provider={...}>`,
        requiresManualReview: false,
      };

    default:
      throw new Error(`Unhandled callType: ${usage.callType satisfies never}`);
  }
}

function calcReadinessScore(usages: FlagUsage[]): number {
  let score = 100;

  const dynamicCount = usages.filter((u) => u.isDynamic).length;
  score -= Math.min(dynamicCount * 10, 40);

  const useFlagsCount = usages.filter((u) => u.callType === "hook-useFlags").length;
  score -= useFlagsCount * 5;

  const hasAllFlags = usages.some((u) => u.callType === "allFlags");
  if (hasAllFlags) score -= 15;

  const hocCount = usages.filter((u) => u.callType === "hoc").length;
  score -= hocCount * 5;

  const hasStaticKeys = usages.some((u) => !u.isDynamic && u.flagKey !== "*");
  if (!hasStaticKeys) score -= 20;

  return Math.max(0, score);
}

function calcRequiredPackages(usages: FlagUsage[]): string[] {
  const REACT_CALL_TYPES = ["hook-useFlags", "hook-useLDClient", "hoc", "provider"];
  const SERVER_CALL_TYPES = ["variation", "variationDetail", "allFlags", "isFeatureEnabled"];

  const hasReactUsage = usages.some((u) => REACT_CALL_TYPES.includes(u.callType));
  const hasServerUsage = usages.some((u) => SERVER_CALL_TYPES.includes(u.callType));

  const pkgs = new Set<string>();

  if (hasReactUsage && !hasServerUsage) {
    pkgs.add("@openfeature/web-sdk");
    pkgs.add("@openfeature/react-sdk");
  } else if (hasReactUsage && hasServerUsage) {
    pkgs.add("@openfeature/server-sdk");
    pkgs.add("@openfeature/web-sdk");
    pkgs.add("@openfeature/react-sdk");
  } else {
    pkgs.add("@openfeature/server-sdk");
  }

  return [...pkgs].sort();
}

// ── public exports ────────────────────────────────────────────────────────────

export function analyze(result: ScanResult): MigrationAnalysis {
  const items = result.usages.map(buildItem);
  const readinessScore = calcReadinessScore(result.usages);
  const requiredPackages = calcRequiredPackages(result.usages);
  const manualReviewCount = items.filter((i) => i.requiresManualReview).length;
  const autoMigrateCount = items.filter((i) => !i.requiresManualReview).length;

  return { readinessScore, requiredPackages, items, manualReviewCount, autoMigrateCount };
}

export function formatMigrationReport(analysis: MigrationAnalysis): string {
  const { readinessScore, requiredPackages, items, manualReviewCount, autoMigrateCount } = analysis;
  const date = new Date().toLocaleDateString();
  const version = typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "0.1.0";

  let scoreLabel: string;
  if (readinessScore >= 80) scoreLabel = "✓ Your codebase is ready for migration";
  else if (readinessScore >= 50) scoreLabel = "⚠ Some manual work required before migration";
  else scoreLabel = "✗ Significant refactoring needed";

  const lines: string[] = [];

  lines.push(`# OpenFeature Migration Plan`);
  lines.push(`Generated by FlagLint v${version} on ${date}`);
  lines.push("");
  lines.push(`## Migration Readiness Score: ${readinessScore}/100`);
  lines.push(scoreLabel);
  lines.push("");
  lines.push(`**Auto-migratable:** ${autoMigrateCount} usages  `);
  lines.push(`**Requires manual review:** ${manualReviewCount} usages`);
  lines.push("");

  lines.push("## Required Packages");
  lines.push("```");
  lines.push(`npm install ${requiredPackages.join(" ")}`);
  lines.push("```");
  lines.push("");

  lines.push("## Step-by-Step Checklist");
  lines.push("- [ ] Install OpenFeature packages");
  lines.push("- [ ] Configure your OpenFeature provider (LaunchDarkly, Unleash, etc.)");
  lines.push("- [ ] Replace LDProvider with OpenFeatureProvider");
  lines.push("- [ ] Update each flag evaluation call (see below)");
  lines.push("- [ ] Remove LaunchDarkly SDK dependency");
  lines.push("- [ ] Test all flagged features");
  lines.push("");

  const autoItems = items.filter((i) => !i.requiresManualReview);
  const manualItems = items.filter((i) => i.requiresManualReview);

  if (autoItems.length > 0) {
    lines.push("## Code Changes Required");
    for (const item of autoItems) {
      const { usage } = item;
      lines.push(`### ${usage.file}:${usage.line} — \`${usage.flagKey}\``);
      lines.push("**Before:**");
      lines.push("```typescript");
      lines.push(item.codeChangeBefore);
      lines.push("```");
      lines.push("**After:**");
      lines.push("```typescript");
      lines.push(item.codeChangeAfter);
      lines.push("```");
      lines.push("");
    }
  }

  if (manualItems.length > 0) {
    lines.push("## Manual Review Required");
    for (const item of manualItems) {
      const { usage } = item;
      lines.push(`### ${usage.file}:${usage.line} — \`${usage.flagKey}\``);
      if (item.reviewReason) lines.push(`> ${item.reviewReason}`);
      lines.push("**Before:**");
      lines.push("```typescript");
      lines.push(item.codeChangeBefore);
      lines.push("```");
      lines.push("**After:**");
      lines.push("```typescript");
      lines.push(item.codeChangeAfter);
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("## Resources");
  lines.push("- OpenFeature docs: https://openfeature.dev/docs");
  lines.push(
    "- OpenFeature React SDK: https://openfeature.dev/docs/reference/technologies/client/web/react"
  );
  lines.push("");

  return lines.join("\n");
}
