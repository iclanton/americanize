/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import britishAmericanSpellings from './britishAmericanSpellings.json';

/**
 * The canonical British-to-American spelling table.
 *
 * Keys are the British (Commonwealth) spelling and values are the American spelling, both
 * lower-cased. Inflected forms (plurals, `-ed`/`-ing`, `-isation`/`-ization`, etc.) are
 * listed explicitly rather than derived at runtime, so a lookup is a single map read and the
 * table is fully reviewable.
 *
 * The JSON is generated from the VarCon dataset by the `@americanize/spelling-data-generator`
 * tool (see NOTICE.md for attribution) — edit that generator, not the JSON by hand.
 *
 * @public
 */
export const BRITISH_TO_AMERICAN: ReadonlyMap<string, string> = new Map(
  Object.entries(britishAmericanSpellings)
);

// The reverse of BRITISH_TO_AMERICAN, for enforcing British spellings. The forward table is
// deduplicated on the American side (see the `kneelt`/`knelt` case that was removed), so this
// inversion is 1:1; the guard keeps it that way should a future collision be introduced,
// preferring the first British spelling seen (the alphabetically earliest, since the JSON is
// sorted).
function invert(forward: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const reversed: Map<string, string> = new Map();

  for (const [british, american] of forward) {
    if (!reversed.has(american)) {
      reversed.set(american, british);
    }
  }

  return reversed;
}

/**
 * The canonical American-to-British spelling table: {@link BRITISH_TO_AMERICAN} inverted.
 *
 * Keys are the American spelling and values are the British spelling. Because a handful of
 * American words correspond to more than one British spelling in principle, only one British
 * spelling is offered per American word.
 *
 * @public
 */
export const AMERICAN_TO_BRITISH: ReadonlyMap<string, string> = invert(BRITISH_TO_AMERICAN);
