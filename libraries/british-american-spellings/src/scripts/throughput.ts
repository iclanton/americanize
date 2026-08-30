/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

/**
 * Micro-benchmark for the spelling engine. Not part of the published package - the compiled
 * `lib-*` scripts folders are excluded from `files`. Run after a build with `rushx benchmark`.
 */

import { performance } from 'node:perf_hooks';

import { findNonPreferredSpellings, getAmericanSpelling } from '../index';

const BRITISH: readonly string[] = [
  'colour',
  'behaviour',
  'organise',
  'initialise',
  'favourite',
  'neighbour',
  'centre',
  'analyse'
];
const AMERICAN: readonly string[] = [
  'color',
  'value',
  'index',
  'handler',
  'result',
  'buffer',
  'render',
  'update',
  'config',
  'parser',
  'model',
  'client',
  'request',
  'response',
  'service',
  'factory'
];

function pick(words: readonly string[]): string {
  return words[Math.floor(Math.random() * words.length)]!;
}

/** Builds a corpus of camelCase-ish tokens, `britishFraction` of them British. */
function buildCorpus(targetBytes: number, britishFraction: number): string {
  const tokens: string[] = [];
  let length: number = 0;
  while (length < targetBytes) {
    const head: string = Math.random() < britishFraction ? pick(BRITISH) : pick(AMERICAN);
    let token: string = head;
    if (Math.random() < 0.4) {
      const tail: string = pick(AMERICAN);
      token = head + tail.charAt(0).toUpperCase() + tail.slice(1);
    }

    tokens.push(token);
    length += token.length + 1;
  }

  return tokens.join(' ');
}

function runBenchmark(): void {
  const corpus: string = buildCorpus(1_000_000, 0.05);
  const megabytes: number = Buffer.byteLength(corpus) / 1e6;
  const tokenCount: number = corpus.split(' ').length;

  const passes: number = 50;
  findNonPreferredSpellings(corpus, 'american'); // warm up
  const findStart: number = performance.now();
  let matchCount: number = 0;
  for (let i: number = 0; i < passes; i++) {
    matchCount = findNonPreferredSpellings(corpus, 'american').length;
  }
  const findMs: number = (performance.now() - findStart) / passes;

  const sample: string[] = corpus.split(' ', 100_000);
  const lookupPasses: number = 10;
  const lookupStart: number = performance.now();
  for (let i: number = 0; i < lookupPasses; i++) {
    for (const word of sample) {
      getAmericanSpelling(word);
    }
  }
  const lookupSeconds: number = (performance.now() - lookupStart) / 1000;

  console.info(`corpus: ${megabytes.toFixed(2)} MB, ${tokenCount} tokens, ${matchCount} matches`);
  console.info(
    `findNonPreferredSpellings: ${findMs.toFixed(2)} ms/pass -> ${(megabytes / (findMs / 1000)).toFixed(1)} MB/s`
  );
  console.info(
    `getAmericanSpelling: ${((sample.length * lookupPasses) / lookupSeconds / 1e6).toFixed(1)} M lookups/s`
  );
}

runBenchmark();
