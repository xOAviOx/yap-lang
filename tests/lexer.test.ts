import { describe, expect, it } from "vitest";
import { tokenize } from "../src/lexer.js";
import { TokenType } from "../src/token.js";

/** Token types excluding trailing NEWLINE/EOF noise. */
function types(source: string): TokenType[] {
  return tokenize(source)
    .map((t) => t.type)
    .filter((t) => t !== TokenType.NEWLINE && t !== TokenType.EOF);
}

describe("lexer", () => {
  it("scans numbers, including decimals", () => {
    const toks = tokenize("5 3.14 0");
    expect(toks[0]).toMatchObject({ type: TokenType.NUMBER, literal: 5 });
    expect(toks[1]).toMatchObject({ type: TokenType.NUMBER, literal: 3.14 });
    expect(toks[2]).toMatchObject({ type: TokenType.NUMBER, literal: 0 });
  });

  it("scans strings with escapes", () => {
    const toks = tokenize('"line\\nbreak\\t\\"quote\\""');
    expect(toks[0]).toMatchObject({
      type: TokenType.STRING,
      literal: 'line\nbreak\t"quote"',
    });
  });

  it("maps slang keywords to concept token types", () => {
    expect(types("vibe fr orfr nah onloop grind bestie bet")).toEqual([
      TokenType.VAR,
      TokenType.IF,
      TokenType.ELIF,
      TokenType.ELSE,
      TokenType.WHILE,
      TokenType.FOR,
      TokenType.FUNCTION,
      TokenType.RETURN,
    ]);
  });

  it("treats logical words and booleans as keywords with literals", () => {
    const toks = tokenize("nocap cap ghosted vibin lowkey sus dip skrt");
    expect(toks[0]).toMatchObject({ type: TokenType.TRUE, literal: true });
    expect(toks[1]).toMatchObject({ type: TokenType.FALSE, literal: false });
    expect(toks[2]).toMatchObject({ type: TokenType.NULL, literal: null });
    expect(toks.map((t) => t.type).slice(3, 7)).toEqual([
      TokenType.AND,
      TokenType.OR,
      TokenType.NOT,
      TokenType.BREAK,
    ]);
  });

  it("treats non-keyword identifiers (like spill) as IDENTIFIER", () => {
    const toks = tokenize("spill howmany squad");
    expect(toks.slice(0, 3).map((t) => t.type)).toEqual([
      TokenType.IDENTIFIER,
      TokenType.IDENTIFIER,
      TokenType.IDENTIFIER,
    ]);
  });

  it("scans operators", () => {
    expect(types("+ - * / % == != < > <= >= =")).toEqual([
      TokenType.PLUS,
      TokenType.MINUS,
      TokenType.STAR,
      TokenType.SLASH,
      TokenType.PERCENT,
      TokenType.EQUAL_EQUAL,
      TokenType.BANG_EQUAL,
      TokenType.LESS,
      TokenType.GREATER,
      TokenType.LESS_EQUAL,
      TokenType.GREATER_EQUAL,
      TokenType.EQUAL,
    ]);
  });

  it("ignores // comments to end of line", () => {
    expect(types("vibe x = 5 // this is a comment\nx")).toEqual([
      TokenType.VAR,
      TokenType.IDENTIFIER,
      TokenType.EQUAL,
      TokenType.NUMBER,
      TokenType.IDENTIFIER,
    ]);
  });

  it("emits NEWLINE at top level but suppresses it inside () and []", () => {
    const top = tokenize("a\nb").filter((t) => t.type === TokenType.NEWLINE);
    // one real newline + the synthetic trailing newline
    expect(top.length).toBe(2);

    const inParens = tokenize("(a\nb)").filter(
      (t) => t.type === TokenType.NEWLINE,
    );
    expect(inParens.length).toBe(1); // only the trailing synthetic one
  });

  it("tracks line and column numbers", () => {
    const toks = tokenize("vibe x\n  y");
    expect(toks[0]).toMatchObject({ line: 1, column: 1 }); // vibe
    const y = toks.find((t) => t.lexeme === "y");
    expect(y).toMatchObject({ line: 2, column: 3 });
  });

  it("throws a friendly error on an unterminated string", () => {
    expect(() => tokenize('"oops')).toThrowError(/line 1/);
  });
});
