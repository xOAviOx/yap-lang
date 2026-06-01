/**
 * Tree-walking interpreter.
 *
 * Control flow that crosses statement boundaries (return / break / continue) is
 * implemented with thrown sentinel objects, caught by the relevant node:
 *   - ReturnSignal is caught by a function body.
 *   - BreakSignal / ContinueSignal are caught by loops.
 * A `loopDepth` counter (reset across function calls) makes `dip`/`skrt` outside
 * a loop a clean runtime error instead of a leaked exception.
 */

import {
  Block,
  Expr,
  FunctionDecl,
  Program,
  Stmt,
} from "./ast.js";
import { createBuiltins } from "./builtins.js";
import { Environment, NameNotFound } from "./environment.js";
import { BuiltinError, nameError, runtimeError } from "./errors.js";
import {
  CallContext,
  isCallable,
  isTruthy,
  stringify,
  typeName,
  valuesEqual,
  YapCallable,
  YapValue,
} from "./values.js";

// --- Control-flow signals ----------------------------------------------------

class ReturnSignal {
  constructor(readonly value: YapValue) {}
}
class BreakSignal {}
class ContinueSignal {}

const BREAK = new BreakSignal();
const CONTINUE = new ContinueSignal();

// --- User-defined functions --------------------------------------------------

class YapFunction implements YapCallable {
  readonly isYapCallable = true as const;
  readonly name: string;

  constructor(
    private readonly declaration: FunctionDecl,
    private readonly closure: Environment,
    private readonly interpreter: Interpreter,
  ) {
    this.name = declaration.name;
  }

  arity(): number {
    return this.declaration.params.length;
  }

  call(_ctx: CallContext, args: YapValue[]): YapValue {
    const env = new Environment(this.closure);
    const params = this.declaration.params;
    for (let i = 0; i < params.length; i++) {
      env.define(params[i] as string, args[i] as YapValue);
    }
    return this.interpreter.runFunctionBody(this.declaration.body, env);
  }
}

// --- The interpreter ---------------------------------------------------------

export class Interpreter implements CallContext {
  readonly output: (text: string) => void;
  private readonly globals: Environment;
  private env: Environment;
  private loopDepth = 0;

  constructor(output: (text: string) => void = (t) => console.log(t)) {
    this.output = output;
    this.globals = new Environment();
    this.env = this.globals;

    // Install the standard library.
    const builtins = createBuiltins();
    for (const [name, fn] of Object.entries(builtins)) {
      this.globals.define(name, fn);
    }
  }

  interpret(program: Program): void {
    for (const stmt of program.statements) {
      this.execute(stmt);
    }
  }

  /** Runs a function body in `env`, unwrapping a `bet` return value. */
  runFunctionBody(body: Block, env: Environment): YapValue {
    const savedLoopDepth = this.loopDepth;
    this.loopDepth = 0; // a loop outside the fn doesn't make a bare `dip` legal
    try {
      this.executeBlock(body.statements, env);
      return null; // fell off the end with no `bet`
    } catch (signal) {
      if (signal instanceof ReturnSignal) return signal.value;
      throw signal;
    } finally {
      this.loopDepth = savedLoopDepth;
    }
  }

  // --- Statements ------------------------------------------------------------

  private execute(stmt: Stmt): void {
    switch (stmt.kind) {
      case "ExpressionStmt":
        this.evaluate(stmt.expression);
        return;

      case "VarDecl":
        this.env.define(stmt.name, this.evaluate(stmt.initializer));
        return;

      case "FunctionDecl": {
        const fn = new YapFunction(stmt, this.env, this);
        this.env.define(stmt.name, fn);
        return;
      }

      case "Block":
        this.executeBlock(stmt.statements, new Environment(this.env));
        return;

      case "IfStmt": {
        if (isTruthy(this.evaluate(stmt.condition))) {
          this.executeBlock(stmt.thenBranch.statements, new Environment(this.env));
        } else if (stmt.elseBranch) {
          if (stmt.elseBranch.kind === "IfStmt") {
            this.execute(stmt.elseBranch);
          } else {
            this.executeBlock(
              stmt.elseBranch.statements,
              new Environment(this.env),
            );
          }
        }
        return;
      }

      case "WhileStmt": {
        while (isTruthy(this.evaluate(stmt.condition))) {
          const signal = this.runLoopBody(stmt.body);
          if (signal === "break") break;
        }
        return;
      }

      case "ForStmt": {
        const loopEnv = new Environment(this.env);
        const previous = this.env;
        this.env = loopEnv;
        try {
          if (stmt.initializer) this.execute(stmt.initializer);
          while (stmt.condition ? isTruthy(this.evaluate(stmt.condition)) : true) {
            const signal = this.runLoopBody(stmt.body);
            if (signal === "break") break;
            // `continue` still runs the update clause.
            if (stmt.update) this.evaluate(stmt.update);
          }
        } finally {
          this.env = previous;
        }
        return;
      }

      case "ReturnStmt": {
        const value = stmt.value ? this.evaluate(stmt.value) : null;
        throw new ReturnSignal(value);
      }

      case "BreakStmt":
        if (this.loopDepth === 0) {
          throw runtimeError(stmt.line, `'dip' only works inside a loop`);
        }
        throw BREAK;

      case "ContinueStmt":
        if (this.loopDepth === 0) {
          throw runtimeError(stmt.line, `'skrt' only works inside a loop`);
        }
        throw CONTINUE;
    }
  }

