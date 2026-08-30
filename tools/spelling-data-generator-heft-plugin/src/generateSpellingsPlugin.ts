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

// The VarCon README carries the third-party copyright / license text that must be reproduced
// when redistributing the data. Pinned by content hash alongside the data, so an upstream
// license change fails the build and forces us to review and refresh NOTICE.md.
const VARCON_README_URL: string = 'https://raw.githubusercontent.com/en-wl/wordlist/v1/varcon/README';
const VARCON_README_SHA256: string = '9aace7c213e4f3080bb1b47d343a52b00d4fe830534f3beca149dedf4b64c2e6';

// British spellings to drop from the table entirely, even if VarCon lists them.
const EXCLUDE: ReadonlySet<string> = new Set<string>();

const PLUGIN_NAME: string = 'generate-spelling-data';

export interface IOptions {
  outputFilePath: string;
  noticeFilePath: string;
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
      const { outputFilePath: rawOutputFilePath, noticeFilePath: rawNoticeFilePath } = pluginOptions;
      const outputFilePath: string = path.resolve(buildFolderPath, rawOutputFilePath);
      const noticeFilePath: string = path.resolve(buildFolderPath, rawNoticeFilePath);
      const cliParameters: IGenerateSpellingsPluginParameters = {
        varconFilePath: parameters.getStringParameter('--varcon-file').value,
        maxLevel: parameters.getIntegerParameter('--max-level').value!
      };

      const [varconText, readmeText, existing] = await Promise.all([
        loadVarconAsync(cliParameters),
        fetchPinnedTextAsync(VARCON_README_URL, VARCON_README_SHA256),
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
      } else {
        await JsonFile.saveAsync(table, outputFilePath, { ensureFolderExists: true });
        logger.emitWarning(
          new Error(`The output file ${outputFilePath} has changed. Please commit the updated file.`)
        );
      }

      // Keep the third-party license notice in sync with the exact upstream text we pulled.
      const noticeContent: string = composeNotice(extractLicense(readmeText));
      await writeTextIfChangedAsync(noticeFilePath, noticeContent, logger);
    });
  }
}

/**
 * Loads the VarCon source, verifying it against the pinned content hash. Set VARCON_FILE to a
 * local path to generate offline; otherwise the dataset is fetched from its upstream URL.
 */
async function loadVarconAsync(cliParameters: IGenerateSpellingsPluginParameters): Promise<string> {
  const { varconFilePath } = cliParameters;
  if (varconFilePath) {
    const bytes: Buffer = await FileSystem.readFileToBufferAsync(varconFilePath);
    return verifyHash(bytes, VARCON_SHA256, varconFilePath).toString('utf8');
  }

  return fetchPinnedTextAsync(VARCON_URL, VARCON_SHA256);
}

/** Fetches a URL and verifies it against the pinned content hash, returning its UTF-8 text. */
async function fetchPinnedTextAsync(url: string, expectedSha256: string): Promise<string> {
  const response: Response = await fetch(url);
  const bytes: Buffer = Buffer.from(await response.arrayBuffer());
  return verifyHash(bytes, expectedSha256, url).toString('utf8');
}

function verifyHash(bytes: Buffer, expectedSha256: string, source: string): Buffer {
  const actual: string = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedSha256) {
    throw new Error(
      `Content hash mismatch for ${source}.\n  expected ${expectedSha256}\n  actual   ${actual}\n` +
        'The upstream source changed. Review the diff, then update the pinned hash.'
    );
  }

  return bytes;
}

// The VarCon README ends with a "Copyright" section holding the full license text. Return
// everything after that heading, verbatim, so the notice reproduces the upstream wording.
function extractLicense(readmeText: string): string {
  const heading: RegExpMatchArray | null = readmeText.match(/\nCopyright\n=+\n+/);
  if (heading?.index === undefined) {
    throw new Error('Could not find the Copyright section in the VarCon README.');
  }

  return readmeText.slice(heading.index + heading[0].length).trim();
}

// Renders NOTICE.md from a fixed preamble plus the verbatim upstream license.
function composeNotice(license: string): string {
  return [
    '# Third-party notices',
    '',
    '## VarCon (Variant Conversion Info)',
    '',
    "The British/American spelling table in `src/britishAmericanSpellings.json` is derived from the **VarCon** dataset, part of Kevin Atkinson's SCOWL / English Speller Database (<http://wordlist.aspell.net/> and <https://github.com/en-wl/wordlist>). It is regenerated by the `@americanize/spelling-data-generator-heft-plugin` Heft plugin, which also regenerates this notice.",
    '',
    'VarCon is distributed under the following permissive terms:',
    '',
    '```',
    license,
    '```',
    ''
  ].join('\n');
}

// Writes `content` to `filePath`, warning (rather than silently rewriting) when it drifts from
// what is committed, so the change is noticed and committed.
async function writeTextIfChangedAsync(
  filePath: string,
  content: string,
  logger: IHeftTaskSession['logger']
): Promise<void> {
  let existing: string | undefined;
  try {
    existing = await FileSystem.readFileAsync(filePath);
  } catch (error: unknown) {
    if (!FileSystem.isNotExistError(error as Error)) {
      throw error;
    }
  }

  if (existing === content) {
    logger.terminal.writeLine(`No changes to ${filePath}`);
    return;
  }

  await FileSystem.writeFileAsync(filePath, content, { ensureFolderExists: true });
  logger.emitWarning(new Error(`The output file ${filePath} has changed. Please commit the updated file.`));
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
