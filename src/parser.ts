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

import {
  ArrayLiteral,
  Assign,
  Block,
  Expr,
  ExpressionStmt,
  ForStmt,
  FunctionDecl,
  IfStmt,
  IndexExpr,
  Program,
  Stmt,
  VarDecl,
  Variable,
  WhileStmt,
} from "./ast.js";
import { syntaxError } from "./errors.js";
import { spell } from "./keywords.js";
import { Token, TokenType } from "./token.js";

export class Parser {
  private readonly tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const statements: Stmt[] = [];
    this.skipSeparators();
    while (!this.isAtEnd()) {
      statements.push(this.statement());
      this.skipSeparators();
    }
    return { kind: "Program", statements };
  }

  // --- Statements ------------------------------------------------------------

  private statement(): Stmt {
    if (this.check(TokenType.VAR)) return this.varDeclaration();
    if (this.check(TokenType.FUNCTION)) return this.functionDeclaration();
    if (this.check(TokenType.IF)) return this.ifStatement();
    if (this.check(TokenType.WHILE)) return this.whileStatement();
    if (this.check(TokenType.FOR)) return this.forStatement();
    if (this.check(TokenType.RETURN)) return this.returnStatement();
    if (this.check(TokenType.BREAK)) {
      const tok = this.advance();
      return { kind: "BreakStmt", line: tok.line };
    }
    if (this.check(TokenType.CONTINUE)) {
      const tok = this.advance();
      return { kind: "ContinueStmt", line: tok.line };
    }
    if (this.check(TokenType.LEFT_BRACE)) return this.block();
    return this.expressionStatement();
  }

  private varDeclaration(): VarDecl {
    const keyword = this.advance(); // VAR
    const name = this.consume(
      TokenType.IDENTIFIER,
      `expected a variable name after '${spell(TokenType.VAR)}'`,
    );
    this.consume(
      TokenType.EQUAL,
      `expected '=' to give '${name.lexeme}' a value`,
    );
    const initializer = this.expression();
    return {
      kind: "VarDecl",
      name: name.lexeme,
      initializer,
      line: keyword.line,
    };
  }

  private functionDeclaration(): FunctionDecl {
    const keyword = this.advance(); // FUNCTION
    const name = this.consume(
      TokenType.IDENTIFIER,
      `expected a function name after '${spell(TokenType.FUNCTION)}'`,
    );
    this.consume(TokenType.LEFT_PAREN, `expected '(' after function name`);

    const params: string[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        const param = this.consume(
          TokenType.IDENTIFIER,
          `expected a parameter name`,
        );
        params.push(param.lexeme);
      } while (this.matchToken(TokenType.COMMA));
    }
    this.consume(TokenType.RIGHT_PAREN, `expected ')' after parameters`);

    const body = this.block();
    return {
      kind: "FunctionDecl",
      name: name.lexeme,
      params,
      body,
      line: keyword.line,
    };
  }

  private ifStatement(): IfStmt {
    const keyword = this.advance(); // IF or ELIF
    this.consume(
      TokenType.LEFT_PAREN,
      `expected '(' after '${keyword.lexeme}'`,
    );
    const condition = this.expression();
    this.consume(TokenType.RIGHT_PAREN, `expected ')' after condition`);
    const thenBranch = this.block();

    let elseBranch: IfStmt | Block | undefined;
    // Separators may sit between the closing brace and orfr/nah.
    const save = this.current;
    this.skipSeparators();
    if (this.check(TokenType.ELIF)) {
      elseBranch = this.ifStatement(); // recurse: orfr behaves like a nested fr
    } else if (this.check(TokenType.ELSE)) {
      this.advance();
      elseBranch = this.block();
    } else {
      // No else clause — rewind so the skipped separators terminate this stmt.
      this.current = save;
    }

    return {
      kind: "IfStmt",
      condition,
      thenBranch,
      elseBranch,
      line: keyword.line,
    };
  }

  private whileStatement(): WhileStmt {
    const keyword = this.advance(); // WHILE
    this.consume(
      TokenType.LEFT_PAREN,
      `expected '(' after '${keyword.lexeme}'`,
    );
    const condition = this.expression();
    this.consume(TokenType.RIGHT_PAREN, `expected ')' after condition`);
    const body = this.block();
    return { kind: "WhileStmt", condition, body, line: keyword.line };
  }

  private forStatement(): ForStmt {
    const keyword = this.advance(); // FOR
    this.consume(
      TokenType.LEFT_PAREN,
      `expected '(' after '${keyword.lexeme}'`,
    );

    // Initializer.
    let initializer: VarDecl | ExpressionStmt | undefined;
    if (this.matchToken(TokenType.SEMICOLON)) {
      initializer = undefined;
    } else if (this.check(TokenType.VAR)) {
      initializer = this.varDeclaration();
      this.consume(TokenType.SEMICOLON, `expected ';' after loop initializer`);
    } else {
      const expr = this.expression();
      initializer = { kind: "ExpressionStmt", expression: expr, line: expr.line };
      this.consume(TokenType.SEMICOLON, `expected ';' after loop initializer`);
    }

    // Condition.
    let condition: Expr | undefined;
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.expression();
    }
    this.consume(TokenType.SEMICOLON, `expected ';' after loop condition`);

    // Update.
    let update: Expr | undefined;
    if (!this.check(TokenType.RIGHT_PAREN)) {
      update = this.expression();
    }
    this.consume(TokenType.RIGHT_PAREN, `expected ')' after loop clauses`);

    const body = this.block();
    return {
      kind: "ForStmt",
      initializer,
      condition,
      update,
      body,
      line: keyword.line,
    };
  }

  private returnStatement(): Stmt {
    const keyword = this.advance(); // RETURN
    let value: Expr | undefined;
    if (
      !this.check(TokenType.NEWLINE) &&
      !this.check(TokenType.SEMICOLON) &&
      !this.check(TokenType.RIGHT_BRACE) &&
      !this.check(TokenType.EOF)
    ) {
      value = this.expression();
    }
    return { kind: "ReturnStmt", value, line: keyword.line };
  }

  private block(): Block {
    const brace = this.consume(
      TokenType.LEFT_BRACE,
      `expected '{' to start a block`,
    );
    const statements: Stmt[] = [];
    this.skipSeparators();
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      statements.push(this.statement());
      this.skipSeparators();
    }
    this.consume(TokenType.RIGHT_BRACE, `expected '}' to close the block`);
    return { kind: "Block", statements, line: brace.line };
  }

  private expressionStatement(): ExpressionStmt {
    const expr = this.expression();
    return { kind: "ExpressionStmt", expression: expr, line: expr.line };
  }

  // --- Expressions -----------------------------------------------------------

  private expression(): Expr {
    return this.assignment();
  }

  private assignment(): Expr {
    const expr = this.or();

    if (this.check(TokenType.EQUAL)) {
      const equals = this.advance();
      const value = this.assignment(); // right-associative
      if (expr.kind === "Variable" || expr.kind === "IndexExpr") {
        const assign: Assign = {
          kind: "Assign",
          target: expr,
          value,
          line: equals.line,
        };
        return assign;
      }
      throw syntaxError(equals.line, `can't assign to that — invalid target`);
    }

    return expr;
  }

  private or(): Expr {
    let expr = this.and();
    while (this.check(TokenType.OR)) {
      const op = this.advance();
      const right = this.and();
      expr = { kind: "Logical", operator: "or", left: expr, right, line: op.line };
    }
    return expr;
  }

  private and(): Expr {
    let expr = this.equality();
    while (this.check(TokenType.AND)) {
      const op = this.advance();
      const right = this.equality();
      expr = {
        kind: "Logical",
        operator: "and",
        left: expr,
        right,
        line: op.line,
      };
    }
    return expr;
  }

  private equality(): Expr {
    let expr = this.comparison();
    while (this.check(TokenType.EQUAL_EQUAL) || this.check(TokenType.BANG_EQUAL)) {
      const op = this.advance();
      const right = this.comparison();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line,
      };
    }
    return expr;
  }

  private comparison(): Expr {
    let expr = this.term();
    while (
      this.check(TokenType.LESS) ||
      this.check(TokenType.GREATER) ||
      this.check(TokenType.LESS_EQUAL) ||
      this.check(TokenType.GREATER_EQUAL)
    ) {
      const op = this.advance();
      const right = this.term();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line,
      };
    }
    return expr;
  }

  private term(): Expr {
    let expr = this.factor();
    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const op = this.advance();
      const right = this.factor();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line,
      };
    }
    return expr;
  }

  private factor(): Expr {
    let expr = this.unary();
    while (
      this.check(TokenType.STAR) ||
      this.check(TokenType.SLASH) ||
      this.check(TokenType.PERCENT)
    ) {
      const op = this.advance();
      const right = this.unary();
      expr = {
        kind: "Binary",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line,
      };
    }
    return expr;
  }

  private unary(): Expr {
    if (this.check(TokenType.MINUS)) {
      const op = this.advance();
      const operand = this.unary();
      return { kind: "Unary", operator: "-", operand, line: op.line };
    }
    if (this.check(TokenType.NOT)) {
      const op = this.advance();
      const operand = this.unary();
      return { kind: "Unary", operator: "not", operand, line: op.line };
    }
    return this.callOrIndex();
  }

  private callOrIndex(): Expr {
    let expr = this.primary();
    // Postfix chains: foo(a)(b)[c]...
    for (;;) {
      if (this.check(TokenType.LEFT_PAREN)) {
        expr = this.finishCall(expr);
      } else if (this.check(TokenType.LEFT_BRACKET)) {
        const bracket = this.advance();
        const index = this.expression();
        this.consume(
          TokenType.RIGHT_BRACKET,
          `expected ']' after index expression`,
        );
        const indexExpr: IndexExpr = {
          kind: "IndexExpr",
          object: expr,
          index,
          line: bracket.line,
        };
        expr = indexExpr;
      } else {
        break;
      }
    }
    return expr;
  }

  private finishCall(callee: Expr): Expr {
    const paren = this.advance(); // LEFT_PAREN
    const args: Expr[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.expression());
      } while (this.matchToken(TokenType.COMMA));
    }
    this.consume(TokenType.RIGHT_PAREN, `expected ')' after arguments`);
    return { kind: "CallExpr", callee, args, line: paren.line };
  }

  private primary(): Expr {
    const tok = this.peek();
    switch (tok.type) {
      case TokenType.NUMBER:
        this.advance();
        return {
          kind: "NumberLiteral",
          value: tok.literal as number,
          line: tok.line,
        };
      case TokenType.STRING:
        this.advance();
        return {
          kind: "StringLiteral",
          value: tok.literal as string,
          line: tok.line,
        };
      case TokenType.TRUE:
        this.advance();
        return { kind: "BooleanLiteral", value: true, line: tok.line };
      case TokenType.FALSE:
        this.advance();
        return { kind: "BooleanLiteral", value: false, line: tok.line };
      case TokenType.NULL:
        this.advance();
        return { kind: "NullLiteral", line: tok.line };
      case TokenType.IDENTIFIER: {
        this.advance();
        const variable: Variable = {
          kind: "Variable",
          name: tok.lexeme,
          line: tok.line,
        };
        return variable;
      }
      case TokenType.LEFT_PAREN: {
        this.advance();
        const expr = this.expression();
        this.consume(TokenType.RIGHT_PAREN, `expected ')' after expression`);
        return expr;
      }
      case TokenType.LEFT_BRACKET:
        return this.arrayLiteral();
      default:
        throw syntaxError(
          tok.line,
          `expected a value but found ${describe(tok)}`,
        );
    }
  }

  private arrayLiteral(): ArrayLiteral {
    const bracket = this.advance(); // LEFT_BRACKET
    const elements: Expr[] = [];
    if (!this.check(TokenType.RIGHT_BRACKET)) {
      do {
        // Allow a trailing comma: [1, 2, ]
        if (this.check(TokenType.RIGHT_BRACKET)) break;
        elements.push(this.expression());
      } while (this.matchToken(TokenType.COMMA));
    }
    this.consume(TokenType.RIGHT_BRACKET, `expected ']' to close the array`);
    return { kind: "ArrayLiteral", elements, line: bracket.line };
  }

  // --- Token plumbing --------------------------------------------------------

  private skipSeparators(): void {
    while (this.check(TokenType.NEWLINE) || this.check(TokenType.SEMICOLON)) {
      this.advance();
    }
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private matchToken(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw syntaxError(this.peek().line, message);
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    // The token stream always ends with EOF, so this is always defined.
    return this.tokens[this.current] as Token;
  }

  private previous(): Token {
    return this.tokens[this.current - 1] as Token;
  }
}

function describe(tok: Token): string {
  switch (tok.type) {
    case TokenType.NEWLINE:
      return "end of line";
    case TokenType.EOF:
      return "end of file";
    case TokenType.RIGHT_BRACE:
      return "'}'";
    case TokenType.RIGHT_PAREN:
      return "')'";
    default:
      return `'${tok.lexeme}'`;
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse();
}
