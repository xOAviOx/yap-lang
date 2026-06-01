/**
 * YapLang error types.
 *
 * Every user-facing error carries a line number and a Gen-Z flavored — but
 * genuinely clear — message. `runner.ts` catches these and prints `.message`
 * so the process never dies with a raw stack trace.
 */

export class YapError extends Error {
  /** 1-based line where the error occurred (0 if unknown). */
  readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = "YapError";
    this.line = line;
    // Keep the prototype chain correct when targeting older runtimes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised by the lexer/parser when the source doesn't parse. */
export class YapSyntaxError extends YapError {
  constructor(message: string, line: number) {
    super(message, line);
    this.name = "YapSyntaxError";
  }
}

/** Raised by the interpreter while a program is running. */
export class YapRuntimeError extends YapError {
  constructor(message: string, line: number) {
    super(message, line);
    this.name = "YapRuntimeError";
  }
}

/**
 * Thrown by built-in functions, which don't know their own call site. The
 * interpreter catches these and re-throws them as a YapRuntimeError with the
 * correct line number attached.
 */
export class BuiltinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuiltinError";
  }
}

// --- Flavored constructors ---------------------------------------------------

export function syntaxError(line: number, detail: string): YapSyntaxError {
  return new YapSyntaxError(`💀 sus syntax at line ${line}: ${detail}`, line);
}

export function nameError(line: number, detail: string): YapRuntimeError {
  return new YapRuntimeError(`💀 fr real? at line ${line}: ${detail}`, line);
}

export function runtimeError(line: number, detail: string): YapRuntimeError {
  return new YapRuntimeError(`💀 that ain't it at line ${line}: ${detail}`, line);
}
