/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { createHash } from 'node:crypto';

import { FileSystem } from '@rushstack/node-core-library';

/** A British spelling and the American spelling it maps to, both lower-cased. */
export interface ISpellingPair {
  readonly british: string;
  readonly american: string;
}

const VARCON_URL: string = 'https://raw.githubusercontent.com/en-wl/wordlist/master/varcon/varcon.txt';
const VARCON_SHA256: string = '75af63da46ec12d7eb14b9f1ba8d3898d484dd6872755b73c921b215875a3629';

// VarCon tags each cluster with a commonness "level" (lower = more common / more strongly
// verified). Levels of 80+ are dominated by algorithmically-generated inflections of rare
// words (`unplagiariseddest`, `savourousest`), so we keep entries at or below this threshold.
// The everyday British/American differences all sit at level 10-60.
const MAX_LEVEL: number = 70;

// Curation applied on top of the raw VarCon extraction.
//
// VarCon marks a word that both dialects accept with A *and* B on the same token, so the
// extractor naturally drops it (British === American). That correctly excludes `advertise`,
// `exercise`, and the computing senses of `disk`/`dialog`. We add back the four "ambiguous"
// pairs the library still wants in the table so that its `includeAmbiguous` option has
// something to enforce; the rule leaves them alone by default.
const OVERRIDES: Readonly<Record<string, string>> = {
  programme: 'program',
  programmes: 'programs',
  disc: 'disk',
  discs: 'disks',
  dialogue: 'dialog',
  dialogues: 'dialogs',
  analogue: 'analog',
  analogues: 'analogs'
};

// British spellings to drop from the table entirely, even if VarCon lists them.
const EXCLUDE: ReadonlySet<string> = new Set<string>();

// The committed data file, relative to this compiled module.
const OUTPUT_PATH: string = `${__dirname}/../../../libraries/british-american-spellings/src/britishAmericanSpellings.json`;

/**
 * Loads the VarCon source, verifying it against the pinned content hash. Set VARCON_FILE to a
 * local path to generate offline; otherwise the dataset is fetched from its upstream URL.
 */
async function loadVarconAsync(): Promise<string> {
  const { VARCON_FILE } = process.env;
  let bytes: Buffer;
  if (VARCON_FILE !== undefined) {
    bytes = await FileSystem.readFileToBufferAsync(VARCON_FILE);
  } else {
    const response: Response = await fetch(VARCON_URL);
    bytes = Buffer.from(await response.arrayBuffer());
  }

  const actual: string = createHash('sha256').update(bytes).digest('hex');
  if (actual !== VARCON_SHA256) {
    throw new Error(
      `VarCon content hash mismatch.\n  expected ${VARCON_SHA256}\n  actual   ${actual}\n` +
        'The upstream data changed. Review the diff, then update VARCON_SHA256.'
    );
  }

  return bytes.toString('utf8');
}

/**
 * Extracts British-to-American pairs from VarCon. Each non-comment line is a set of
 * "<tags>: word" groups separated by " / "; the word whose tags include the bare token `A`
 * is the primary American spelling, and `B` the primary British one. Variant markers (`Av`,
 * `Bv`, `Z`, numbers, ...) are not primary and are ignored, so a word both dialects accept
 * (tagged `A B` on the same token) yields British === American and is skipped.
 */
export function extractPairs(varconText: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  let level: number = Number.POSITIVE_INFINITY;

  for (const rawLine of varconText.split('\n')) {
    const line: string = rawLine.trim();
    if (line.startsWith('#')) {
      const match: RegExpMatchArray | null = line.match(/\(level (\d+)\)/);
      level = match ? Number(match[1]) : Number.POSITIVE_INFINITY;
      continue;
    }
    if (line.length === 0 || level > MAX_LEVEL) {
      continue;
    }

    const pair: ISpellingPair | undefined = extractLine(line);
    if (pair === undefined) {
      continue;
    }

    const { british, american } = pair;
    // Whole single words only: the lookup splits text on non-letters, so possessives,
    // hyphenates and multi-word entries could never match anyway.
    const isWholeWordPair: boolean =
      british !== american && /^[a-z]+$/.test(british) && /^[a-z]+$/.test(american);
    if (isWholeWordPair && !(british in pairs)) {
      pairs[british] = american;
    }
  }

  return pairs;
}

function extractLine(line: string): ISpellingPair | undefined {
  const [mapping = ''] = line.split(' | ');
  let american: string | undefined;
  let british: string | undefined;

  for (const group of mapping.split(' / ')) {
    const colon: number = group.indexOf(': ');
    if (colon < 0) {
      continue;
    }

    const tags: string[] = group.slice(0, colon).trim().split(/\s+/);
    const word: string = group.slice(colon + 2).trim();
    if (american === undefined && tags.includes('A')) {
      american = word;
    }
    if (british === undefined && tags.includes('B')) {
      british = word;
    }
  }

  if (american === undefined || british === undefined) {
    return undefined;
  }

  return { british: british.toLowerCase(), american: american.toLowerCase() };
}

/** Applies the curation overrides/excludes and returns a new, key-sorted table. */
export function curate(pairs: Record<string, string>): Record<string, string> {
  const merged: [string, string][] = Object.entries({ ...pairs, ...OVERRIDES });
  merged.sort(([left], [right]): number => (left < right ? -1 : left > right ? 1 : 0));

  const sorted: Record<string, string> = {};
  for (const [british, american] of merged) {
    if (british !== american && !EXCLUDE.has(british)) {
      sorted[british] = american;
    }
  }

  return sorted;
}

async function mainAsync(): Promise<void> {
  const varconText: string = await loadVarconAsync();
  const table: Record<string, string> = curate(extractPairs(varconText));

  await FileSystem.writeFileAsync(OUTPUT_PATH, `${JSON.stringify(table, undefined, 2)}\n`, {
    ensureFolderExists: true
  });
  console.info(`Wrote ${Object.keys(table).length} entries to ${OUTPUT_PATH}`);
}

mainAsync().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