  /**
   * Runs a loop body once. Returns "break" if a `dip` fired, otherwise
   * "normal" (covers both natural completion and a `skrt`).
   */
  private runLoopBody(body: Block): "break" | "normal" {
    this.loopDepth++;
    try {
      this.executeBlock(body.statements, new Environment(this.env));
      return "normal";
    } catch (signal) {
      if (signal instanceof BreakSignal) return "break";
      if (signal instanceof ContinueSignal) return "normal";
      throw signal;
    } finally {
      this.loopDepth--;
    }
  }

  executeBlock(statements: Stmt[], env: Environment): void {
    const previous = this.env;
    this.env = env;
    try {
      for (const stmt of statements) this.execute(stmt);
    } finally {
      this.env = previous;
    }
  }

  // --- Expressions -----------------------------------------------------------

  private evaluate(expr: Expr): YapValue {
    switch (expr.kind) {
      case "NumberLiteral":
        return expr.value;
      case "StringLiteral":
        return expr.value;
      case "BooleanLiteral":
        return expr.value;
      case "NullLiteral":
        return null;

      case "ArrayLiteral":
        return expr.elements.map((el) => this.evaluate(el));

      case "Variable":
        try {
          return this.env.get(expr.name);
        } catch (e) {
          if (e instanceof NameNotFound) {
            throw nameError(expr.line, `'${expr.name}' is not defined`);
          }
          throw e;
        }

      case "Assign":
        return this.evaluateAssign(expr);

      case "Logical": {
        const left = this.evaluate(expr.left);
        if (expr.operator === "or") {
          return isTruthy(left) ? left : this.evaluate(expr.right);
        }
        // and
        return isTruthy(left) ? this.evaluate(expr.right) : left;
      }

      case "Unary":
        return this.evaluateUnary(expr.operator, expr.operand, expr.line);

      case "Binary":
        return this.evaluateBinary(
          expr.operator,
          this.evaluate(expr.left),
          this.evaluate(expr.right),
          expr.line,
        );

      case "IndexExpr":
        return this.evaluateIndexGet(expr.object, expr.index, expr.line);

      case "CallExpr":
        return this.evaluateCall(expr.callee, expr.args, expr.line);
    }
  }

  private evaluateAssign(expr: Extract<Expr, { kind: "Assign" }>): YapValue {
    const value = this.evaluate(expr.value);
    const target = expr.target;

    if (target.kind === "Variable") {
      try {
        this.env.assign(target.name, value);
      } catch (e) {
        if (e instanceof NameNotFound) {
          throw nameError(
            target.line,
            `'${target.name}' is not defined — declare it with 'vibe' first`,
          );
        }
        throw e;
      }
      return value;
    }

    // IndexExpr target: arr[i] = value
    const object = this.evaluate(target.object);
    const index = this.evaluate(target.index);
    if (!Array.isArray(object)) {
      throw runtimeError(
        target.line,
        `can only assign into arrays, not a ${typeName(object)}`,
      );
    }
    const i = this.asArrayIndex(index, object.length, target.line);
    object[i] = value;
    return value;
  }

  private evaluateUnary(operator: "-" | "not", operandExpr: Expr, line: number): YapValue {
    const operand = this.evaluate(operandExpr);
    if (operator === "-") {
      if (typeof operand !== "number") {
        throw runtimeError(
          line,
          `can't negate a ${typeName(operand)} — '-' wants a number`,
        );
      }
      return -operand;
    }
    // not (sus)
    return !isTruthy(operand);
  }

