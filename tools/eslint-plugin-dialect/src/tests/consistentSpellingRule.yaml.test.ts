/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { Linter } from 'eslint';
import type { ESLint } from 'eslint';

import { consistentSpellingRule } from '../consistentSpellingRule';

// `yaml-eslint-parser` ships as an ES module only, but these tests compile to CommonJS (Jest
// runs the lib-commonjs output). A literal `import()` would be downleveled to `require()` and
// throw, so load it through a runtime dynamic import that survives compilation.
// eslint-disable-next-line no-new-func -- the only reliable way to import an ESM-only package from a CommonJS bundle
const importEsm: (specifier: string) => Promise<unknown> = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<unknown>;

const dialectPlugin: ESLint.Plugin = {
  rules: { 'consistent-spelling': consistentSpellingRule }
};

let yamlParser: Linter.Parser;
let linter: Linter;

beforeAll(async () => {
  yamlParser = (await importEsm('yaml-eslint-parser')) as Linter.Parser;
  linter = new Linter();
});

interface IRuleOptions {
  readonly dialect?: 'american' | 'british';
  readonly comments?: boolean;
  readonly strings?: boolean;
  readonly identifiers?: boolean;
}

function makeConfig(options: IRuleOptions): Linter.Config {
  return {
    files: ['**/*.yaml'],
    plugins: { dialect: dialectPlugin },
    languageOptions: { parser: yamlParser },
    rules: { 'dialect/consistent-spelling': ['error', options] }
  };
}

function lint(code: string, options: IRuleOptions = {}): Linter.LintMessage[] {
  return linter.verify(code, makeConfig(options), 'file.yaml');
}

function fix(code: string, options: IRuleOptions = {}): string {
  return linter.verifyAndFix(code, makeConfig(options), 'file.yaml').output;
}

describe('YAML support (yaml-eslint-parser)', () => {
  it('leaves wholly American YAML alone', () => {
    expect(lint('# a color note\ngreeting: the color\n')).toEqual([]);
  });

  it('auto-fixes comments and scalar values', () => {
    const code: string = '# a colour note\ngreeting: the colour\n';
    const messages: Linter.LintMessage[] = lint(code);

    expect(messages).toHaveLength(2);
    expect(fix(code)).toBe('# a color note\ngreeting: the color\n');
  });

  it('flags mapping keys but never rewrites them', () => {
    const code: string = 'colourKey: 1\n';
    const messages: Linter.LintMessage[] = lint(code);

    // The key is flagged (report-only); the numeric value has no British word.
    expect(messages).toHaveLength(1);
    expect(fix(code)).toBe(code);
  });

  it('auto-fixes quoted values and sequence items', () => {
    expect(fix('a: "the colour"\nlist:\n  - flavour item\n')).toBe(
      'a: "the color"\nlist:\n  - flavor item\n'
    );
  });

  it('leaves numbers and booleans alone', () => {
    expect(lint('count: 42\nenabled: true\n')).toEqual([]);
  });

  it('enforces British when the dialect option is set', () => {
    expect(fix('greeting: the color\n', { dialect: 'british' })).toBe('greeting: the colour\n');
  });

  it('respects the comments and strings toggles', () => {
    expect(lint('# colour\ngreeting: the colour\n', { comments: false, strings: false })).toEqual([]);
  });

  it('respects the identifiers toggle for keys', () => {
    expect(lint('colourKey: 1\n', { identifiers: false })).toEqual([]);
  });
});
