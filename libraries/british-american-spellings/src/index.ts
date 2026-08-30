/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { AMERICAN_TO_BRITISH, BRITISH_TO_AMERICAN } from './britishAmericanSpellings';

/**
 * Which English is being enforced: `'american'` steers toward American spellings, `'british'` toward British.
 *
 * @public
 */
export type SpellingDialect = 'american' | 'british';

/**
 * American spellings that are also widely accepted in British English - chiefly because the
 * American form is the usual one in computing and science - so enforcing a British-only
 * alternative on them tends to be wrong. These are skipped when enforcing British unless
 * {@link ISpellingLookupOptions.includeAmbiguous} is set.
 *
 * - `program`/`programs`: a *computer* program is spelled `program` in British English too;
 *   `programme` is the TV-listing / event sense.
 * - `disk`/`disks`: `disk` is standard for storage (hard disk); `disc` is the other senses.
 * - `analog`/`analogs`: `analog` is the usual electronics spelling.
 * - `dialog`/`dialogs`: a UI `dialog` (box) is spelled this way; `dialogue` is conversation.
 *
 * @beta
 */
export const AMBIGUOUS_AMERICAN_SPELLINGS: ReadonlySet<string> = new Set([
  'program',
  'programs',
  'disk',
  'disks',
  'analog',
  'analogs',
  'dialog',
  'dialogs'
]);

/**
 * Options shared by the dialect-aware lookups.
 *
 * @public
 */
export interface ISpellingLookupOptions {
  /**
   * When enforcing British spellings, also flag American spellings in
   * {@link AMBIGUOUS_AMERICAN_SPELLINGS} (`program`, `disk`, `analog`, `dialog`). Has no
   * effect when enforcing American. Defaults to `false`.
   *
   * @beta
   */
  readonly includeAmbiguous?: boolean;
}

/**
 * One non-preferred spelling and the preferred spelling it should be replaced with.
 *
 * @public
 */
export interface ISpellingCorrection {
  /** The offending (non-preferred) spelling, lower-cased. */
  readonly from: string;
  /** The preferred spelling to use instead, matched to the casing of the input word. */
  readonly to: string;
}

// The translation table that steers *toward* a target dialect: to enforce American spellings
// we look words up in the British->American table, and vice versa.
function tableFor(target: SpellingDialect): ReadonlyMap<string, string> {
  return target === 'american' ? BRITISH_TO_AMERICAN : AMERICAN_TO_BRITISH;
}

// Whether a word should be left alone as an accepted-either-way spelling. Only bites when
// enforcing British, since the ambiguous set holds American spellings.
function isExcludedAsAmbiguous(
  lowerWord: string,
  target: SpellingDialect,
  includeAmbiguous: boolean
): boolean {
  return target === 'british' && !includeAmbiguous && AMBIGUOUS_AMERICAN_SPELLINGS.has(lowerWord);
}

/**
 * Re-applies the casing pattern of `source` onto `replacement`.
 *
 * Handles the three cases that occur in real identifiers and prose - all-lower (`colour`),
 * capitalised (`Colour`) and all-upper (`COLOUR`) - and otherwise falls back to the
 * replacement's own (lower) casing. A mixed-case source such as `cOlOuR` is not something a
 * correction can sensibly preserve, so it is treated as lower-case.
 *
 * @public
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
  const isCapitalised: boolean =
    firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
  if (isCapitalised) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }

  return replacement;
}

/**
 * Looks up a single whole word, ignoring case, for a target dialect.
 *
 * Returns the preferred spelling (cased to match `word`) when `word` is a known
 * non-preferred spelling for `target`, or `undefined` when it is already in the target
 * dialect or simply unknown. The lookup is whole-word only: callers are responsible for
 * splitting identifiers and prose into words first (see {@link findNonPreferredSpellings}).
 *
 * @public
 */
export function getPreferredSpelling(
  word: string,
  target: SpellingDialect,
  options: ISpellingLookupOptions = {}
): string | undefined {
  const { includeAmbiguous = false } = options;
  const lower: string = word.toLowerCase();
  if (isExcludedAsAmbiguous(lower, target, includeAmbiguous)) {
    return undefined;
  }

  const preferred: string | undefined = tableFor(target).get(lower);
  if (preferred === undefined) {
    return undefined;
  }

  return matchCase(word, preferred);
}

