import { spawn } from "child_process";

function git(args: string[], cwd = process.cwd()): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout.on("data", (c: Buffer) => { out += c.toString(); });
    proc.stderr.on("data", (c: Buffer) => { err += c.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`git ${args.join(" ")} exited ${code}: ${err.trim()}`));
    });
  });
}

export async function getStatus(cwd?: string): Promise<string> {
  return git(["status", "--porcelain"], cwd);
}

export async function getCurrentBranch(cwd?: string): Promise<string> {
  return (await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)).trim();
}

export async function getRemoteUrl(remote = "origin", cwd?: string): Promise<string> {
  return (await git(["remote", "get-url", remote], cwd)).trim();
}

export async function createTag(name: string, cwd?: string): Promise<void> {
  await git(["tag", name], cwd);
}

export async function pushTags(remote = "origin", branch = "main", cwd?: string): Promise<void> {
  await git(["push", remote, branch, "--tags"], cwd);
}
