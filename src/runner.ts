/**
 * The public entry point: ties the lexer, parser, and interpreter together.
 *
 * `run` never throws for ordinary program errors — it catches YapError and
 * reports a friendly, line-numbered message through the same `output` sink used
 * for prints, so both the CLI and the browser playground behave identically.
 */

import { YapError } from "./errors.js";
import { Interpreter } from "./interpreter.js";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { LANGUAGE_NAME } from "./keywords.js";

export interface RunResult {
  ok: boolean;
  /** Present when the run failed: the friendly error message. */
  error?: string;
}

export type OutputFn = (text: string) => void;

const defaultOutput: OutputFn = (text) => console.log(text);

export function run(source: string, output: OutputFn = defaultOutput): RunResult {
  try {
    const tokens = new Lexer(source).scan();
    const program = new Parser(tokens).parse();
    const interpreter = new Interpreter(output);
    interpreter.interpret(program);
    return { ok: true };
  } catch (e) {
    if (e instanceof YapError) {
      output(e.message);
      return { ok: false, error: e.message };
    }
    // Anything else is a bug in YapLang itself — still don't dump a raw trace.
    const detail = e instanceof Error ? e.message : String(e);
    const message = `💀 ${LANGUAGE_NAME} tripped over itself (this is a bug): ${detail}`;
    output(message);
    return { ok: false, error: message };
  }
}

// Re-exports so embedders (and the playground bundle) get a tidy surface.
export { Interpreter } from "./interpreter.js";
export { Lexer, tokenize } from "./lexer.js";
export { Parser, parse } from "./parser.js";
export { YapError, YapSyntaxError, YapRuntimeError } from "./errors.js";
export { LANGUAGE_NAME, FILE_EXTENSION, KEYWORDS } from "./keywords.js";
