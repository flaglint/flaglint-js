import { readFile } from "fs/promises";
import { join } from "path";

interface Pkg {
  name?: string;
  version?: string;
  main?: string;
  bin?: Record<string, string> | string;
  files?: string[];
  [key: string]: unknown;
}

export async function getPackageVersion(cwd = process.cwd()): Promise<string> {
  const raw = await readFile(join(cwd, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as Pkg;
  if (!pkg.version) throw new Error("package.json is missing version");
  return pkg.version;
}

export async function verifyPublishable(cwd = process.cwd()): Promise<void> {
  const raw = await readFile(join(cwd, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as Pkg;
  const missing: string[] = [];
  if (!pkg.name) missing.push("name");
  if (!pkg.version) missing.push("version");
  if (!pkg.main && !pkg.bin) missing.push("main or bin");
  if (missing.length > 0) {
    throw new Error(`package.json missing required publish fields: ${missing.join(", ")}`);
  }
}
