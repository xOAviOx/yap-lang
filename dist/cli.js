#!/usr/bin/env node
import {
  FILE_EXTENSION,
  LANGUAGE_NAME,
  run
} from "./chunk-INOSTKA3.js";

// src/cli.ts
import { readFileSync } from "fs";
import { resolve, extname } from "path";
var VERSION = "0.1.0";
function usage() {
  return [
    `${LANGUAGE_NAME} v${VERSION} \u2014 a Gen-Z toy language \u{1F525}`,
    "",
    "Usage:",
    `  yap <file${FILE_EXTENSION}>     run a program`,
    "  yap --version          print the version",
    "  yap --help             show this help",
    "",
    "Example:",
    "  yap examples/fizzbuzz.yap"
  ].join("\n");
}
function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return args.length === 0 ? 1 : 0;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return 0;
  }
  const filePath = args[0];
  if (extname(filePath) !== FILE_EXTENSION) {
    console.error(
      `\u26A0\uFE0F  heads up: '${filePath}' doesn't end in '${FILE_EXTENSION}'. Running it anyway...`
    );
  }
  let source;
  try {
    source = readFileSync(resolve(filePath), "utf8");
  } catch {
    console.error(`\u{1F480} can't find that file: '${filePath}'`);
    return 1;
  }
  const result = run(source, (text) => console.log(text));
  return result.ok ? 0 : 1;
}
process.exit(main(process.argv));
//# sourceMappingURL=cli.js.map