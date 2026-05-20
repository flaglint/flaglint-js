import { defineConfig } from "tsup";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string; description: string };

export default defineConfig({
  entry: { "bin/flaglint": "bin/flaglint.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node22",
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
    __PKG_DESCRIPTION__: JSON.stringify(pkg.description),
  },
});
