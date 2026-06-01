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

import { KEYWORDS } from "./keywords.js";
import { makeToken, Token, TokenType } from "./token.js";
import { syntaxError } from "./errors.js";

const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";
const isAlpha = (ch: string): boolean =>
  (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
const isAlphaNumeric = (ch: string): boolean => isAlpha(ch) || isDigit(ch);

export class Lexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];

  private start = 0; // index of the first char of the current lexeme
  private current = 0; // index of the char being looked at
  private line = 1;
  private column = 1; // 1-based column of `current`
  private startColumn = 1; // column where the current lexeme began

  /** Nesting depth of () and [] — used to suppress newlines inside them. */
  private groupingDepth = 0;

  constructor(source: string) {
    this.source = source;
  }

  scan(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startColumn = this.column;
      this.scanToken();
    }
    // A trailing NEWLINE keeps the parser's statement loop simple.
    this.tokens.push(makeToken(TokenType.NEWLINE, "", this.line, this.column));
    this.tokens.push(makeToken(TokenType.EOF, "", this.line, this.column));
    return this.tokens;
  }

  private scanToken(): void {
    const ch = this.advance();
    switch (ch) {
      case "(":
        this.groupingDepth++;
        this.addToken(TokenType.LEFT_PAREN);
        break;
      case ")":
        if (this.groupingDepth > 0) this.groupingDepth--;
        this.addToken(TokenType.RIGHT_PAREN);
        break;
      case "[":
        this.groupingDepth++;
        this.addToken(TokenType.LEFT_BRACKET);
        break;
      case "]":
        if (this.groupingDepth > 0) this.groupingDepth--;
        this.addToken(TokenType.RIGHT_BRACKET);
        break;
      case "{":
        this.addToken(TokenType.LEFT_BRACE);
        break;
      case "}":
        this.addToken(TokenType.RIGHT_BRACE);
        break;
      case ",":
        this.addToken(TokenType.COMMA);
        break;
      case ";":
        this.addToken(TokenType.SEMICOLON);
        break;
      case "+":
        this.addToken(TokenType.PLUS);
        break;
      case "-":
        this.addToken(TokenType.MINUS);
        break;
      case "*":
        this.addToken(TokenType.STAR);
        break;
      case "%":
        this.addToken(TokenType.PERCENT);
        break;
      case "/":
        if (this.match("/")) {
          // Line comment: consume to end of line (but not the newline itself).
          while (!this.isAtEnd() && this.peek() !== "\n") this.advance();
        } else {
          this.addToken(TokenType.SLASH);
        }
        break;
      case "=":
        this.addToken(this.match("=") ? TokenType.EQUAL_EQUAL : TokenType.EQUAL);
        break;
      case "!":
        if (this.match("=")) {
          this.addToken(TokenType.BANG_EQUAL);
        } else {
          throw syntaxError(
            this.line,
            `unexpected '!' (did you mean '!=' or the 'sus' keyword?)`,
          );
        }
        break;
      case "<":
        this.addToken(this.match("=") ? TokenType.LESS_EQUAL : TokenType.LESS);
        break;
      case ">":
        this.addToken(
          this.match("=") ? TokenType.GREATER_EQUAL : TokenType.GREATER,
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
      case "\t":
        break; // ignore other whitespace
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

  private newline(): void {
    // Only emit a terminator at top level; collapse runs of blank lines by
    // letting the parser skip consecutive NEWLINE tokens.
    if (this.groupingDepth === 0) {
      this.addToken(TokenType.NEWLINE);
    }
    this.line++;
    this.column = 1;
  }

  private string(): void {
    let value = "";
    while (!this.isAtEnd() && this.peek() !== '"') {
      const ch = this.advance();
      if (ch === "\n") {
        // Allow real newlines inside strings, but track line numbers.
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
        `unterminated string — you opened a '"' and ghosted it`,
      );
    }

    this.advance(); // closing quote
    this.addToken(TokenType.STRING, value);
  }

  private escape(): string {
    if (this.isAtEnd()) {
      throw syntaxError(this.line, `dangling '\\' at end of string`);
    }
    const ch = this.advance();
    switch (ch) {
      case "n":
        return "\n";
      case "t":
        return "\t";
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

  private number(): void {
    while (isDigit(this.peek())) this.advance();

    // Fractional part.
    if (this.peek() === "." && isDigit(this.peekNext())) {
      this.advance(); // consume "."
      while (isDigit(this.peek())) this.advance();
    }

    const text = this.source.slice(this.start, this.current);
    this.addToken(TokenType.NUMBER, Number(text));
  }

  private identifier(): void {
    while (isAlphaNumeric(this.peek())) this.advance();
    const text = this.source.slice(this.start, this.current);
    const keyword = KEYWORDS[text];

    if (keyword === undefined) {
      this.addToken(TokenType.IDENTIFIER);
      return;
    }

    // Keywords that carry a literal value.
    switch (keyword) {
      case TokenType.TRUE:
        this.addToken(TokenType.TRUE, true);
        break;
      case TokenType.FALSE:
        this.addToken(TokenType.FALSE, false);
        break;
      case TokenType.NULL:
        this.addToken(TokenType.NULL, null);
        break;
      default:
        this.addToken(keyword);
    }
  }

  // --- Low-level cursor helpers ---------------------------------------------

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    const ch = this.source[this.current] ?? "";
    this.current++;
    this.column++;
    return ch;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private peek(): string {
    return this.source[this.current] ?? "\0";
  }

  private peekNext(): string {
    return this.source[this.current + 1] ?? "\0";
  }

  private addToken(type: TokenType, literal: Token["literal"] = undefined): void {
    const lexeme = this.source.slice(this.start, this.current);
    this.tokens.push(
      makeToken(type, lexeme, this.line, this.startColumn, literal),
    );
  }
}

/** Convenience wrapper. */
export function tokenize(source: string): Token[] {
  return new Lexer(source).scan();
}
