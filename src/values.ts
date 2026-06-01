/**
 * Runtime value model for YapLang.
 *
 * A YapValue is one of:
 *   - number   (JS number)
 *   - string   (JS string)
 *   - boolean  (JS boolean)
 *   - null     (the `ghosted` value)
 *   - array    (JS array of YapValue)
 *   - callable (user function or built-in)
 */

export type YapValue = number | string | boolean | null | YapValue[] | YapCallable;

export interface YapCallable {
  readonly isYapCallable: true;
  /** Display name, e.g. "fib" or "spill". */
  readonly name: string;
  /** Number of expected args, or "variadic" for built-ins like spill. */
  arity(): number | "variadic";
  /** Invoke. `line` is the call site, used by built-ins for error messages. */
  call(interpreter: CallContext, args: YapValue[], line: number): YapValue;
}

/**
 * The slice of the interpreter that callables are allowed to touch. Keeping it
 * narrow avoids a circular import with interpreter.ts: built-ins only ever need
 * somewhere to print, and user functions carry their own interpreter reference.
 */
export interface CallContext {
  readonly output: (text: string) => void;
}

export function isCallable(value: YapValue): value is YapCallable {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as YapCallable).isYapCallable === true
  );
}

export type YapTypeName =
  | "number"
  | "string"
  | "boolean"
  | "ghosted"
  | "array"
  | "function";

export function typeName(value: YapValue): YapTypeName {
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (value === null) return "ghosted";
  if (Array.isArray(value)) return "array";
  return "function";
}

/**
 * Truthiness rules (kept deliberately simple for beginners):
 *   - `cap` (false) and `ghosted` (null) are falsy.
 *   - EVERYTHING else is truthy, including 0 and "".
 */
export function isTruthy(value: YapValue): boolean {
  if (value === false) return false;
  if (value === null) return false;
  return true;
}

/**
 * Renders a value as text.
 *  - `topLevel` strings print without quotes (so `spill("hi")` -> hi).
 *  - Inside arrays, strings are quoted so output is unambiguous.
 */
export function stringify(value: YapValue, topLevel = true): string {
  if (value === null) return "ghosted";
  if (value === true) return "nocap";
  if (value === false) return "cap";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") {
    return topLevel ? value : `"${value}"`;
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stringify(v, false)).join(", ") + "]";
  }
  // Callable
  return `<bestie ${value.name}>`;
}

function formatNumber(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Infinity";
  if (n === -Infinity) return "-Infinity";
  // Avoid "-0".
  if (Object.is(n, -0)) return "0";
  return String(n);
}

/** Structural equality for `==` / `!=`. Arrays/functions compare by identity. */
export function valuesEqual(a: YapValue, b: YapValue): boolean {
  if (typeof a !== typeof b) {
    // typeof null === "object", typeof [] === "object"; normalise via Object.is.
    return a === b;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a === b;
  }
  return a === b;
}
