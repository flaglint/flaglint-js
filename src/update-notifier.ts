import { readFile, writeFile, mkdir } from "fs/promises";
import { get } from "https";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";

declare const __PKG_VERSION__: string;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
// Respect XDG_CONFIG_HOME so tests can redirect to a temp dir
const CACHE_DIR = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
  "flaglint"
);
const CACHE_FILE = join(CACHE_DIR, "update-check.json");

interface UpdateCache {
  latestVersion: string;
  checkedAt: number;
}

function isCI(): boolean {
  return Boolean(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.BUILD_ID ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI
  );
}

function isNewerVersion(latest: string, current: string): boolean {
  const toInts = (v: string) => v.split(".").map(Number) as [number, number, number];
  const [lMaj, lMin, lPat] = toInts(latest);
  const [cMaj, cMin, cPat] = toInts(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    return JSON.parse(await readFile(CACHE_FILE, "utf8")) as UpdateCache;
  } catch {
    return null;
  }
}

function backgroundFetch(): void {
  // Uses https.get + req.unref() so this never keeps the process alive
  try {
    const req = get(
      "https://registry.npmjs.org/flaglint/latest",
      { headers: { Accept: "application/json", "User-Agent": `flaglint/${__PKG_VERSION__}` } },
      (res) => {
        let raw = "";
        res.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
        res.on("end", () => {
          try {
            const { version } = JSON.parse(raw) as { version: string };
            if (typeof version !== "string") return;
            void mkdir(CACHE_DIR, { recursive: true }).then(() =>
              writeFile(
                CACHE_FILE,
                JSON.stringify({ latestVersion: version, checkedAt: Date.now() } satisfies UpdateCache)
              )
            );
          } catch {
            // ignore parse/write errors
          }
        });
      }
    );
    req.on("socket", (s) => s.unref()); // never keep the process alive waiting for this
    req.on("error", () => {});
    setTimeout(() => req.destroy(), 3000).unref();
  } catch {
    // ignore
  }
}

export function checkForUpdate(): void {
  if (isCI() || process.env.FLAGLINT_NO_UPDATE_CHECK) return;

  void readCache().then((cache) => {
    if (cache?.latestVersion && isNewerVersion(cache.latestVersion, __PKG_VERSION__)) {
      process.stderr.write(
        `\n  ${chalk.yellow("Update available:")} ${chalk.dim(__PKG_VERSION__)} → ${chalk.green.bold(cache.latestVersion)}\n` +
        `  Run: ${chalk.cyan(`npm install -g flaglint@${cache.latestVersion}`)}\n` +
        `       ${chalk.cyan("brew upgrade flaglint")}\n\n`
      );
    }
    if (!cache || Date.now() - cache.checkedAt > CACHE_TTL_MS) {
      backgroundFetch();
    }
  });
}
