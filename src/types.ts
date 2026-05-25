import type { FlagLintConfig, ScanConfig } from "./config.js";
export type { FlagLintConfig, ScanConfig };

export interface FileSource {
  root?: string;
  listFiles(include: string[], exclude: string[]): Promise<string[]>;
  readFile(path: string): Promise<string>;
}

export type StalenessSignal =
  | { source: "keyword"; keyword: string }
  | { source: "path"; pattern: string }
  | { source: "minFileCount"; fileCount: number; threshold: number };

export interface StalenessEvaluator {
  evaluate(usages: FlagUsage[], config: ScanConfig): Promise<void>;
}

export type ScanWarning =
  | { kind: "read-failure"; file: string; fsCode: string }
  | { kind: "parse-failure"; file: string };

export type CallType =
  | "variation"
  | "variationDetail"
  | "boolVariation"
  | "boolVariationDetail"
  | "stringVariation"
  | "stringVariationDetail"
  | "numberVariation"
  | "numberVariationDetail"
  | "jsonVariation"
  | "jsonVariationDetail"
  | "allFlags"
  | "allFlagsState"
  | "isFeatureEnabled"
  | "hook-useFlags"
  | "hook-useLDClient"
  | "hoc"
  | "provider";

export interface FlagUsage {
  flagKey: string;
  isDynamic: boolean;
  // always relative to scan root — never an absolute path
  file: string;
  line: number;
  column: number;
  callType: CallType;
  stalenessSignals: StalenessSignal[];
}

export const isStale = (u: FlagUsage): boolean => u.stalenessSignals.length > 0;

export type MigrationValueType = "boolean" | "string" | "number" | "object" | "unknown";

export type MigrationManualReviewReason =
  | "dynamic-key"
  | "unknown-fallback"
  | "bulk-inventory-call";

export interface MigrationInventoryItem {
  file: string;
  line: number;
  column: number;
  launchDarklyMethod: CallType;
  flagKeyExpression?: string;
  staticFlagKey?: string;
  isDynamic: boolean;
  valueType: MigrationValueType;
  fallbackExpression?: string;
  evaluationContextExpression?: string;
  safelyAutomatable: boolean;
  manualReviewReason?: MigrationManualReviewReason;
}

export interface ScanResult {
  scannedAt: string;
  scanRoot: string;
  scannedFiles: number;
  totalUsages: number;
  uniqueFlags: string[];
  usages: FlagUsage[];
  migrationInventory?: MigrationInventoryItem[];
  scanDurationMs: number;
  warnings: readonly ScanWarning[];
}

export interface ScanOptions {
  dir: string;
  format: ReportFormat;
  output?: string;
  config?: string;
}

export type ReportFormat = "json" | "markdown" | "html" | "sarif";

export interface ReporterOptions {
  format: ReportFormat;
  title?: string;
}

export interface MigrationItem {
  usage: FlagUsage;
  openFeatureEquivalent: string | null;
  codeChangeBefore: string;
  codeChangeAfter: string;
  requiresManualReview: boolean;
  reviewReason?: string;
}

export interface MigrationAnalysis {
  readinessScore: number;
  requiredPackages: string[];
  items: MigrationItem[];
  manualReviewCount: number;
  autoMigrateCount: number;
}
