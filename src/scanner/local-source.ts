import fg from "fast-glob";
import { readFile, writeFile } from "fs/promises";
import { join, relative, resolve } from "path";
import type { FileSource } from "../types.js";
import { DEFAULT_EXCLUDE } from "./index.js";

export class LocalFileSource implements FileSource {
  readonly root: string;

  constructor(private readonly dir: string) {
    this.root = resolve(dir);
  }

  async listFiles(include: string[], exclude: string[]): Promise<string[]> {
    const files = await fg(include, {
      cwd: this.dir,
      absolute: true,
      ignore: [...DEFAULT_EXCLUDE, ...exclude],
      onlyFiles: true,
    });
    return files.map((f) => relative(this.dir, f));
  }

  async readFile(path: string): Promise<string> {
    return readFile(join(this.dir, path), "utf8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(join(this.dir, path), content, "utf8");
  }
}
