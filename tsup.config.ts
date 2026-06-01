import { defineConfig } from "tsup";

export default defineConfig([
  // Main library + CLI build (Node). tsup preserves the `#!/usr/bin/env node`
  // shebang from src/cli.ts automatically.
  {
    entry: ["src/cli.ts", "src/runner.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node18",
    platform: "node",
    outDir: "dist",
  },
  // Self-contained browser bundle for the playground. The playground page
  // imports this with a relative path so `npx serve playground` just works.
  {
    entry: { yaplang: "src/runner.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: false,
    target: "es2020",
    platform: "browser",
    outDir: "playground",
    minify: false,
  },
]);
