/**
 * Built-in functions. These live in the global scope as ordinary callables, so
 * a user could even shadow them with their own `vibe spill = ...`.
 *
 * Built-ins signal bad arguments by throwing `BuiltinError`; the interpreter
 * catches it at the call site and attaches the line number.
 */
//
//
//
//
//
//
//
//
//
import { BuiltinError } from "./errors.js";
import {
  CallContext,
  isCallable,
  stringify,
  typeName,
  YapCallable,
  YapValue,
} from "./values.js";

class BuiltinFunction implements YapCallable {
  readonly isYapCallable = true as const;
  constructor(
    readonly name: string,
    private readonly arityValue: number | "variadic",
    private readonly impl: (
      ctx: CallContext,
      args: YapValue[],
      line: number,
    ) => YapValue,
  ) {}

  arity(): number | "variadic" {
    return this.arityValue;
  }

  call(ctx: CallContext, args: YapValue[], line: number): YapValue {
    return this.impl(ctx, args, line);
  }
}

function expectString(value: YapValue, fn: string, pos: string): string {
  if (typeof value !== "string") {
    throw new BuiltinError(
      `'${fn}' wanted a string ${pos}, but got a ${typeName(value)}`,
    );
  }
  return value;
}

function expectArray(value: YapValue, fn: string, pos: string): YapValue[] {
  if (!Array.isArray(value)) {
    throw new BuiltinError(
      `'${fn}' wanted an array ${pos}, but got a ${typeName(value)}`,
    );
  }
  return value;
}

/**
 * Builds the standard library. Each call gets a fresh set bound to the given
 * output sink so the CLI and the playground can capture prints independently.
 */
export function createBuiltins(): Record<string, YapCallable> {
  const builtins: BuiltinFunction[] = [
    // spill(...args) -> ghosted. Prints args joined by spaces.
    new BuiltinFunction("spill", "variadic", (ctx, args) => {
      ctx.output(args.map((a) => stringify(a, true)).join(" "));
      return null;
    }),

    // vibecheck(x) -> the type name as a string.
    new BuiltinFunction("vibecheck", 1, (_ctx, args) => {
      return typeName(args[0] as YapValue);
    }),

    // howmany(x) -> length of a string or array.
    new BuiltinFunction("howmany", 1, (_ctx, args) => {
      const x = args[0] as YapValue;
      if (typeof x === "string") return x.length;
      if (Array.isArray(x)) return x.length;
      throw new BuiltinError(
        `'howmany' only counts strings or arrays, not a ${typeName(x)}`,
      );
    }),

    // glowup(s) -> uppercase.
    new BuiltinFunction("glowup", 1, (_ctx, args) => {
      return expectString(args[0] as YapValue, "glowup", "to shout").toUpperCase();
    }),

    // chill(s) -> lowercase.
    new BuiltinFunction("chill", 1, (_ctx, args) => {
      return expectString(args[0] as YapValue, "chill", "to relax").toLowerCase();
    }),

    // slide(arr, x) -> push x, return new length.
    new BuiltinFunction("slide", 2, (_ctx, args) => {
      const arr = expectArray(args[0] as YapValue, "slide", "as its first arg");
      arr.push(args[1] as YapValue);
      return arr.length;
    }),

    // yoink(arr) -> pop and return the last element (ghosted if empty).
    new BuiltinFunction("yoink", 1, (_ctx, args) => {
      const arr = expectArray(args[0] as YapValue, "yoink", "");
      if (arr.length === 0) return null;
      return arr.pop() as YapValue;
    }),

    // numify(s) -> parse a string into a number.
    new BuiltinFunction("numify", 1, (_ctx, args) => {
      const s = expectString(args[0] as YapValue, "numify", "to parse").trim();
      if (s === "") {
        throw new BuiltinError(`'numify' can't read an empty string as a number`);
      }
      const n = Number(s);
      if (Number.isNaN(n)) {
        throw new BuiltinError(`'numify' flopped: "${s}" is not a number`);
      }
      return n;
    }),
  ];

  const table: Record<string, YapCallable> = {};
  for (const fn of builtins) table[fn.name] = fn;
  return table;
}

/** Names reserved by the standard library (handy for tooling/tests). */
export function builtinNames(): string[] {
  return Object.keys(createBuiltins());
}

// Re-exported so callers can narrow without importing values directly.
export { isCallable };
