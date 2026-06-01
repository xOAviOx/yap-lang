/**
 * AST node definitions.
 *
 * Every node is a plain object with a string `kind` discriminant and a `line`
 * for error reporting. Expressions produce values; statements produce effects.
 */

// --- Expressions -------------------------------------------------------------

export interface NumberLiteral {
  kind: "NumberLiteral";
  value: number;
  line: number;
}

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
  line: number;
}

export interface BooleanLiteral {
  kind: "BooleanLiteral";
  value: boolean;
  line: number;
}

export interface NullLiteral {
  kind: "NullLiteral";
  line: number;
}

export interface ArrayLiteral {
  kind: "ArrayLiteral";
  elements: Expr[];
  line: number;
}

export interface Variable {
  kind: "Variable";
  name: string;
  line: number;
}

export interface Assign {
  kind: "Assign";
  target: Variable | IndexExpr;
  value: Expr;
  line: number;
}

export interface Binary {
  kind: "Binary";
  operator: string; // "+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">="
  left: Expr;
  right: Expr;
  line: number;
}

export interface Logical {
  kind: "Logical";
  operator: "and" | "or";
  left: Expr;
  right: Expr;
  line: number;
}

export interface Unary {
  kind: "Unary";
  operator: "-" | "not";
  operand: Expr;
  line: number;
}

export interface CallExpr {
  kind: "CallExpr";
  callee: Expr;
  args: Expr[];
  line: number;
}

export interface IndexExpr {
  kind: "IndexExpr";
  object: Expr;
  index: Expr;
  line: number;
}

export type Expr =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | ArrayLiteral
  | Variable
  | Assign
  | Binary
  | Logical
  | Unary
  | CallExpr
  | IndexExpr;

// --- Statements --------------------------------------------------------------

export interface ExpressionStmt {
  kind: "ExpressionStmt";
  expression: Expr;
  line: number;
}

export interface VarDecl {
  kind: "VarDecl";
  name: string;
  initializer: Expr;
  line: number;
}

export interface Block {
  kind: "Block";
  statements: Stmt[];
  line: number;
}

export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  thenBranch: Block;
  /** Either another IfStmt (an `orfr`) or a Block (a `nah`), or undefined. */
  elseBranch: IfStmt | Block | undefined;
  line: number;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expr;
  body: Block;
  line: number;
}

export interface ForStmt {
  kind: "ForStmt";
  initializer: VarDecl | ExpressionStmt | undefined;
  condition: Expr | undefined;
  update: Expr | undefined;
  body: Block;
  line: number;
}

export interface FunctionDecl {
  kind: "FunctionDecl";
  name: string;
  params: string[];
  body: Block;
  line: number;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  value: Expr | undefined;
  line: number;
}

export interface BreakStmt {
  kind: "BreakStmt";
  line: number;
}

export interface ContinueStmt {
  kind: "ContinueStmt";
  line: number;
}

export type Stmt =
  | ExpressionStmt
  | VarDecl
  | Block
  | IfStmt
  | WhileStmt
  | ForStmt
  | FunctionDecl
  | ReturnStmt
  | BreakStmt
  | ContinueStmt;

export interface Program {
  kind: "Program";
  statements: Stmt[];
}
