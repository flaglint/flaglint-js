import fg from "fast-glob";
import { readFile } from "fs/promises";
import { join, relative } from "path";
import type { FileSource } from "../types.js";
import { DEFAULT_EXCLUDE } from "./index.js";

export class LocalFileSource implements FileSource {
  constructor(private readonly dir: string) {}

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
}
