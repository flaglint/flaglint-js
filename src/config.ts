import { existsSync, readFileSync } from "fs";
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
  provider: z
    .enum(["launchdarkly", "unleash", "growthbook", "custom"])
    .default("launchdarkly"),
  staleThreshold: z.number().int().min(0).default(1),
  reportTitle: z.string().optional(),
  outputDir: z.string().default("."),
});

export type FlagLintConfig = z.infer<typeof FlagLintConfigSchema>;

const SEARCH_PATHS = [".flaglintrc", ".flaglintrc.json", "flaglint.config.json"];

export function loadConfig(configPath?: string): FlagLintConfig {
  const candidates = configPath ? [configPath] : SEARCH_PATHS;

  for (const candidate of candidates) {
    const full = resolve(candidate);
    if (!existsSync(full)) continue;

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(full, "utf8"));
    } catch (err) {
      throw new Error(`Error reading ${candidate}: ${String(err)}`);
    }

    try {
      return FlagLintConfigSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        const detail = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        throw new Error(`Error in ${candidate}: ${detail}`);
      }
      throw err;
    }
  }

  return FlagLintConfigSchema.parse({});
}
