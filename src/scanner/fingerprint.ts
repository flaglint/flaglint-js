import type { CallType } from "../types.js";

function normalizePath(filePath: string): string {
  // Replace Windows backslashes, remove leading ./
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function generateFingerprint(
  flagKey: string,
  callType: CallType,
  filePath: string,
  dynamicIndex?: number
): string {
  const normalized = normalizePath(filePath);
  const key = flagKey === "*" || flagKey === "" ? "*" : flagKey;
  const base = `launchdarkly:${callType}:${key}:${normalized}`;
  if (dynamicIndex !== undefined) {
    return `${base}:${dynamicIndex}`;
  }
  return base;
}
