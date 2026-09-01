/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { Linter } from 'eslint';
import type { ESLint } from 'eslint';

import { consistentSpellingRule } from '../consistentSpellingRule';

// `@eslint/json` ships as an ES module only, but these tests compile to CommonJS (Jest runs the
// lib-commonjs output). A literal `import()` would be downleveled to `require()` and throw on an
// ESM-only package, so load it through a runtime dynamic import that survives compilation.
// eslint-disable-next-line no-new-func -- the only reliable way to import an ESM-only package from a CommonJS bundle
const importEsm: (specifier: string) => Promise<{ default: ESLint.Plugin }> = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<{ default: ESLint.Plugin }>;

const dialectPlugin: ESLint.Plugin = {
  rules: { 'consistent-spelling': consistentSpellingRule }
};

let jsonPlugin: ESLint.Plugin;
let linter: Linter;

beforeAll(async () => {
  jsonPlugin = (await importEsm('@eslint/json')).default;
  linter = new Linter();
});

interface IRuleOptions {
  readonly dialect?: 'american' | 'british';
  readonly identifiers?: boolean;
  readonly strings?: boolean;
}

function makeConfig(options: IRuleOptions): Linter.Config {
  return {
    files: ['**/*.json'],
    plugins: { dialect: dialectPlugin, json: jsonPlugin },
    language: 'json/json',
    rules: { 'dialect/consistent-spelling': ['error', options] }
  };
}

function lint(code: string, options: IRuleOptions = {}): Linter.LintMessage[] {
  return linter.verify(code, makeConfig(options), 'file.json');
}

function fix(code: string, options: IRuleOptions = {}): string {
  return linter.verifyAndFix(code, makeConfig(options), 'file.json').output;
}

describe('JSON support (@eslint/json)', () => {
  it('leaves wholly American JSON alone', () => {
    expect(lint('{ "color": "the color is red" }')).toEqual([]);
  });

  it('flags a British spelling in a string value and auto-fixes it', () => {
    const code: string = '{ "message": "the colour is red" }';
    const messages: Linter.LintMessage[] = lint(code);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("'color'");
    expect(fix(code)).toBe('{ "message": "the color is red" }');
  });

  it('flags an object key but never rewrites it (report-only, like an identifier)', () => {
    // The value is a number, so only the key is checked; it splits into `favourite`/`colour`.
    const code: string = '{ "favouriteColour": 1 }';
    const messages: Linter.LintMessage[] = lint(code);

    expect(messages).toHaveLength(2);
    expect(messages.map((message: Linter.LintMessage): string => message.message).join(' ')).toContain(
      "'favorite'"
    );
    expect(fix(code)).toBe(code);
  });

  it('fixes British spellings inside array string values', () => {
    expect(fix('{ "list": ["favour", "neighbour"] }')).toBe('{ "list": ["favor", "neighbor"] }');
  });

  it('checks nested object values', () => {
    expect(fix('{ "a": { "b": "the colour grey" } }')).toBe('{ "a": { "b": "the color gray" } }');
  });

  it('enforces British spellings when the dialect option is set', () => {
    expect(fix('{ "message": "the color" }', { dialect: 'british' })).toBe('{ "message": "the colour" }');
  });

  it('respects the identifiers toggle for keys', () => {
    expect(lint('{ "colourKey": 1 }', { identifiers: false })).toEqual([]);
  });

  it('respects the strings toggle for values', () => {
    expect(lint('{ "k": "the colour" }', { strings: false })).toEqual([]);
  });
});