/**
 * Whether `word` is a known non-preferred spelling for `target` (i.e. it has a distinct preferred form).
 *
 * @public
 */
export function isNonPreferredSpelling(
  word: string,
  target: SpellingDialect,
  options: ISpellingLookupOptions = {}
): boolean {
  const { includeAmbiguous = false } = options;
  const lower: string = word.toLowerCase();
  if (isExcludedAsAmbiguous(lower, target, includeAmbiguous)) {
    return false;
  }

  return tableFor(target).has(lower);
}

/**
 * Looks up the American spelling of a British word. Shorthand for {@link getPreferredSpelling} with `'american'`.
 *
 * @public
 */
export function getAmericanSpelling(word: string): string | undefined {
  return getPreferredSpelling(word, 'american');
}

/**
 * Looks up the British spelling of an American word. Shorthand for {@link getPreferredSpelling} with `'british'`.
 *
 * @public
 */
export function getBritishSpelling(word: string, options: ISpellingLookupOptions = {}): string | undefined {
  return getPreferredSpelling(word, 'british', options);
}

/**
 * Whether `word` is a known British spelling with a distinct American form.
 *
 * @public
 */
export function isBritishSpelling(word: string): boolean {
  return isNonPreferredSpelling(word, 'american');
}

/**
 * Whether `word` is a known American spelling with a distinct British form.
 *
 * @public
 */
export function isAmericanSpelling(word: string, options: ISpellingLookupOptions = {}): boolean {
  return isNonPreferredSpelling(word, 'british', options);
}

/**
 * One non-preferred spelling found inside a larger piece of text, with where it was found.
 *
 * @public
 */
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
 * Finds every non-preferred spelling for `target` inside an arbitrary run of text.
 *
 * The text is split into maximal letter runs, so this transparently handles
 * `camelCase`, `snake_case`, `kebab-case`, `SCREAMING_CASE` and plain prose. `camelCase`
 * boundaries are also split, so `favouriteColour` yields both `favourite` and `colour`.
 * Matches are returned in the order they appear.
 *
 * @public
 */
export function findNonPreferredSpellings(
  text: string,
  target: SpellingDialect,
  options: ISpellingLookupOptions = {}
): ISpellingMatch[] {
  const { includeAmbiguous = false } = options;
  const table: ReadonlyMap<string, string> = tableFor(target);
  const skipAmbiguous: boolean = target === 'british' && !includeAmbiguous;
  const matches: ISpellingMatch[] = [];

  // Hot path: walk each maximal letter run, split it further on camelCase / acronym
  // boundaries, and look each sub-word up inline. Kept allocation-light on purpose - no
  // intermediate token objects, and the table and option checks are hoisted out of the
  // per-word loop (this duplicates `getPreferredSpelling`, which stays for single-word use).
  for (const runMatch of text.matchAll(WORD_PATTERN)) {
    const run: string = runMatch[0];
    const runStart: number = runMatch.index;

    let wordStart: number = 0;
    for (let i: number = 1; i <= run.length; i++) {
      if (i !== run.length && !isSubwordBoundary(run, i)) {
        continue;
      }

      const value: string = run.slice(wordStart, i);
      const index: number = runStart + wordStart;
      wordStart = i;

      const lower: string = value.toLowerCase();
      if (skipAmbiguous && AMBIGUOUS_AMERICAN_SPELLINGS.has(lower)) {
        continue;
      }

      const preferred: string | undefined = table.get(lower);
      if (preferred !== undefined) {
        matches.push({ word: value, index, from: lower, to: matchCase(value, preferred) });
      }
    }
  }

  return matches;
}

/**
 * Finds every British spelling in `text`. Shorthand for {@link findNonPreferredSpellings} with `'american'`.
 *
 * @public
 */
export function findBritishSpellings(text: string): ISpellingMatch[] {
  return findNonPreferredSpellings(text, 'american');
}

/**
 * Finds every American spelling in `text`. Shorthand for {@link findNonPreferredSpellings} with `'british'`.
 *
 * @public
 */
export function findAmericanSpellings(text: string, options: ISpellingLookupOptions = {}): ISpellingMatch[] {
  return findNonPreferredSpellings(text, 'british', options);
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

export { AMERICAN_TO_BRITISH, BRITISH_TO_AMERICAN } from './britishAmericanSpellings';
