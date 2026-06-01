#!/usr/bin/env node
"use strict";

// src/cli.ts
var import_node_fs = require("fs");
var import_node_path = require("path");

// src/errors.ts
var YapError = class extends Error {
  /** 1-based line where the error occurred (0 if unknown). */
  line;
  constructor(message, line) {
    super(message);
    this.name = "YapError";
    this.line = line;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var YapSyntaxError = class extends YapError {
  constructor(message, line) {
    super(message, line);
    this.name = "YapSyntaxError";
  }
};
var YapRuntimeError = class extends YapError {
  constructor(message, line) {
    super(message, line);
    this.name = "YapRuntimeError";
  }
};
var BuiltinError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BuiltinError";
  }
};
function syntaxError(line, detail) {
  return new YapSyntaxError(`\u{1F480} sus syntax at line ${line}: ${detail}`, line);
}
function nameError(line, detail) {
  return new YapRuntimeError(`\u{1F480} fr real? at line ${line}: ${detail}`, line);
}
function runtimeError(line, detail) {
  return new YapRuntimeError(`\u{1F480} that ain't it at line ${line}: ${detail}`, line);
}

// src/values.ts
function isCallable(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && value.isYapCallable === true;
}
function typeName(value) {
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (value === null) return "ghosted";
  if (Array.isArray(value)) return "array";
  return "function";
}
function isTruthy(value) {
  if (value === false) return false;
  if (value === null) return false;
  return true;
}
function stringify(value, topLevel = true) {
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
  return `<bestie ${value.name}>`;
}
function formatNumber(n) {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Infinity";
  if (n === -Infinity) return "-Infinity";
  if (Object.is(n, -0)) return "0";
  return String(n);
}
function valuesEqual(a, b) {
  if (typeof a !== typeof b) {
    return a === b;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a === b;
  }
  return a === b;
}

// src/builtins.ts
var BuiltinFunction = class {
  constructor(name, arityValue, impl) {
    this.name = name;
    this.arityValue = arityValue;
    this.impl = impl;
  }
  name;
  arityValue;
  impl;
  isYapCallable = true;
  arity() {
    return this.arityValue;
  }
  call(ctx, args, line) {
    return this.impl(ctx, args, line);
  }
};
function expectString(value, fn, pos) {
  if (typeof value !== "string") {
    throw new BuiltinError(
      `'${fn}' wanted a string ${pos}, but got a ${typeName(value)}`
    );
  }
  return value;
}
function expectArray(value, fn, pos) {
  if (!Array.isArray(value)) {
    throw new BuiltinError(
      `'${fn}' wanted an array ${pos}, but got a ${typeName(value)}`
    );
  }
  return value;
}
function createBuiltins() {
  const builtins = [
    // spill(...args) -> ghosted. Prints args joined by spaces.
    new BuiltinFunction("spill", "variadic", (ctx, args) => {
      ctx.output(args.map((a) => stringify(a, true)).join(" "));
      return null;
    }),
    // vibecheck(x) -> the type name as a string.
    new BuiltinFunction("vibecheck", 1, (_ctx, args) => {
      return typeName(args[0]);
    }),
    // howmany(x) -> length of a string or array.
    new BuiltinFunction("howmany", 1, (_ctx, args) => {
      const x = args[0];
      if (typeof x === "string") return x.length;
      if (Array.isArray(x)) return x.length;
      throw new BuiltinError(
        `'howmany' only counts strings or arrays, not a ${typeName(x)}`
      );
    }),
    // glowup(s) -> uppercase.
    new BuiltinFunction("glowup", 1, (_ctx, args) => {
      return expectString(args[0], "glowup", "to shout").toUpperCase();
    }),
    // chill(s) -> lowercase.
    new BuiltinFunction("chill", 1, (_ctx, args) => {
      return expectString(args[0], "chill", "to relax").toLowerCase();
    }),
    // slide(arr, x) -> push x, return new length.
    new BuiltinFunction("slide", 2, (_ctx, args) => {
      const arr = expectArray(args[0], "slide", "as its first arg");
      arr.push(args[1]);
      return arr.length;
    }),
    // yoink(arr) -> pop and return the last element (ghosted if empty).
    new BuiltinFunction("yoink", 1, (_ctx, args) => {
      const arr = expectArray(args[0], "yoink", "");
      if (arr.length === 0) return null;
      return arr.pop();
    }),
    // numify(s) -> parse a string into a number.
    new BuiltinFunction("numify", 1, (_ctx, args) => {
      const s = expectString(args[0], "numify", "to parse").trim();
      if (s === "") {
        throw new BuiltinError(`'numify' can't read an empty string as a number`);
      }
      const n = Number(s);
      if (Number.isNaN(n)) {
        throw new BuiltinError(`'numify' flopped: "${s}" is not a number`);
      }
      return n;
    })
  ];
  const table = {};
  for (const fn of builtins) table[fn.name] = fn;
  return table;
}

