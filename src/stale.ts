import type { FlagUsage, StalenessSignal } from "./types.js";

export const STALE_KEYWORDS = ["old", "deprecated", "legacy", "temp", "tmp", "test", "demo"];
export const STALE_FILE_RE = /\.(test|spec|mock)\.[jt]sx?$/;
export const STALE_PATH_RE = /\/deprecated\/|\/old\/|\/legacy\//;

export function checkStale(flagKey: string, filePath: string): StalenessSignal | null {
  if (STALE_FILE_RE.test(filePath)) return { source: "path", pattern: "test/spec/mock file" };
  if (STALE_PATH_RE.test(filePath)) return { source: "path", pattern: "deprecated/old/legacy path" };
  const lk = flagKey.toLowerCase();
  const kw = STALE_KEYWORDS.find((k) => new RegExp(`(?:^|[-_])${k}(?:[-_]|$)`).test(lk));
  if (kw) return { source: "keyword", keyword: kw };
  return null;
}

export function staleReason(u: FlagUsage): string {
  for (const s of u.stalenessSignals) {
    if (s.source === "keyword") return `Contains "${s.keyword}" in key`;
    if (s.source === "path") return s.pattern === "test/spec/mock file" ? "Located in test file" : "Located in deprecated path";
    if (s.source === "minFileCount") return `Appears in only ${s.fileCount} file(s) (threshold: ${s.threshold})`;
  }
  return "Flagged as stale";
}
