/**
 * AST node definitions.
 *
 * Every node is a plain object with a string `kind` discriminant and a `line`
 * for error reporting. Expressions produce values; statements produce effects.
 */
interface NumberLiteral {
    kind: "NumberLiteral";
    value: number;
    line: number;
}
interface StringLiteral {
    kind: "StringLiteral";
    value: string;
    line: number;
}
interface BooleanLiteral {
    kind: "BooleanLiteral";
    value: boolean;
    line: number;
}
interface NullLiteral {
    kind: "NullLiteral";
    line: number;
}
interface ArrayLiteral {
    kind: "ArrayLiteral";
    elements: Expr[];
    line: number;
}
interface Variable {
    kind: "Variable";
    name: string;
    line: number;
}
interface Assign {
    kind: "Assign";
    target: Variable | IndexExpr;
    value: Expr;
    line: number;
}
interface Binary {
    kind: "Binary";
    operator: string;
    left: Expr;
    right: Expr;
    line: number;
}
interface Logical {
    kind: "Logical";
    operator: "and" | "or";
    left: Expr;
    right: Expr;
    line: number;
}
interface Unary {
    kind: "Unary";
    operator: "-" | "not";
    operand: Expr;
    line: number;
}
interface CallExpr {
    kind: "CallExpr";
    callee: Expr;
    args: Expr[];
    line: number;
}
interface IndexExpr {
    kind: "IndexExpr";
    object: Expr;
    index: Expr;
    line: number;
}
type Expr = NumberLiteral | StringLiteral | BooleanLiteral | NullLiteral | ArrayLiteral | Variable | Assign | Binary | Logical | Unary | CallExpr | IndexExpr;
interface ExpressionStmt {
    kind: "ExpressionStmt";
    expression: Expr;
    line: number;
}
interface VarDecl {
    kind: "VarDecl";
    name: string;
    initializer: Expr;
    line: number;
}
interface Block {
    kind: "Block";
    statements: Stmt[];
    line: number;
}
interface IfStmt {
    kind: "IfStmt";
    condition: Expr;
    thenBranch: Block;
    /** Either another IfStmt (an `orfr`) or a Block (a `nah`), or undefined. */
    elseBranch: IfStmt | Block | undefined;
    line: number;
}
interface WhileStmt {
    kind: "WhileStmt";
    condition: Expr;
    body: Block;
    line: number;
}
interface ForStmt {
    kind: "ForStmt";
    initializer: VarDecl | ExpressionStmt | undefined;
    condition: Expr | undefined;
    update: Expr | undefined;
    body: Block;
    line: number;
}
interface FunctionDecl {
    kind: "FunctionDecl";
    name: string;
    params: string[];
    body: Block;
    line: number;
}
interface ReturnStmt {
    kind: "ReturnStmt";
    value: Expr | undefined;
    line: number;
}
interface BreakStmt {
    kind: "BreakStmt";
    line: number;
}
interface ContinueStmt {
    kind: "ContinueStmt";
    line: number;
}
type Stmt = ExpressionStmt | VarDecl | Block | IfStmt | WhileStmt | ForStmt | FunctionDecl | ReturnStmt | BreakStmt | ContinueStmt;
interface Program {
    kind: "Program";
    statements: Stmt[];
}

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
type YapValue = number | string | boolean | null | YapValue[] | YapCallable;
interface YapCallable {
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
interface CallContext {
    readonly output: (text: string) => void;
}

/**
 * Lexical scopes with a parent chain.
 *
 * `define` always writes to the current scope (used for declarations and
 * parameters). `assign` walks up the chain to find an existing binding (used
 * for `x = ...`), and errors if the name was never declared — so typos surface
 * instead of silently creating globals.
 */

declare class Environment {
    private readonly values;
    readonly parent: Environment | undefined;
    constructor(parent?: Environment);
    define(name: string, value: YapValue): void;
    has(name: string): boolean;
    /** Returns the value, or throws `NameNotFound` if undeclared. */
    get(name: string): YapValue;
    /** Reassigns an existing binding, or throws `NameNotFound`. */
    assign(name: string, value: YapValue): void;
}

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

declare class Interpreter implements CallContext {
    readonly output: (text: string) => void;
    private readonly globals;
    private env;
    private loopDepth;
    constructor(output?: (text: string) => void);
    interpret(program: Program): void;
    /** Runs a function body in `env`, unwrapping a `bet` return value. */
    runFunctionBody(body: Block, env: Environment): YapValue;
    private execute;
    /**
     * Runs a loop body once. Returns "break" if a `dip` fired, otherwise
     * "normal" (covers both natural completion and a `skrt`).
     */
    private runLoopBody;
    executeBlock(statements: Stmt[], env: Environment): void;
    private evaluate;
    private evaluateAssign;
    private evaluateUnary;
    private evaluateBinary;
    private arith;
    private checkNumbers;
    /** Returns negative/zero/positive like a comparator. Errors on bad types. */
    private compare;
    private evaluateIndexGet;
    private asArrayIndex;
    private evaluateCall;
}

/**
 * Token definitions for YapLang.
 *
 * The TokenType enum is intentionally "concept-based" rather than
 * "spelling-based" — e.g. the keyword for "if" is a single token type `IF`,
 * regardless of what slang word currently spells it. That means renaming the
 * language only requires editing `keywords.ts`, never this file or the parser.
 */
declare enum TokenType {
    NUMBER = "NUMBER",
    STRING = "STRING",
    IDENTIFIER = "IDENTIFIER",
    VAR = "VAR",// vibe
    TRUE = "TRUE",// nocap
    FALSE = "FALSE",// cap
    NULL = "NULL",// ghosted
    IF = "IF",// fr
    ELIF = "ELIF",// orfr
    ELSE = "ELSE",// nah
    WHILE = "WHILE",// onloop
    FOR = "FOR",// grind
    FUNCTION = "FUNCTION",// bestie
    RETURN = "RETURN",// bet
    AND = "AND",// vibin
    OR = "OR",// lowkey
    NOT = "NOT",// sus
    BREAK = "BREAK",// dip
    CONTINUE = "CONTINUE",// skrt
    PLUS = "PLUS",
    MINUS = "MINUS",
    STAR = "STAR",
    SLASH = "SLASH",
    PERCENT = "PERCENT",
    EQUAL = "EQUAL",// =
    EQUAL_EQUAL = "EQUAL_EQUAL",// ==
    BANG_EQUAL = "BANG_EQUAL",// !=
    LESS = "LESS",// <
    GREATER = "GREATER",// >
    LESS_EQUAL = "LESS_EQUAL",// <=
    GREATER_EQUAL = "GREATER_EQUAL",// >=
    LEFT_PAREN = "LEFT_PAREN",
    RIGHT_PAREN = "RIGHT_PAREN",
    LEFT_BRACE = "LEFT_BRACE",
    RIGHT_BRACE = "RIGHT_BRACE",
    LEFT_BRACKET = "LEFT_BRACKET",
    RIGHT_BRACKET = "RIGHT_BRACKET",
    COMMA = "COMMA",
    SEMICOLON = "SEMICOLON",
    NEWLINE = "NEWLINE",
    EOF = "EOF"
}
interface Token {
    type: TokenType;
    /** The exact source text of the token (the lexeme). */
    lexeme: string;
    /** For NUMBER/STRING/TRUE/FALSE/NULL: the parsed runtime value. */
    literal: number | string | boolean | null | undefined;
    /** 1-based line number where the token starts. */
    line: number;
    /** 1-based column number where the token starts. */
    column: number;
}

/**
 * The lexer: turns a source string into a flat list of tokens.
 *
 * Notable design choices:
 *  - Newlines are significant (they terminate statements), so we emit NEWLINE
 *    tokens — but only at "top level". While inside `(...)` or `[...]` we
 *    suppress them (implicit line-joining, like Python), so conditions, call
 *    arguments, and array literals can span multiple lines.
 *  - Semicolons are always emitted (the `grind` header uses them even though it
 *    lives inside parentheses).
 */

declare class Lexer {
    private readonly source;
    private readonly tokens;
    private start;
    private current;
    private line;
    private column;
    private startColumn;
    /** Nesting depth of () and [] — used to suppress newlines inside them. */
    private groupingDepth;
    constructor(source: string);
    scan(): Token[];
    private scanToken;
    private newline;
    private string;
    private escape;
    private number;
    private identifier;
    private isAtEnd;
    private advance;
    private match;
    private peek;
    private peekNext;
    private addToken;
}
/** Convenience wrapper. */
declare function tokenize(source: string): Token[];

/**
 * Recursive-descent parser: tokens -> AST.
 *
 * Precedence, lowest to highest:
 *   assignment -> or -> and -> equality -> comparison -> term -> factor
 *   -> unary -> call/index -> primary
 *
 * Statements are separated by NEWLINE and/or SEMICOLON tokens, and runs of
 * separators are simply skipped between statements.
 */

declare class Parser {
    private readonly tokens;
    private current;
    constructor(tokens: Token[]);
    parse(): Program;
    private statement;
    private varDeclaration;
    private functionDeclaration;
    private ifStatement;
    private whileStatement;
    private forStatement;
    private returnStatement;
    private block;
    private expressionStatement;
    private expression;
    private assignment;
    private or;
    private and;
    private equality;
    private comparison;
    private term;
    private factor;
    private unary;
    private callOrIndex;
    private finishCall;
    private primary;
    private arrayLiteral;
    private skipSeparators;
    private check;
    private matchToken;
    private advance;
    private consume;
    private isAtEnd;
    private peek;
    private previous;
}
declare function parse(tokens: Token[]): Program;

/**
 * YapLang error types.
 *
 * Every user-facing error carries a line number and a Gen-Z flavored — but
 * genuinely clear — message. `runner.ts` catches these and prints `.message`
 * so the process never dies with a raw stack trace.
 */
declare class YapError extends Error {
    /** 1-based line where the error occurred (0 if unknown). */
    readonly line: number;
    constructor(message: string, line: number);
}
/** Raised by the lexer/parser when the source doesn't parse. */
declare class YapSyntaxError extends YapError {
    constructor(message: string, line: number);
}
/** Raised by the interpreter while a program is running. */
declare class YapRuntimeError extends YapError {
    constructor(message: string, line: number);
}

/**
 * THE central keyword table — the single source of truth for the language's
 * surface vocabulary.
 *
 * To re-skin the language (different slang, a different theme, even a different
 * name) you only touch this file:
 *   1. Change LANGUAGE_NAME / FILE_EXTENSION.
 *   2. Edit the spellings in KEYWORDS.
 * Nothing in the lexer, parser, or interpreter hard-codes a keyword spelling.
 */

declare const LANGUAGE_NAME = "YapLang";
declare const FILE_EXTENSION = ".yap";
/**
 * Maps a source spelling to the concept (TokenType) it represents.
 * Keyword matching is case-sensitive and exact.
 */
declare const KEYWORDS: Readonly<Record<string, TokenType>>;

/**
 * The public entry point: ties the lexer, parser, and interpreter together.
 *
 * `run` never throws for ordinary program errors — it catches YapError and
 * reports a friendly, line-numbered message through the same `output` sink used
 * for prints, so both the CLI and the browser playground behave identically.
 */
interface RunResult {
    ok: boolean;
    /** Present when the run failed: the friendly error message. */
    error?: string;
}
type OutputFn = (text: string) => void;
declare function run(source: string, output?: OutputFn): RunResult;

export { FILE_EXTENSION, Interpreter, KEYWORDS, LANGUAGE_NAME, Lexer, type OutputFn, Parser, type RunResult, YapError, YapRuntimeError, YapSyntaxError, parse, run, tokenize };
