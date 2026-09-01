/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { Linter } from 'eslint';
import type { ESLint } from 'eslint';

import { consistentSpellingRule } from '../consistentSpellingRule';

// `@eslint/markdown` ships as an ES module only, but these tests compile to CommonJS (Jest runs
// the lib-commonjs output). A literal `import()` would be downleveled to `require()` and throw
// on an ESM-only package, so load it through a runtime dynamic import that survives compilation.
// eslint-disable-next-line no-new-func -- the only reliable way to import an ESM-only package from a CommonJS bundle
const importEsm: (specifier: string) => Promise<{ default: ESLint.Plugin }> = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<{ default: ESLint.Plugin }>;

const dialectPlugin: ESLint.Plugin = {
  rules: { 'consistent-spelling': consistentSpellingRule }
};

let markdownPlugin: ESLint.Plugin;
let linter: Linter;

beforeAll(async () => {
  markdownPlugin = (await importEsm('@eslint/markdown')).default;
  linter = new Linter();
});

interface IRuleOptions {
  readonly dialect?: 'american' | 'british';
  readonly comments?: boolean;
}

function makeConfig(options: IRuleOptions): Linter.Config {
  return {
    files: ['**/*.md'],
    plugins: { dialect: dialectPlugin, markdown: markdownPlugin },
    language: 'markdown/gfm',
    rules: { 'dialect/consistent-spelling': ['error', options] }
  };
}

function lint(code: string, options: IRuleOptions = {}): Linter.LintMessage[] {
  return linter.verify(code, makeConfig(options), 'file.md');
}

function fix(code: string, options: IRuleOptions = {}): string {
  return linter.verifyAndFix(code, makeConfig(options), 'file.md').output;
}

describe('Markdown support (@eslint/markdown)', () => {
  it('leaves wholly American prose alone', () => {
    expect(lint('# The color heading\n\nA normal color paragraph.\n')).toEqual([]);
  });

  it('flags and auto-fixes prose, headings and link text', () => {
    const code: string = '# The colour heading\n\nSee [the colour link](https://example.com/colour-path).\n';
    const messages: Linter.LintMessage[] = lint(code);

    expect(messages).toHaveLength(2);
    expect(fix(code)).toBe('# The color heading\n\nSee [the color link](https://example.com/colour-path).\n');
  });

  it('does not touch inline code or fenced code blocks', () => {
    const code: string = 'Prose about `colour` code.\n\n```js\nconst colour = 1;\n```\n';
    expect(lint(code)).toEqual([]);
    expect(fix(code)).toBe(code);
  });

  it('splits words in prose (camelCase)', () => {
    // favouriteColour splits into `favourite` + `colour`; `neighbour` is the third word.
    const messages: Linter.LintMessage[] = lint('The favouriteColour of the neighbour.\n');
    expect(messages).toHaveLength(3);
  });

  it('enforces British prose when the dialect option is set', () => {
    expect(fix('The color of the neighbor.\n', { dialect: 'british' })).toBe(
      'The colour of the neighbour.\n'
    );
  });

  it('respects the comments toggle', () => {
    expect(lint('A colour paragraph.\n', { comments: false })).toEqual([]);
  });
});
