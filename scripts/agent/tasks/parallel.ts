import { spawn } from "child_process";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import chalk from "chalk";

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../prompts");

const COLORS: Array<(s: string) => string> = [
  chalk.cyan,
  chalk.green,
  chalk.yellow,
  chalk.magenta,
  chalk.blue,
  (s) => chalk.white(s),
];

function addWorktree(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", ["worktree", "add", path, "HEAD"], { stdio: "pipe" });
    let err = "";
    proc.stderr?.on("data", (c: Buffer) => { err += c.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git worktree add failed: ${err.trim()}`));
    });
  });
}

function removeWorktree(path: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("git", ["worktree", "remove", "--force", path], { stdio: "pipe" });
    proc.on("close", () => resolve());
  });
}

export async function runParallel(
  promptList: string,
  options: { isolated?: boolean }
): Promise<void> {
  const names = promptList.split(",").map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    process.stderr.write(chalk.red("No prompt names provided.\n"));
    process.exit(1);
  }

  // Read all prompt files upfront
  const resolved = await Promise.all(
    names.map(async (name) => {
      const content = await readFile(join(PROMPTS_DIR, `${name}.md`), "utf8").catch(() => null);
      return { name, content };
    })
  );

  const missing = resolved.filter((r) => r.content === null);
  if (missing.length > 0) {
    process.stderr.write(
      chalk.red(`Missing prompt files: ${missing.map((r) => `${r.name}.md`).join(", ")}\n`)
    );
    process.exit(1);
  }

  // Set up worktrees if requested
  const worktrees: string[] = [];
  const cwds = await Promise.all(
    names.map(async (name) => {
      if (!options.isolated) return process.cwd();
      const wtPath = join(tmpdir(), `flaglint-${name}-${Date.now()}`);
      await addWorktree(wtPath);
      worktrees.push(wtPath);
      process.stdout.write(chalk.dim(`[${name}] worktree: ${wtPath}\n`));
      return wtPath;
    })
  );

  process.stdout.write(
    chalk.bold(`\nRunning ${names.length} prompt(s) in parallel...\n\n`)
  );

  // Track active processes for SIGINT handling
  const activeProcs: ReturnType<typeof spawn>[] = [];

  const cleanup = () =>
    Promise.all(worktrees.map((wt) => removeWorktree(wt).catch(() => {})));

  process.once("SIGINT", () => {
    process.stdout.write(chalk.yellow("\nInterrupted — stopping all subprocesses...\n"));
    for (const proc of activeProcs) proc.kill("SIGTERM");
    const timer = setTimeout(() => {
      for (const proc of activeProcs) proc.kill("SIGKILL");
    }, 5000);
    timer.unref();
    void cleanup().then(() => process.exit(130));
  });

  const results = await Promise.all(
    resolved.map(({ name, content }, i) => {
      const color = COLORS[i % COLORS.length];
      const prefix = color(`[${name}] `);
      const cwd = cwds[i];

      return new Promise<boolean>((resolve) => {
        const proc = spawn("claude", ["-p", content!], {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        });
        activeProcs.push(proc);

        proc.stdout?.on("data", (c: Buffer) => {
          for (const line of c.toString().split("\n")) {
            if (line) process.stdout.write(prefix + line + "\n");
          }
        });
        proc.stderr?.on("data", (c: Buffer) => {
          for (const line of c.toString().split("\n")) {
            if (line) process.stderr.write(prefix + line + "\n");
          }
        });
        proc.on("close", (code) => {
          const idx = activeProcs.indexOf(proc);
          if (idx !== -1) activeProcs.splice(idx, 1);
          if (code !== 0) {
            process.stderr.write(prefix + chalk.red(`Exited ${code ?? "?"}\n`));
            resolve(false);
          } else {
            process.stdout.write(prefix + chalk.green("Done\n"));
            resolve(true);
          }
        });
      });
    })
  );

  await cleanup();
  process.exit(results.every(Boolean) ? 0 : 1);
}
