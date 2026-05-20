import { spawn } from "child_process";

export function runClaude(
  prompt: string,
  cwd: string,
  onOutput: (chunk: string) => void
): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("claude", ["-p", prompt], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    proc.stdout?.on("data", (c: Buffer) => onOutput(c.toString()));
    proc.stderr?.on("data", (c: Buffer) => onOutput(c.toString()));
    proc.on("close", (code) => resolve({ exitCode: code ?? 1 }));
  });
}
