export type { FlagLintConfig } from "./config.js";

export interface FlagUsage {
  flagKey: string;
  isDynamic: boolean;
  file: string;
  line: number;
  column: number;
  callType: string;
  isStale: boolean;
}

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

