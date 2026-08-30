/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { createHash } from 'node:crypto';
import path from 'node:path';

import type { HeftConfiguration, IHeftTaskPlugin, IHeftTaskSession } from '@rushstack/heft';
import { FileSystem, JsonFile } from '@rushstack/node-core-library';

// Curation applied on top of the raw VarCon extraction.
//
// VarCon marks a word that both dialects accept with A *and* B on the same token, so the
// extractor naturally drops it (British === American). That correctly excludes `advertise`,
// `exercise`, and the computing senses of `disk`/`dialog`. We add back the four "ambiguous"
// pairs the library still wants in the table so that its `includeAmbiguous` option has
// something to enforce; the rule leaves them alone by default.
import OVERRIDES from './overrides.json';

/** A British spelling and the American spelling it maps to, both lower-cased. */
export interface ISpellingPair {
  readonly british: string;
  readonly american: string;
}

// VarCon (the "Variant Conversion" table) ships in the SCOWLv1 line of the English Speller
// Database. We pin the `v1` branch: the newer `v2` (ESDB) restructured the project and no
// longer produces a varcon.txt, and the old `master` branch name has been retired. Pinned by
// content hash below so a moved branch fails loudly rather than silently changing the data.
const VARCON_URL: string = 'https://raw.githubusercontent.com/en-wl/wordlist/v1/varcon/varcon.txt';
const VARCON_SHA256: string = '75af63da46ec12d7eb14b9f1ba8d3898d484dd6872755b73c921b215875a3629';

// British spellings to drop from the table entirely, even if VarCon lists them.
const EXCLUDE: ReadonlySet<string> = new Set<string>();

const PLUGIN_NAME: string = 'generate-spelling-data';

export interface IOptions {
  outputFilePath: string;
}

interface IGenerateSpellingsPluginParameters {
  /**
   * Path to a local VarCon file. If not provided, the dataset is fetched from its upstream URL.
   */
  varconFilePath: string | undefined;

  /**
   * VarCon tags each cluster with a commonness "level" (lower = more common / more strongly
   * verified). Levels of 80+ are dominated by algorithmically-generated inflections of rare
   * words (`unplagiariseddest`, `savourousest`), so we keep entries at or below this threshold.
   * The everyday British/American differences all sit at level 10-60.
   */
  maxLevel: number;
}

export default class GenerateSpellingsPlugin implements IHeftTaskPlugin<IOptions> {
  public readonly pluginName: string = PLUGIN_NAME;

  public apply(
    session: IHeftTaskSession,
    heftConfiguration: HeftConfiguration,
    pluginOptions: IOptions
  ): void {
    const { hooks, logger, parameters } = session;
    hooks.run.tapPromise(PLUGIN_NAME, async () => {
      const { buildFolderPath } = heftConfiguration;
      const { outputFilePath: rawOutputFilePath } = pluginOptions;
      const outputFilePath: string = path.resolve(buildFolderPath, rawOutputFilePath);
      const cliParameters: IGenerateSpellingsPluginParameters = {
        varconFilePath: parameters.getStringParameter('--varcon-file').value,
        maxLevel: parameters.getIntegerParameter('--max-level').value!
      };

      const [varconText, existing] = await Promise.all([
        loadVarconAsync(cliParameters),
        JsonFile.loadAsync(outputFilePath)
      ]);
      const table: Record<string, string> = curate(extractPairs(varconText, cliParameters));

      const existingMap: Map<string, string> = new Map(Object.entries(existing));
      const newMap: Map<string, string> = new Map(Object.entries(table));

      let hasChanged: boolean = existingMap.size !== newMap.size;
      if (!hasChanged) {
        for (const [british, american] of newMap) {
          if (existingMap.get(british) !== american) {
            hasChanged = true;
            break;
          }
        }
      }

      if (!hasChanged) {
        logger.terminal.writeLine(`No changes to ${outputFilePath}`);
        return;
      } else {
        await JsonFile.saveAsync(table, outputFilePath, { ensureFolderExists: true });
        logger.emitWarning(
          new Error(`The output file ${outputFilePath} has changed. Please commit the updated file.`)
        );
      }
    });
  }
}

/**
 * Loads the VarCon source, verifying it against the pinned content hash. Set VARCON_FILE to a
 * local path to generate offline; otherwise the dataset is fetched from its upstream URL.
 */
async function loadVarconAsync(cliParameters: IGenerateSpellingsPluginParameters): Promise<string> {
  const { varconFilePath } = cliParameters;
  let bytes: Buffer;
  if (varconFilePath) {
    bytes = await FileSystem.readFileToBufferAsync(varconFilePath);
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
export function extractPairs(
  varconText: string,
  cliParameters: IGenerateSpellingsPluginParameters
): Record<string, string> {
  const { maxLevel } = cliParameters;
  const pairs: Record<string, string> = {};
  let level: number = Number.POSITIVE_INFINITY;

  for (const rawLine of varconText.split('\n')) {
    const line: string = rawLine.trim();
    if (line.startsWith('#')) {
      const match: RegExpMatchArray | null = line.match(/\(level (\d+)\)/);
      level = match ? Number(match[1]) : Number.POSITIVE_INFINITY;
      continue;
    }
    if (line.length === 0 || level > maxLevel) {
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
