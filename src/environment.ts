/**
 * Lexical scopes with a parent chain.
 *
 * `define` always writes to the current scope (used for declarations and
 * parameters). `assign` walks up the chain to find an existing binding (used
 * for `x = ...`), and errors if the name was never declared — so typos surface
 * instead of silently creating globals.
 */

import { YapValue } from "./values.js";

export class Environment {
  private readonly values = new Map<string, YapValue>();
  readonly parent: Environment | undefined;

  constructor(parent?: Environment) {
    this.parent = parent;
  }

  define(name: string, value: YapValue): void {
    this.values.set(name, value);
  }

  has(name: string): boolean {
    if (this.values.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }

  /** Returns the value, or throws `NameNotFound` if undeclared. */
  get(name: string): YapValue {
    if (this.values.has(name)) {
      return this.values.get(name) as YapValue;
    }
    if (this.parent) return this.parent.get(name);
    throw new NameNotFound(name);
  }

  /** Reassigns an existing binding, or throws `NameNotFound`. */
  assign(name: string, value: YapValue): void {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value);
      return;
    }
    throw new NameNotFound(name);
  }
}

/** Internal signal — the interpreter converts this into a YapRuntimeError with
 * a line number. */
export class NameNotFound extends Error {
  readonly nameSought: string;
  constructor(name: string) {
    super(`name not found: ${name}`);
    this.name = "NameNotFound";
    this.nameSought = name;
  }
}
