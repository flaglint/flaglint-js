import { readFile, writeFile } from "fs/promises";

type PackageJson = {
  version: string;
  engines?: {
    node?: string;
  };
};

const WWW_PATH = "docs-src/pages/index.astro";
const PACKAGE_PATH = "package.json";

function replaceRequired(input: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(input)) {
    throw new Error(`sync-www failed: could not update ${label}`);
  }
  return input.replace(pattern, replacement);
}

function engineMajor(pkg: PackageJson): string {
  const engine = pkg.engines?.node;
  const major = engine?.match(/\d+/)?.[0];
  if (!major) {
    throw new Error("sync-www failed: could not find package.json engines.node major version");
  }
  return major;
}

async function main(): Promise<void> {
  const [www, packageRaw] = await Promise.all([
    readFile(WWW_PATH, "utf8"),
    readFile(PACKAGE_PATH, "utf8"),
  ]);

  const pkg = JSON.parse(packageRaw) as PackageJson;

  let next = www;
  next = replaceRequired(
    next,
    /<span class="term-version">flaglint v[^<]+<\/span>/,
    `<span class="term-version">flaglint v${pkg.version}</span>`,
    "terminal version"
  );
  next = replaceRequired(
    next,
    /<span>Node\.js \d+\+<\/span>/,
    `<span>Node.js ${engineMajor(pkg)}+</span>`,
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
