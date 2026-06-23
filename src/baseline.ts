import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

export interface BaselineFile {
  version: "1";
  createdAt: string;
  flaglintVersion: string;
  fingerprints: string[];
}

export class BaselineError extends Error {
  exitCode: 2 | 3;

  constructor(message: string, exitCode: 2 | 3 = 2) {
    super(message);
    this.name = "BaselineError";
    this.exitCode = exitCode;
  }
}

/**
 * Reads and validates a baseline file. Returns a Set of known fingerprints.
 * Throws BaselineError (exit 2) for missing file, invalid JSON, wrong version,
 * or missing fingerprints array.
 */
export async function readBaseline(filePath: string): Promise<Set<string>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new BaselineError(
        `Baseline file not found: ${filePath}`,
        2
      );
    }
    throw new BaselineError(
      `Failed to read baseline file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      2
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BaselineError(
      `Invalid JSON in baseline file: ${filePath}`,
      2
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new BaselineError(
      `Baseline file must be a JSON object: ${filePath}`,
      2
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (obj["version"] !== "1") {
    throw new BaselineError(
      `Unsupported baseline version '${obj["version"]}' in ${filePath}. Expected version "1".`,
      2
    );
  }

  if (!Array.isArray(obj["fingerprints"])) {
    throw new BaselineError(
      `Baseline file is missing a valid 'fingerprints' array: ${filePath}`,
      2
    );
  }

  return new Set<string>(
    (obj["fingerprints"] as unknown[]).filter((f) => typeof f === "string") as string[]
  );
}

/**
 * Writes deduplicated, sorted fingerprints to a baseline file.
 * Creates parent directories if needed.
 * Throws BaselineError (exit 2) on write failure.
 */
export async function writeBaseline(
  filePath: string,
  fingerprints: string[],
  flaglintVersion: string
): Promise<void> {
  const deduped = [...new Set(fingerprints)].sort();

  const baseline: BaselineFile = {
    version: "1",
    createdAt: new Date().toISOString(),
    flaglintVersion,
    fingerprints: deduped,
  };

  const content = JSON.stringify(baseline, null, 2) + "\n";

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  } catch (err) {
    throw new BaselineError(
      `Failed to write baseline file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      2
    );
  }
}

/**
 * Returns fingerprints from currentFingerprints that are NOT in the baseline set.
 */
export function findNewFingerprints(
  currentFingerprints: string[],
  baselineSet: Set<string>
): string[] {
  return currentFingerprints.filter((fp) => !baselineSet.has(fp));
}
