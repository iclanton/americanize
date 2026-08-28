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
 * This file is the source of truth for the `eslint-plugin-americanize` rule. When adding a
 * word, add every inflected form you expect code to actually use.
 */
export const BRITISH_TO_AMERICAN: ReadonlyMap<string, string> = new Map(Object.entries(britishAmericanSpellings));