// src/environment.ts
var Environment = class {
  values = /* @__PURE__ */ new Map();
  parent;
  constructor(parent) {
    this.parent = parent;
  }
  define(name, value) {
    this.values.set(name, value);
  }
  has(name) {
    if (this.values.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }
  /** Returns the value, or throws `NameNotFound` if undeclared. */
  get(name) {
    if (this.values.has(name)) {
      return this.values.get(name);
    }
    if (this.parent) return this.parent.get(name);
    throw new NameNotFound(name);
  }
  /** Reassigns an existing binding, or throws `NameNotFound`. */
  assign(name, value) {
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
};
var NameNotFound = class extends Error {
  nameSought;
  constructor(name) {
    super(`name not found: ${name}`);
    this.name = "NameNotFound";
    this.nameSought = name;
  }
};

// src/interpreter.ts
var ReturnSignal = class {
  constructor(value) {
    this.value = value;
  }
  value;
};
var BreakSignal = class {
};
var ContinueSignal = class {
};
var BREAK = new BreakSignal();
var CONTINUE = new ContinueSignal();
var YapFunction = class {
  constructor(declaration, closure, interpreter) {
    this.declaration = declaration;
    this.closure = closure;
    this.interpreter = interpreter;
    this.name = declaration.name;
  }
  declaration;
  closure;
  interpreter;
  isYapCallable = true;
  name;
  arity() {
    return this.declaration.params.length;
  }
  call(_ctx, args) {
    const env = new Environment(this.closure);
    const params = this.declaration.params;
    for (let i = 0; i < params.length; i++) {
      env.define(params[i], args[i]);
    }
    return this.interpreter.runFunctionBody(this.declaration.body, env);
  }
};
var Interpreter = class {
  output;
  globals;
  env;
  loopDepth = 0;
  constructor(output = (t) => console.log(t)) {
    this.output = output;
    this.globals = new Environment();
    this.env = this.globals;
    const builtins = createBuiltins();
    for (const [name, fn] of Object.entries(builtins)) {
      this.globals.define(name, fn);
    }
  }
  interpret(program) {
    for (const stmt of program.statements) {
      this.execute(stmt);
    }
  }
  /** Runs a function body in `env`, unwrapping a `bet` return value. */
  runFunctionBody(body, env) {
    const savedLoopDepth = this.loopDepth;
    this.loopDepth = 0;
    try {
      this.executeBlock(body.statements, env);
      return null;
    } catch (signal) {
      if (signal instanceof ReturnSignal) return signal.value;
      throw signal;
    } finally {
      this.loopDepth = savedLoopDepth;
    }
  }
  // --- Statements ------------------------------------------------------------
  execute(stmt) {
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
              new Environment(this.env)
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
  runLoopBody(body) {
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
  executeBlock(statements, env) {
    const previous = this.env;
    this.env = env;
    try {
      for (const stmt of statements) this.execute(stmt);
    } finally {
      this.env = previous;
    }
  }
  // --- Expressions -----------------------------------------------------------
  evaluate(expr) {
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
        return isTruthy(left) ? this.evaluate(expr.right) : left;
      }
      case "Unary":
        return this.evaluateUnary(expr.operator, expr.operand, expr.line);
      case "Binary":
        return this.evaluateBinary(
          expr.operator,
          this.evaluate(expr.left),
          this.evaluate(expr.right),
          expr.line
        );
      case "IndexExpr":
        return this.evaluateIndexGet(expr.object, expr.index, expr.line);
      case "CallExpr":
        return this.evaluateCall(expr.callee, expr.args, expr.line);
    }
  }
  evaluateAssign(expr) {
    const value = this.evaluate(expr.value);
    const target = expr.target;
    if (target.kind === "Variable") {
      try {
        this.env.assign(target.name, value);
      } catch (e) {
        if (e instanceof NameNotFound) {
          throw nameError(
            target.line,
            `'${target.name}' is not defined \u2014 declare it with 'vibe' first`
          );
        }
        throw e;
      }
      return value;
    }
    const object = this.evaluate(target.object);
    const index = this.evaluate(target.index);
    if (!Array.isArray(object)) {
      throw runtimeError(
        target.line,
        `can only assign into arrays, not a ${typeName(object)}`
      );
    }
    const i = this.asArrayIndex(index, object.length, target.line);
    object[i] = value;
    return value;
  }
  evaluateUnary(operator, operandExpr, line) {
    const operand = this.evaluate(operandExpr);
    if (operator === "-") {
      if (typeof operand !== "number") {
        throw runtimeError(
          line,
          `can't negate a ${typeName(operand)} \u2014 '-' wants a number`
        );
      }
      return -operand;
    }
    return !isTruthy(operand);
  }
  evaluateBinary(operator, left, right, line) {
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
          `can't add a ${typeName(left)} and a ${typeName(right)}`
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
        return left / right;
      case "%":
        this.checkNumbers(left, right, line, "%");
        if (right === 0) {
          throw runtimeError(line, `can't mod by zero`);
        }
        return left % right;
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
  arith(left, right, line, op, fn) {
    this.checkNumbers(left, right, line, op);
    return fn(left, right);
  }
  checkNumbers(left, right, line, op) {
    if (typeof left !== "number" || typeof right !== "number") {
      throw runtimeError(
        line,
        `'${op}' only works on numbers, not a ${typeName(left)} and a ${typeName(right)}`
      );
    }
  }
  /** Returns negative/zero/positive like a comparator. Errors on bad types. */
  compare(left, right, line) {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    if (typeof left === "string" && typeof right === "string") {
      return left < right ? -1 : left > right ? 1 : 0;
    }
    throw runtimeError(
      line,
      `can't compare a ${typeName(left)} with a ${typeName(right)}`
    );
  }
  evaluateIndexGet(objectExpr, indexExpr, line) {
    const object = this.evaluate(objectExpr);
    const index = this.evaluate(indexExpr);
    if (Array.isArray(object)) {
      const i = this.asArrayIndex(index, object.length, line);
      return object[i];
    }
    if (typeof object === "string") {
      const i = this.asArrayIndex(index, object.length, line);
      return object[i];
    }
    throw runtimeError(
      line,
      `can't index into a ${typeName(object)} \u2014 only arrays and strings`
    );
  }
  asArrayIndex(index, length, line) {
    if (typeof index !== "number" || !Number.isInteger(index)) {
      throw runtimeError(
        line,
        `array index must be a whole number, got ${stringify(index, true)}`
      );
    }
    if (index < 0 || index >= length) {
      throw runtimeError(
        line,
        `index ${index} is out of bounds (length ${length})`
      );
    }
    return index;
  }
  evaluateCall(calleeExpr, argExprs, line) {
    const callee = this.evaluate(calleeExpr);
    const args = argExprs.map((a) => this.evaluate(a));
    if (!isCallable(callee)) {
      throw runtimeError(
        line,
        `can't call a ${typeName(callee)} \u2014 that's not a bestie`
      );
    }
    const arity = callee.arity();
    if (arity !== "variadic" && args.length !== arity) {
      throw runtimeError(
        line,
        `'${callee.name}' wants ${arity} arg${arity === 1 ? "" : "s"} but got ${args.length}`
      );
    }
    try {
      return callee.call(this, args, line);
    } catch (e) {
      if (e instanceof BuiltinError) {
        throw runtimeError(line, e.message);
      }
      throw e;
    }
  }
};

// src/token.ts
function makeToken(type, lexeme, line, column, literal = void 0) {
  return { type, lexeme, literal, line, column };
}

// src/keywords.ts
var LANGUAGE_NAME = "YapLang";
var FILE_EXTENSION = ".yap";
var KEYWORDS = {
  vibe: "VAR" /* VAR */,
  nocap: "TRUE" /* TRUE */,
  cap: "FALSE" /* FALSE */,
  ghosted: "NULL" /* NULL */,
  fr: "IF" /* IF */,
  orfr: "ELIF" /* ELIF */,
  nah: "ELSE" /* ELSE */,
  onloop: "WHILE" /* WHILE */,
  grind: "FOR" /* FOR */,
  bestie: "FUNCTION" /* FUNCTION */,
  bet: "RETURN" /* RETURN */,
  vibin: "AND" /* AND */,
  lowkey: "OR" /* OR */,
  sus: "NOT" /* NOT */,
  dip: "BREAK" /* BREAK */,
  skrt: "CONTINUE" /* CONTINUE */
};
var KEYWORD_SPELLINGS = Object.fromEntries(
  Object.entries(KEYWORDS).map(([word, type]) => [type, word])
);
function spell(type) {
  return KEYWORD_SPELLINGS[type] ?? type;
}

// src/lexer.ts
var isDigit = (ch) => ch >= "0" && ch <= "9";
var isAlpha = (ch) => ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch === "_";
var isAlphaNumeric = (ch) => isAlpha(ch) || isDigit(ch);
var Lexer = class {
  source;
  tokens = [];
  start = 0;
  // index of the first char of the current lexeme
  current = 0;
  // index of the char being looked at
  line = 1;
  column = 1;
  // 1-based column of `current`
  startColumn = 1;
  // column where the current lexeme began
  /** Nesting depth of () and [] — used to suppress newlines inside them. */
  groupingDepth = 0;
  constructor(source) {
    this.source = source;
  }
  scan() {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startColumn = this.column;
      this.scanToken();
    }
    this.tokens.push(makeToken("NEWLINE" /* NEWLINE */, "", this.line, this.column));
    this.tokens.push(makeToken("EOF" /* EOF */, "", this.line, this.column));
    return this.tokens;
  }
  scanToken() {
    const ch = this.advance();
    switch (ch) {
      case "(":
        this.groupingDepth++;
        this.addToken("LEFT_PAREN" /* LEFT_PAREN */);
        break;
      case ")":
        if (this.groupingDepth > 0) this.groupingDepth--;
        this.addToken("RIGHT_PAREN" /* RIGHT_PAREN */);
        break;
      case "[":
        this.groupingDepth++;
        this.addToken("LEFT_BRACKET" /* LEFT_BRACKET */);
        break;
      case "]":
        if (this.groupingDepth > 0) this.groupingDepth--;
        this.addToken("RIGHT_BRACKET" /* RIGHT_BRACKET */);
        break;
      case "{":
        this.addToken("LEFT_BRACE" /* LEFT_BRACE */);
        break;
      case "}":
        this.addToken("RIGHT_BRACE" /* RIGHT_BRACE */);
        break;
      case ",":
        this.addToken("COMMA" /* COMMA */);
        break;
      case ";":
        this.addToken("SEMICOLON" /* SEMICOLON */);
        break;
      case "+":
        this.addToken("PLUS" /* PLUS */);
        break;
      case "-":
        this.addToken("MINUS" /* MINUS */);
        break;
      case "*":
        this.addToken("STAR" /* STAR */);
        break;
      case "%":
        this.addToken("PERCENT" /* PERCENT */);
        break;
      case "/":
        if (this.match("/")) {
          while (!this.isAtEnd() && this.peek() !== "\n") this.advance();
        } else {
          this.addToken("SLASH" /* SLASH */);
        }
        break;
      case "=":
        this.addToken(this.match("=") ? "EQUAL_EQUAL" /* EQUAL_EQUAL */ : "EQUAL" /* EQUAL */);
        break;
      case "!":
        if (this.match("=")) {
          this.addToken("BANG_EQUAL" /* BANG_EQUAL */);
        } else {
          throw syntaxError(
            this.line,
            `unexpected '!' (did you mean '!=' or the 'sus' keyword?)`
          );
        }
        break;
      case "<":
        this.addToken(this.match("=") ? "LESS_EQUAL" /* LESS_EQUAL */ : "LESS" /* LESS */);
        break;
      case ">":
        this.addToken(
          this.match("=") ? "GREATER_EQUAL" /* GREATER_EQUAL */ : "GREATER" /* GREATER */
        );
        break;
      case '"':
        this.string();
        break;
      case "\n":
        this.newline();
        break;
      case " ":
      case "\r":
      case "	":
        break;
      // ignore other whitespace
      default:
        if (isDigit(ch)) {
          this.number();
        } else if (isAlpha(ch)) {
          this.identifier();
        } else {
          throw syntaxError(this.line, `unexpected character '${ch}'`);
        }
    }
  }
  newline() {
    if (this.groupingDepth === 0) {
      this.addToken("NEWLINE" /* NEWLINE */);
    }
    this.line++;
    this.column = 1;
  }
  string() {
    let value = "";
    while (!this.isAtEnd() && this.peek() !== '"') {
      const ch = this.advance();
      if (ch === "\n") {
        this.line++;
        this.column = 1;
        value += "\n";
      } else if (ch === "\\") {
        value += this.escape();
      } else {
        value += ch;
      }
    }
    if (this.isAtEnd()) {
      throw syntaxError(
        this.line,
        `unterminated string \u2014 you opened a '"' and ghosted it`
      );
    }
    this.advance();
    this.addToken("STRING" /* STRING */, value);
  }
  escape() {
    if (this.isAtEnd()) {
      throw syntaxError(this.line, `dangling '\\' at end of string`);
    }
    const ch = this.advance();
    switch (ch) {
      case "n":
        return "\n";
      case "t":
        return "	";
      case "r":
        return "\r";
      case '"':
        return '"';
      case "\\":
        return "\\";
      default:
        throw syntaxError(this.line, `unknown escape '\\${ch}' in string`);
    }
  }
  number() {
    while (isDigit(this.peek())) this.advance();
    if (this.peek() === "." && isDigit(this.peekNext())) {
      this.advance();
      while (isDigit(this.peek())) this.advance();
    }
    const text = this.source.slice(this.start, this.current);
    this.addToken("NUMBER" /* NUMBER */, Number(text));
  }
  identifier() {
    while (isAlphaNumeric(this.peek())) this.advance();
    const text = this.source.slice(this.start, this.current);
    const keyword = KEYWORDS[text];
    if (keyword === void 0) {
      this.addToken("IDENTIFIER" /* IDENTIFIER */);
      return;
    }
    switch (keyword) {
      case "TRUE" /* TRUE */:
        this.addToken("TRUE" /* TRUE */, true);
        break;
      case "FALSE" /* FALSE */:
        this.addToken("FALSE" /* FALSE */, false);
        break;
      case "NULL" /* NULL */:
        this.addToken("NULL" /* NULL */, null);
        break;
      default:
        this.addToken(keyword);
    }
  }
  // --- Low-level cursor helpers ---------------------------------------------
  isAtEnd() {
    return this.current >= this.source.length;
  }
  advance() {
    const ch = this.source[this.current] ?? "";
    this.current++;
    this.column++;
    return ch;
  }
  match(expected) {
    if (this.isAtEnd() || this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }
  peek() {
    return this.source[this.current] ?? "\0";
  }
  peekNext() {
    return this.source[this.current + 1] ?? "\0";
  }
  addToken(type, literal = void 0) {
    const lexeme = this.source.slice(this.start, this.current);
    this.tokens.push(
      makeToken(type, lexeme, this.line, this.startColumn, literal)
    );
  }
};

// src/parser.ts
var Parser = class {
  tokens;
  current = 0;
  constructor(tokens) {
    this.tokens = tokens;
  }
  parse() {
    const statements = [];
    this.skipSeparators();
    while (!this.isAtEnd()) {
      statements.push(this.statement());
      this.skipSeparators();
    }
    return { kind: "Program", statements };
  }
  // --- Statements ------------------------------------------------------------
  statement() {
    if (this.check("VAR" /* VAR */)) return this.varDeclaration();
    if (this.check("FUNCTION" /* FUNCTION */)) return this.functionDeclaration();
    if (this.check("IF" /* IF */)) return this.ifStatement();
    if (this.check("WHILE" /* WHILE */)) return this.whileStatement();
    if (this.check("FOR" /* FOR */)) return this.forStatement();
    if (this.check("RETURN" /* RETURN */)) return this.returnStatement();
    if (this.check("BREAK" /* BREAK */)) {
      const tok = this.advance();
      return { kind: "BreakStmt", line: tok.line };
    }
    if (this.check("CONTINUE" /* CONTINUE */)) {
      const tok = this.advance();
      return { kind: "ContinueStmt", line: tok.line };
    }
    if (this.check("LEFT_BRACE" /* LEFT_BRACE */)) return this.block();
    return this.expressionStatement();
  }
  varDeclaration() {
    const keyword = this.advance();
    const name = this.consume(
      "IDENTIFIER" /* IDENTIFIER */,
      `expected a variable name after '${spell("VAR" /* VAR */)}'`
    );
    this.consume(
      "EQUAL" /* EQUAL */,
      `expected '=' to give '${name.lexeme}' a value`
    );
    const initializer = this.expression();
    return {
      kind: "VarDecl",
      name: name.lexeme,
      initializer,
      line: keyword.line
    };
  }
  functionDeclaration() {
    const keyword = this.advance();
    const name = this.consume(
      "IDENTIFIER" /* IDENTIFIER */,
      `expected a function name after '${spell("FUNCTION" /* FUNCTION */)}'`
    );
    this.consume("LEFT_PAREN" /* LEFT_PAREN */, `expected '(' after function name`);
    const params = [];
    if (!this.check("RIGHT_PAREN" /* RIGHT_PAREN */)) {
      do {
        const param = this.consume(
          "IDENTIFIER" /* IDENTIFIER */,
          `expected a parameter name`
        );
        params.push(param.lexeme);
      } while (this.matchToken("COMMA" /* COMMA */));
    }
    this.consume("RIGHT_PAREN" /* RIGHT_PAREN */, `expected ')' after parameters`);
    const body = this.block();
    return {
      kind: "FunctionDecl",
      name: name.lexeme,
      params,
      body,
      line: keyword.line
    };
  }
  ifStatement() {
    const keyword = this.advance();
    this.consume(
      "LEFT_PAREN" /* LEFT_PAREN */,
      `expected '(' after '${keyword.lexeme}'`
    );
    const condition = this.expression();
    this.consume("RIGHT_PAREN" /* RIGHT_PAREN */, `expected ')' after condition`);
    const thenBranch = this.block();
    let elseBranch;
    const save = this.current;
    this.skipSeparators();
    if (this.check("ELIF" /* ELIF */)) {
      elseBranch = this.ifStatement();
    } else if (this.check("ELSE" /* ELSE */)) {
      this.advance();
      elseBranch = this.block();
    } else {
      this.current = save;
    }
    return {
      kind: "IfStmt",
      condition,
      thenBranch,
      elseBranch,
      line: keyword.line
    };
  }
  whileStatement() {
    const keyword = this.advance();
    this.consume(
      "LEFT_PAREN" /* LEFT_PAREN */,
      `expected '(' after '${keyword.lexeme}'`
    );
    const condition = this.expression();
    this.consume("RIGHT_PAREN" /* RIGHT_PAREN */, `expected ')' after condition`);
    const body = this.block();
    return { kind: "WhileStmt", condition, body, line: keyword.line };
  }
  forStatement() {
    const keyword = this.advance();
    this.consume(
      "LEFT_PAREN" /* LEFT_PAREN */,
      `expected '(' after '${keyword.lexeme}'`
    );
    let initializer;
    if (this.matchToken("SEMICOLON" /* SEMICOLON */)) {
      initializer = void 0;
    } else if (this.check("VAR" /* VAR */)) {
      initializer = this.varDeclaration();
      this.consume("SEMICOLON" /* SEMICOLON */, `expected ';' after loop initializer`);
    } else {
      const expr = this.expression();
      initializer = { kind: "ExpressionStmt", expression: expr, line: expr.line };
      this.consume("SEMICOLON" /* SEMICOLON */, `expected ';' after loop initializer`);
    }
    let condition;
    if (!this.check("SEMICOLON" /* SEMICOLON */)) {
      condition = this.expression();
    }
    this.consume("SEMICOLON" /* SEMICOLON */, `expected ';' after loop condition`);
    let update;
    if (!this.check("RIGHT_PAREN" /* RIGHT_PAREN */)) {
      update = this.expression();
    }
    this.consume("RIGHT_PAREN" /* RIGHT_PAREN */, `expected ')' after loop clauses`);
    const body = this.block();
    return {
      kind: "ForStmt",
      initializer,
      condition,
      update,
      body,
      line: keyword.line
    };
  }
  returnStatement() {
    const keyword = this.advance();
    let value;
    if (!this.check("NEWLINE" /* NEWLINE */) && !this.check("SEMICOLON" /* SEMICOLON */) && !this.check("RIGHT_BRACE" /* RIGHT_BRACE */) && !this.check("EOF" /* EOF */)) {
      value = this.expression();
    }
    return { kind: "ReturnStmt", value, line: keyword.line };
  }
  block() {
    const brace = this.consume(
      "LEFT_BRACE" /* LEFT_BRACE */,
      `expected '{' to start a block`
    );
    const statements = [];
    this.skipSeparators();
    while (!this.check("RIGHT_BRACE" /* RIGHT_BRACE */) && !this.isAtEnd()) {
      statements.push(this.statement());
      this.skipSeparators();
    }
    this.consume("RIGHT_BRACE" /* RIGHT_BRACE */, `expected '}' to close the block`);
    return { kind: "Block", statements, line: brace.line };
  }
  expressionStatement() {
    const expr = this.expression();
    return { kind: "ExpressionStmt", expression: expr, line: expr.line };
  }
  // --- Expressions -----------------------------------------------------------
  expression() {
    return this.assignment();
  }
  assignment() {
    const expr = this.or();
    if (this.check("EQUAL" /* EQUAL */)) {
      const equals = this.advance();
      const value = this.assignment();
      if (expr.kind === "Variable" || expr.kind === "IndexExpr") {
        const assign = {
          kind: "Assign",
          target: expr,
          value,
          line: equals.line
        };
        return assign;
      }
      throw syntaxError(equals.line, `can't assign to that \u2014 invalid target`);
    }
    return expr;
  }
  or() {
    let expr = this.and();
    while (this.check("OR" /* OR */)) {
      const op = this.advance();
      const right = this.and();
      expr = { kind: "Logical", operator: "or", left: expr, right, line: op.line };
    }
    return expr;
  }
  and() {
    let expr = this.equality();
    while (this.check("AND" /* AND */)) {
      const op = this.advance();
      const right = this.equality();
      expr = {
        kind: "Logical",
        operator: "and",
        left: expr,
        right,
        line: op.line
      };
    }
    return expr;
  }
  equality() {
    let expr = this.comparison();
    while (this.check("EQUAL_EQUAL" /* EQUAL_EQUAL */) || this.check("BANG_EQUAL" /* BANG_EQUAL */)) {
      const op = this.advance();
      const right = this.comparison();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line
      };
    }
    return expr;
  }
  comparison() {
    let expr = this.term();
    while (this.check("LESS" /* LESS */) || this.check("GREATER" /* GREATER */) || this.check("LESS_EQUAL" /* LESS_EQUAL */) || this.check("GREATER_EQUAL" /* GREATER_EQUAL */)) {
      const op = this.advance();
      const right = this.term();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line
      };
    }
    return expr;
  }
  term() {
    let expr = this.factor();
    while (this.check("PLUS" /* PLUS */) || this.check("MINUS" /* MINUS */)) {
      const op = this.advance();
      const right = this.factor();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line
      };
    }
    return expr;
  }
  factor() {
    let expr = this.unary();
    while (this.check("STAR" /* STAR */) || this.check("SLASH" /* SLASH */) || this.check("PERCENT" /* PERCENT */)) {
      const op = this.advance();
      const right = this.unary();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line
      };
    }
    return expr;
  }
  unary() {
    if (this.check("MINUS" /* MINUS */)) {
      const op = this.advance();
      const operand = this.unary();
      return { kind: "Unary", operator: "-", operand, line: op.line };
    }
    if (this.check("NOT" /* NOT */)) {
      const op = this.advance();
      const operand = this.unary();
      return { kind: "Unary", operator: "not", operand, line: op.line };
    }
    return this.callOrIndex();
  }
  callOrIndex() {
    let expr = this.primary();
    for (; ; ) {
      if (this.check("LEFT_PAREN" /* LEFT_PAREN */)) {
        expr = this.finishCall(expr);
      } else if (this.check("LEFT_BRACKET" /* LEFT_BRACKET */)) {
        const bracket = this.advance();
        const index = this.expression();
        this.consume(
          "RIGHT_BRACKET" /* RIGHT_BRACKET */,
          `expected ']' after index expression`
        );
        const indexExpr = {
          kind: "IndexExpr",
          object: expr,
          index,
          line: bracket.line
        };
        expr = indexExpr;
      } else {
        break;
      }
    }
    return expr;
  }
  finishCall(callee) {
    const paren = this.advance();
    const args = [];
    if (!this.check("RIGHT_PAREN" /* RIGHT_PAREN */)) {
      do {
        args.push(this.expression());
      } while (this.matchToken("COMMA" /* COMMA */));
    }
    this.consume("RIGHT_PAREN" /* RIGHT_PAREN */, `expected ')' after arguments`);
    return { kind: "CallExpr", callee, args, line: paren.line };
  }
  primary() {
    const tok = this.peek();
    switch (tok.type) {
      case "NUMBER" /* NUMBER */:
        this.advance();
        return {
          kind: "NumberLiteral",
          value: tok.literal,
          line: tok.line
        };
      case "STRING" /* STRING */:
        this.advance();
        return {
          kind: "StringLiteral",
          value: tok.literal,
          line: tok.line
        };
      case "TRUE" /* TRUE */:
        this.advance();
        return { kind: "BooleanLiteral", value: true, line: tok.line };
      case "FALSE" /* FALSE */:
        this.advance();
        return { kind: "BooleanLiteral", value: false, line: tok.line };
      case "NULL" /* NULL */:
        this.advance();
        return { kind: "NullLiteral", line: tok.line };
      case "IDENTIFIER" /* IDENTIFIER */: {
        this.advance();
        const variable = {
          kind: "Variable",
          name: tok.lexeme,
          line: tok.line
        };
        return variable;
      }
      case "LEFT_PAREN" /* LEFT_PAREN */: {
        this.advance();
        const expr = this.expression();
        this.consume("RIGHT_PAREN" /* RIGHT_PAREN */, `expected ')' after expression`);
        return expr;
      }
      case "LEFT_BRACKET" /* LEFT_BRACKET */:
        return this.arrayLiteral();
      default:
        throw syntaxError(
          tok.line,
          `expected a value but found ${describe(tok)}`
        );
    }
  }
  arrayLiteral() {
    const bracket = this.advance();
    const elements = [];
    if (!this.check("RIGHT_BRACKET" /* RIGHT_BRACKET */)) {
      do {
        if (this.check("RIGHT_BRACKET" /* RIGHT_BRACKET */)) break;
        elements.push(this.expression());
      } while (this.matchToken("COMMA" /* COMMA */));
    }
    this.consume("RIGHT_BRACKET" /* RIGHT_BRACKET */, `expected ']' to close the array`);
    return { kind: "ArrayLiteral", elements, line: bracket.line };
  }
  // --- Token plumbing --------------------------------------------------------
  skipSeparators() {
    while (this.check("NEWLINE" /* NEWLINE */) || this.check("SEMICOLON" /* SEMICOLON */)) {
      this.advance();
    }
  }
  check(type) {
    return this.peek().type === type;
  }
  matchToken(type) {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }
  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw syntaxError(this.peek().line, message);
  }
  isAtEnd() {
    return this.peek().type === "EOF" /* EOF */;
  }
  peek() {
    return this.tokens[this.current];
  }
  previous() {
    return this.tokens[this.current - 1];
  }
};
function describe(tok) {
  switch (tok.type) {
    case "NEWLINE" /* NEWLINE */:
      return "end of line";
    case "EOF" /* EOF */:
      return "end of file";
    case "RIGHT_BRACE" /* RIGHT_BRACE */:
      return "'}'";
    case "RIGHT_PAREN" /* RIGHT_PAREN */:
      return "')'";
    default:
      return `'${tok.lexeme}'`;
  }
}

// src/runner.ts
var defaultOutput = (text) => console.log(text);
function run(source, output = defaultOutput) {
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
    const detail = e instanceof Error ? e.message : String(e);
    const message = `\u{1F480} ${LANGUAGE_NAME} tripped over itself (this is a bug): ${detail}`;
    output(message);
    return { ok: false, error: message };
  }
}

// src/cli.ts
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
  if ((0, import_node_path.extname)(filePath) !== FILE_EXTENSION) {
    console.error(
      `\u26A0\uFE0F  heads up: '${filePath}' doesn't end in '${FILE_EXTENSION}'. Running it anyway...`
    );
  }
  let source;
  try {
    source = (0, import_node_fs.readFileSync)((0, import_node_path.resolve)(filePath), "utf8");
  } catch {
    console.error(`\u{1F480} can't find that file: '${filePath}'`);
    return 1;
  }
  const result = run(source, (text) => console.log(text));
  return result.ok ? 0 : 1;
}
process.exit(main(process.argv));
//# sourceMappingURL=cli.cjs.map