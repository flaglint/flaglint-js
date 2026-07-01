import { readFile, access } from "fs/promises";
import { resolve } from "path";
import { z, ZodError } from "zod";

export const FlagLintConfigSchema = z.object({
  include: z.array(z.string()).default(["**/*.{ts,tsx,js,jsx}"]),
  exclude: z
    .array(z.string())
    .default([
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.d.ts",
    ]),
  // Governs which vendor SDK the scanner targets.
  // Only "launchdarkly" is wired; other values are rejected with a clear error.
  provider: z.string().default("launchdarkly"),
  // TODO v0.3: replace minFileCount with real date-based staleness via git log
  minFileCount: z.number().int().min(0).default(0),
  wrappers: z
    .array(
      z.union([
        z.string(),
        z.object({
          import: z.string().min(1),
          function: z.string().min(1),
          flagKeyArgument: z.number().int().min(0).default(0),
        }),
      ])
    )
    .default([]),
  openFeatureClientBindings: z
    .array(
      z.object({ importName: z.string(), modulePatterns: z.array(z.string()).default([]) })
    )
    .default([]),
  reportTitle: z.string().optional(),
  outputDir: z.string().default("."),
});

export type FlagLintConfig = z.infer<typeof FlagLintConfigSchema>;
export type WrapperObjectConfig = { import: string; function: string; flagKeyArgument: number };

// Scan-relevant config only — the subset scan() needs. CLI output fields
// (reportTitle, outputDir) are stripped so callers can pass scan-only config
// without dummy values for fields that have no meaning outside the CLI.
// provider is intentionally excluded: the scanner only targets launchdarkly;
// multi-vendor support is planned for v0.7 and will be wired then.
export type ScanConfig = Pick<FlagLintConfig, "include" | "exclude" | "minFileCount" | "wrappers" | "openFeatureClientBindings">;

const SEARCH_PATHS = [".flaglintrc", ".flaglintrc.json", "flaglint.config.json"];

function assertSupportedProvider(provider: string, configPath: string): void {
  if (provider !== "launchdarkly") {
    throw new Error(
      `Error in ${configPath}: provider "${provider}" is not supported in this version. ` +
        `Only "launchdarkly" is currently wired. Remove the provider field or set it to "launchdarkly".`
    );
  }
}

export async function loadConfig(configPath?: string): Promise<FlagLintConfig> {
  const candidates = configPath ? [configPath] : SEARCH_PATHS;

  for (const candidate of candidates) {
    const full = resolve(candidate);
    try {
      await access(full);
    } catch {
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(full, "utf8"));
    } catch (err) {
      throw new Error(`Error reading ${candidate}: ${String(err)}`);
    }

    let parsed: FlagLintConfig;
    try {
      parsed = FlagLintConfigSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        const detail = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        throw new Error(`Error in ${candidate}: ${detail}`);
      }
      throw err;
    }
    assertSupportedProvider(parsed.provider, candidate);
    return parsed;
  }

  return FlagLintConfigSchema.parse({});
}