  private evaluateBinary(
    operator: string,
    left: YapValue,
    right: YapValue,
    line: number,
  ): YapValue {
    switch (operator) {
      case "+":
        if (typeof left === "number" && typeof right === "number") {
          return left + right;
        }
        if (typeof left === "string" || typeof right === "string") {
          return stringify(left, true) + stringify(right, true);
        }
        throw runtimeError(
          line,
          `can't add a ${typeName(left)} and a ${typeName(right)}`,
        );

      case "-":
        return this.arith(left, right, line, "-", (a, b) => a - b);
      case "*":
        return this.arith(left, right, line, "*", (a, b) => a * b);
      case "/":
        this.checkNumbers(left, right, line, "/");
        if (right === 0) {
          throw runtimeError(line, `can't divide by zero`);
        }
        return (left as number) / (right as number);
      case "%":
        this.checkNumbers(left, right, line, "%");
        if (right === 0) {
          throw runtimeError(line, `can't mod by zero`);
        }
        return (left as number) % (right as number);

      case "==":
        return valuesEqual(left, right);
      case "!=":
        return !valuesEqual(left, right);

      case "<":
        return this.compare(left, right, line) < 0;
      case ">":
        return this.compare(left, right, line) > 0;
      case "<=":
        return this.compare(left, right, line) <= 0;
      case ">=":
        return this.compare(left, right, line) >= 0;

      default:
        throw runtimeError(line, `unknown operator '${operator}'`);
    }
  }

  private arith(
    left: YapValue,
    right: YapValue,
    line: number,
    op: string,
    fn: (a: number, b: number) => number,
  ): number {
    this.checkNumbers(left, right, line, op);
    return fn(left as number, right as number);
  }

  private checkNumbers(
    left: YapValue,
    right: YapValue,
    line: number,
    op: string,
  ): void {
    if (typeof left !== "number" || typeof right !== "number") {
      throw runtimeError(
        line,
        `'${op}' only works on numbers, not a ${typeName(left)} and a ${typeName(right)}`,
      );
    }
  }

  /** Returns negative/zero/positive like a comparator. Errors on bad types. */
  private compare(left: YapValue, right: YapValue, line: number): number {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    if (typeof left === "string" && typeof right === "string") {
      return left < right ? -1 : left > right ? 1 : 0;
    }
    throw runtimeError(
      line,
      `can't compare a ${typeName(left)} with a ${typeName(right)}`,
    );
  }

  private evaluateIndexGet(objectExpr: Expr, indexExpr: Expr, line: number): YapValue {
    const object = this.evaluate(objectExpr);
    const index = this.evaluate(indexExpr);

    if (Array.isArray(object)) {
      const i = this.asArrayIndex(index, object.length, line);
      return object[i] as YapValue;
    }
    if (typeof object === "string") {
      const i = this.asArrayIndex(index, object.length, line);
      return object[i] as string;
    }
    throw runtimeError(
      line,
      `can't index into a ${typeName(object)} — only arrays and strings`,
    );
  }

  private asArrayIndex(index: YapValue, length: number, line: number): number {
    if (typeof index !== "number" || !Number.isInteger(index)) {
      throw runtimeError(
        line,
        `array index must be a whole number, got ${stringify(index, true)}`,
      );
    }
    if (index < 0 || index >= length) {
      throw runtimeError(
        line,
        `index ${index} is out of bounds (length ${length})`,
      );
    }
    return index;
  }

  private evaluateCall(calleeExpr: Expr, argExprs: Expr[], line: number): YapValue {
    const callee = this.evaluate(calleeExpr);
    const args = argExprs.map((a) => this.evaluate(a));

    if (!isCallable(callee)) {
      throw runtimeError(
        line,
        `can't call a ${typeName(callee)} — that's not a bestie`,
      );
    }

    const arity = callee.arity();
    if (arity !== "variadic" && args.length !== arity) {
      throw runtimeError(
        line,
        `'${callee.name}' wants ${arity} arg${arity === 1 ? "" : "s"} but got ${args.length}`,
      );
    }

    try {
      return callee.call(this, args, line);
    } catch (e) {
      // Built-ins report bad arguments via BuiltinError, with no line info.
      if (e instanceof BuiltinError) {
        throw runtimeError(line, e.message);
      }
      throw e;
    }
  }
}
