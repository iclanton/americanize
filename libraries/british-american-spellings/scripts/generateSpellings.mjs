// Regenerates src/britishAmericanSpellings.json from the VarCon dataset.
//
// This is an offline authoring tool — it is NOT part of `heft build`. Run it by hand when the
// upstream dataset or the curation below changes:
//
//   node scripts/generateSpellings.mjs
//
// VarCon (the "Variant Conversion" tables from Kevin Atkinson's SCOWL / English Speller
// Database) is the source of truth for the raw British <-> American pairs. See NOTICE for its
// copyright. We pin it by content hash so regeneration is reproducible and tamper-evident;
// set VARCON_FILE=/path/to/varcon.txt to generate from a local copy instead of fetching.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const VARCON_URL = 'https://raw.githubusercontent.com/en-wl/wordlist/master/varcon/varcon.txt';
const VARCON_SHA256 = '75af63da46ec12d7eb14b9f1ba8d3898d484dd6872755b73c921b215875a3629';

// Curation applied on top of the raw VarCon extraction.
//
// VarCon marks a word that both dialects accept with A *and* B on the same token, so the
// extractor naturally drops it (British === American). That correctly excludes `advertise`,
// `exercise`, and the computing senses of `disk`/`dialog`. We add back the four
// "ambiguous" pairs the library still wants in the table so that its `includeAmbiguous`
// option has something to enforce; the rule leaves them alone by default.
const OVERRIDES = {
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
const EXCLUDE = new Set();

// VarCon tags each cluster with a commonness "level" (lower = more common / more strongly
// verified). Levels of 80+ are dominated by algorithmically-generated inflections of rare
// words (`unplagiariseddest`, `savourousest`), so we keep entries at or below this threshold.
// The everyday British/American differences all sit at level 10-60.
const MAX_LEVEL = 70;

async function loadVarconAsync() {
  const localPath = process.env.VARCON_FILE;
  const bytes = localPath
    ? await readFile(localPath)
    : Buffer.from(await (await fetch(VARCON_URL)).arrayBuffer());

  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== VARCON_SHA256) {
    throw new Error(
      `VarCon content hash mismatch.\n  expected ${VARCON_SHA256}\n  actual   ${actual}\n` +
        'The upstream data changed. Review the diff, then update VARCON_SHA256.'
    );
  }

  return bytes.toString('utf8');
}

// Extract British -> American pairs from VarCon. Each non-comment line is a set of
// "<tags>: word" groups separated by " / "; the word whose tags include the bare token `A`
// is the primary American spelling, and `B` the primary British one. Variant markers (`Av`,
// `Bv`, `Z`, numbers, ...) are not primary and are ignored, so a word both dialects accept
// (tagged `A B` on the same token) yields British === American and is skipped.
function extractPairs(text) {
  const pairs = {};
  let level = Number.POSITIVE_INFINITY;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('#')) {
      // Cluster header, e.g. "# colour <verified> (level 50)". Its level applies to the
      // lines that follow until the next header.
      const match = line.match(/\(level (\d+)\)/);
      level = match ? Number(match[1]) : Number.POSITIVE_INFINITY;
      continue;
    }
    if (line.length === 0 || level > MAX_LEVEL) {
      continue;
    }

    const mapping = line.split(' | ')[0];
    let american;
    let british;

    for (const group of mapping.split(' / ')) {
      const colon = group.indexOf(': ');
      if (colon < 0) {
        continue;
      }

      const tags = group.slice(0, colon).trim().split(/\s+/);
      const word = group.slice(colon + 2).trim();
      if (american === undefined && tags.includes('A')) {
        american = word;
      }
      if (british === undefined && tags.includes('B')) {
        british = word;
      }
    }

    if (american === undefined || british === undefined) {
      continue;
    }

    const from = british.toLowerCase();
    const to = american.toLowerCase();
    // Whole single words only: the lookup splits text on non-letters, so possessives,
    // hyphenates and multi-word entries could never match anyway.
    if (from !== to && /^[a-z]+$/.test(from) && /^[a-z]+$/.test(to) && !(from in pairs)) {
      pairs[from] = to;
    }
  }

  return pairs;
}

async function mainAsync() {
  const text = await loadVarconAsync();
  const pairs = extractPairs(text);

  for (const [from, to] of Object.entries(OVERRIDES)) {
    pairs[from] = to;
  }
  for (const from of EXCLUDE) {
    delete pairs[from];
  }
  for (const [from, to] of Object.entries(pairs)) {
    if (from === to) {
      delete pairs[from];
    }
  }

  const sorted = {};
  for (const key of Object.keys(pairs).sort()) {
    sorted[key] = pairs[key];
  }

  const outPath = fileURLToPath(new URL('../src/britishAmericanSpellings.json', import.meta.url));
  await writeFile(outPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.info(`Wrote ${Object.keys(sorted).length} entries to ${outPath}`);
}

await mainAsync();
