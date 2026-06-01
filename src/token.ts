/**
 * Token definitions for YapLang.
 *
 * The TokenType enum is intentionally "concept-based" rather than
 * "spelling-based" — e.g. the keyword for "if" is a single token type `IF`,
 * regardless of what slang word currently spells it. That means renaming the
 * language only requires editing `keywords.ts`, never this file or the parser.
 */

export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  IDENTIFIER = "IDENTIFIER",

  // Keyword tokens (spellings live in keywords.ts)
  VAR = "VAR", // vibe
  TRUE = "TRUE", // nocap
  FALSE = "FALSE", // cap
  NULL = "NULL", // ghosted
  IF = "IF", // fr
  ELIF = "ELIF", // orfr
  ELSE = "ELSE", // nah
  WHILE = "WHILE", // onloop
  FOR = "FOR", // grind
  FUNCTION = "FUNCTION", // bestie
  RETURN = "RETURN", // bet
  AND = "AND", // vibin
  OR = "OR", // lowkey
  NOT = "NOT", // sus
  BREAK = "BREAK", // dip
  CONTINUE = "CONTINUE", // skrt

  // Operators
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  PERCENT = "PERCENT",
  EQUAL = "EQUAL", // =
  EQUAL_EQUAL = "EQUAL_EQUAL", // ==
  BANG_EQUAL = "BANG_EQUAL", // !=
  LESS = "LESS", // <
  GREATER = "GREATER", // >
  LESS_EQUAL = "LESS_EQUAL", // <=
  GREATER_EQUAL = "GREATER_EQUAL", // >=

  // Punctuation / grouping
  LEFT_PAREN = "LEFT_PAREN",
  RIGHT_PAREN = "RIGHT_PAREN",
  LEFT_BRACE = "LEFT_BRACE",
  RIGHT_BRACE = "RIGHT_BRACE",
  LEFT_BRACKET = "LEFT_BRACKET",
  RIGHT_BRACKET = "RIGHT_BRACKET",
  COMMA = "COMMA",
  SEMICOLON = "SEMICOLON",

  // Structural
  NEWLINE = "NEWLINE",
  EOF = "EOF",
}

export interface Token {
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

export function makeToken(
  type: TokenType,
  lexeme: string,
  line: number,
  column: number,
  literal: Token["literal"] = undefined,
): Token {
  return { type, lexeme, literal, line, column };
}
