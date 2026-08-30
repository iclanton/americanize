/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import spellings from './britishAmericanSpellings.json';

/**
 * The JSON value stored for a British headword. A bare string is the American spelling, with
 * Canadian and Australian both matching the British key. An object additionally carries the
 * Canadian and/or Australian spelling when it differs from the British key.
 */
type SpellingValue = string | { american: string; canadian?: string; australian?: string };

/** The preferred spelling of one headword across the four supported dialects, lower-cased. */
interface ISpellingCluster {
  readonly american: string;
  readonly british: string;
  readonly canadian: string;
  readonly australian: string;
}

// Expand the compact JSON into one cluster per headword. Canadian and Australian default to the
// British key, which is why the majority of entries can be stored as a bare American string.
const CLUSTERS: readonly ISpellingCluster[] = Object.entries(spellings as Record<string, SpellingValue>).map(
  ([british, value]) =>
    typeof value === 'string'
      ? { american: value, british, canadian: british, australian: british }
      : {
          american: value.american,
          british,
          canadian: value.canadian ?? british,
          australian: value.australian ?? british
        }
);

// Builds a "steer toward `target`" table: every other-dialect spelling that differs from the
// target spelling maps to it. Deduplicated first-wins; the clusters are already key-sorted, so
// the earliest (alphabetically first) source wins any collision.
function buildTable(target: keyof ISpellingCluster): ReadonlyMap<string, string> {
  const table: Map<string, string> = new Map();

  for (const cluster of CLUSTERS) {
    const preferred: string = cluster[target];
    for (const source of [cluster.american, cluster.british, cluster.canadian, cluster.australian]) {
      if (source !== preferred && !table.has(source)) {
        table.set(source, preferred);
      }
    }
  }

  return table;
}

/**
 * The canonical British-to-American spelling table.
 *
 * Keys are the British (Commonwealth) spelling and values are the American spelling, both
 * lower-cased. Inflected forms (plurals, `-ed`/`-ing`, `-isation`/`-ization`, etc.) are
 * listed explicitly rather than derived at runtime, so a lookup is a single map read and the
 * table is fully reviewable.
 *
 * The JSON is generated from the VarCon dataset by the `@americanize/spelling-data-generator`
 * tool (see NOTICE.md for attribution) - edit that generator, not the JSON by hand.
 *
 * @public
 */
export const BRITISH_TO_AMERICAN: ReadonlyMap<string, string> = new Map(
  CLUSTERS.filter((cluster) => cluster.british !== cluster.american).map((cluster) => [
    cluster.british,
    cluster.american
  ])
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

// Canadian and Australian steer-tables. Unlike the British/American pair these draw sources from
// every dialect in the cluster, so a Canadian lookup can correct an American, British *or*
// Australian spelling that Canada spells differently (Canadian is British with `-ize` endings;
// Australian is close to British with a small handful of exceptions).
export const TO_CANADIAN: ReadonlyMap<string, string> = buildTable('canadian');

export const TO_AUSTRALIAN: ReadonlyMap<string, string> = buildTable('australian');
