/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { BRITISH_TO_AMERICAN } from './britishAmericanSpellings';

/** One British spelling and the American spelling it should be replaced with. */
export interface ISpellingCorrection {
  /** The offending British (Commonwealth) spelling, lower-cased. */
  readonly british: string;
  /** The American spelling to use instead, matched to the casing of the input word. */
  readonly american: string;
}

/**
 * Re-applies the casing pattern of `source` onto `replacement`.
 *
 * Handles the three cases that occur in real identifiers and prose — all-lower (`colour`),
 * capitalised (`Colour`) and all-upper (`COLOUR`) — and otherwise falls back to the
 * replacement's own (lower) casing. A mixed-case source such as `cOlOuR` is not something a
 * correction can sensibly preserve, so it is treated as lower-case.
 */
export function matchCase(source: string, replacement: string): string {
  if (source.length === 0) {
    return replacement;
  }

  const isAllUpper: boolean = source === source.toUpperCase() && source !== source.toLowerCase();
  if (isAllUpper) {
    return replacement.toUpperCase();
  }

  const firstChar: string = source.charAt(0);
  const isCapitalised: boolean = firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
  if (isCapitalised) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }

  return replacement;
}

/**
 * Looks up a single whole word, ignoring case.
 *
 * Returns the American spelling (cased to match `word`) when `word` is a known British
 * spelling, or `undefined` when it is already American or simply unknown. The lookup is
 * whole-word only: callers are responsible for splitting identifiers and prose into words
 * first (see {@link findBritishSpellings}).
 */
export function getAmericanSpelling(word: string): string | undefined {
  const american: string | undefined = BRITISH_TO_AMERICAN[word.toLowerCase()];
  if (american === undefined) {
    return undefined;
  }

  return matchCase(word, american);
}

/** Whether `word` is a known British spelling with a distinct American form. */
export function isBritishSpelling(word: string): boolean {
  return Object.prototype.hasOwnProperty.call(BRITISH_TO_AMERICAN, word.toLowerCase());
}

/** One British spelling found inside a larger piece of text, with where it was found. */
export interface ISpellingMatch extends ISpellingCorrection {
  /** The exact substring that matched, preserving its original casing. */
  readonly word: string;
  /** Index of the first character of the match within the searched text. */
  readonly index: number;
}

// Words are runs of ASCII letters. Splitting on this boundary means `colourpicker` and
// `colour_picker` both surface `colour`, which is what lets one rule cover identifiers,
// comments and string literals without knowing which it is looking at. The Unicode
// property escapes would be stricter, but every entry in the table is ASCII.
const WORD_PATTERN: RegExp = /[A-Za-z]+/g;

/**
 * Finds every British spelling inside an arbitrary run of text.
 *
 * The text is split into maximal letter runs, so this transparently handles
 * `camelCase`, `snake_case`, `kebab-case`, `SCREAMING_CASE` and plain prose. `camelCase`
 * boundaries are also split, so `favouriteColour` yields both `favourite` and `colour`.
 * Matches are returned in the order they appear.
 */
export function findBritishSpellings(text: string): ISpellingMatch[] {
  const matches: ISpellingMatch[] = [];

  for (const rawWord of splitWords(text)) {
    const american: string | undefined = getAmericanSpelling(rawWord.value);
    if (american !== undefined) {
      matches.push({
        word: rawWord.value,
        index: rawWord.index,
        british: rawWord.value.toLowerCase(),
        american
      });
    }
  }

  return matches;
}

interface IWordToken {
  readonly value: string;
  readonly index: number;
}

// Split a letter run further on camelCase / PascalCase boundaries: a lower-to-upper
// transition (`fooBar`) and an acronym-to-word transition (`HTTPServer` -> `HTTP`,
// `Server`). Each emitted token keeps its offset within the original text so a caller can
// map it back to a source location.
function splitWords(text: string): IWordToken[] {
  const tokens: IWordToken[] = [];

  for (const runMatch of text.matchAll(WORD_PATTERN)) {
    const run: string = runMatch[0];
    const runStart: number = runMatch.index;

    let wordStart: number = 0;
    for (let i: number = 1; i <= run.length; i++) {
      const atEnd: boolean = i === run.length;
      const boundary: boolean = atEnd || isSubwordBoundary(run, i);
      if (boundary) {
        tokens.push({ value: run.slice(wordStart, i), index: runStart + wordStart });
        wordStart = i;
      }
    }
  }

  return tokens;
}

function isSubwordBoundary(run: string, i: number): boolean {
  const prev: string = run.charAt(i - 1);
  const curr: string = run.charAt(i);

  const lowerToUpper: boolean = isLower(prev) && isUpper(curr);
  if (lowerToUpper) {
    return true;
  }

  // `HTTPServer`: break before the last capital of an acronym when a lower-case letter
  // follows, so the acronym and the following word separate cleanly.
  const next: string = i + 1 < run.length ? run.charAt(i + 1) : '';
  return isUpper(prev) && isUpper(curr) && isLower(next);
}

function isUpper(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z';
}

function isLower(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

export { BRITISH_TO_AMERICAN } from './britishAmericanSpellings';
