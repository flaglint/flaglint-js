import { readFile, writeFile } from "fs/promises";

type PackageJson = {
  version: string;
  engines?: {
    node?: string;
  };
};

const WWW_PATH = "www/index.html";
const TYPES_PATH = "src/types.ts";
const PACKAGE_PATH = "package.json";

function replaceRequired(input: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(input)) {
    throw new Error(`sync-www failed: could not update ${label}`);
  }
  return input.replace(pattern, replacement);
}

async function reportFormats(): Promise<string[]> {
  const types = await readFile(TYPES_PATH, "utf8");
  const match = types.match(/export type ReportFormat = ([^;]+);/);
  if (!match?.[1]) {
    throw new Error("sync-www failed: could not find ReportFormat union");
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

function engineMajor(pkg: PackageJson): string {
  const engine = pkg.engines?.node;
  const major = engine?.match(/\d+/)?.[0];
  if (!major) {
    throw new Error("sync-www failed: could not find package.json engines.node major version");
  }
  return major;
}

function formatList(formats: string[]): string {
  if (formats.length <= 1) return formats.join("");
  return `${formats.slice(0, -1).join(", ")}, or ${formats.at(-1)}`;
}

function formatDisplayName(format: string): string {
  const names = new Map([
    ["json", "JSON"],
    ["markdown", "Markdown"],
    ["html", "HTML"],
    ["sarif", "SARIF"],
  ]);
  return names.get(format) ?? format;
}

function formatCountWord(count: number): string {
  const words = new Map([
    [1, "One"],
    [2, "Two"],
    [3, "Three"],
    [4, "Four"],
    [5, "Five"],
  ]);
  return words.get(count) ?? String(count);
}

async function main(): Promise<void> {
  const [www, packageRaw, formats] = await Promise.all([
    readFile(WWW_PATH, "utf8"),
    readFile(PACKAGE_PATH, "utf8"),
    reportFormats(),
  ]);

  const pkg = JSON.parse(packageRaw) as PackageJson;
  const formatted = formats.map(formatDisplayName);

  let next = www;
  next = replaceRequired(
    next,
    /<span class="term-version">flaglint v[^<]+<\/span>/,
    `<span class="term-version">flaglint v${pkg.version}</span>`,
    "terminal version"
  );
  next = replaceRequired(
    next,
    /<span class="stat-num">(?:\d+|CI)<\/span>\s*\n\s*<span class="stat-label">(?:tests passing|verified)<\/span>/,
    `<span class="stat-num">CI</span>\n          <span class="stat-label">verified</span>`,
    "trust stat"
  );
  next = replaceRequired(
    next,
    /<div class="format-badges">[\s\S]*?<\/div>\s*\n\s*<p class="step-body">Generates (?:a )?detailed reports? in [\s\S]*?<\/p>/,
    `<div class="format-badges">
            ${formatted.map((f) => `<span class="badge-pill">${f}</span>`).join("\n            ")}
          </div>
          <p class="step-body">Generates detailed reports in ${formatList(formatted)}. Know exactly what LaunchDarkly Node.js SDK calls exist, where they are, and which are safely automatable.</p>`,
    "report format step"
  );
  next = replaceRequired(
    next,
    /<div class="feature-title">[^<]* report formats<\/div>\s*\n\s*<p class="feature-body">[^<]*<\/p>/,
    `<div class="feature-title">${formatCountWord(formatted.length)} report formats</div>
          <p class="feature-body">JSON for pipelines. Markdown for PRs. HTML for sharing. SARIF for GitHub Code Scanning.</p>`,
    "report format feature"
  );
  next = replaceRequired(
    next,
    /Supports Node\.js \d+\+\./,
    `Supports Node.js ${engineMajor(pkg)}+.`,
    "Node.js engine"
  );

  if (next !== www) {
    await writeFile(WWW_PATH, next, "utf8");
    process.stdout.write("Synced www/index.html from package and source metadata.\n");
  } else {
    process.stdout.write("www/index.html already in sync.\n");
  }
}

await main();
