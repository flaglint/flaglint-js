import type { FlagLintConfig } from "./config.js";
export type { FlagLintConfig };

export interface FileSource {
  listFiles(include: string[], exclude: string[]): Promise<string[]>;
  readFile(path: string): Promise<string>;
}

export type StalenessSignal =
  | { source: "keyword"; keyword: string }
  | { source: "path"; pattern: string }
  | { source: "minFileCount"; fileCount: number; threshold: number };

export interface StalenessEvaluator {
  evaluate(usages: FlagUsage[], config: FlagLintConfig): Promise<void>;
}

export type CallType =
  | "variation"
  | "variationDetail"
  | "allFlags"
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

export interface ScanResult {
  scannedFiles: number;
  totalUsages: number;
  uniqueFlags: string[];
  usages: FlagUsage[];
  scanDurationMs: number;
  warnings: readonly string[];
}

export interface ScanOptions {
  dir: string;
  format: "json" | "markdown" | "html";
  output?: string;
  config?: string;
}

export interface ReporterOptions {
  format: "json" | "markdown" | "html";
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

