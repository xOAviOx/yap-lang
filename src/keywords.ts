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

import { TokenType } from "./token.js";

export const LANGUAGE_NAME = "YapLang";
export const FILE_EXTENSION = ".yap";

/**
 * Maps a source spelling to the concept (TokenType) it represents.
 * Keyword matching is case-sensitive and exact.
 */
export const KEYWORDS: Readonly<Record<string, TokenType>> = {
  vibe: TokenType.VAR,
  nocap: TokenType.TRUE,
  cap: TokenType.FALSE,
  ghosted: TokenType.NULL,
  fr: TokenType.IF,
  orfr: TokenType.ELIF,
  nah: TokenType.ELSE,
  onloop: TokenType.WHILE,
  grind: TokenType.FOR,
  bestie: TokenType.FUNCTION,
  bet: TokenType.RETURN,
  vibin: TokenType.AND,
  lowkey: TokenType.OR,
  sus: TokenType.NOT,
  dip: TokenType.BREAK,
  skrt: TokenType.CONTINUE,
};

/**
 * Reverse lookup: concept -> spelling. Handy for producing error messages that
 * speak the language's own dialect ("expected 'nah' or 'orfr'").
 */
export const KEYWORD_SPELLINGS: Readonly<Partial<Record<TokenType, string>>> =
  Object.fromEntries(
    Object.entries(KEYWORDS).map(([word, type]) => [type, word]),
  ) as Record<TokenType, string>;

/** Returns the slang spelling for a concept, or the raw type if none exists. */
export function spell(type: TokenType): string {
  return KEYWORD_SPELLINGS[type] ?? type;
}
