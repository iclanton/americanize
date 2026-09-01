/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { Linter } from 'eslint';
import type { ESLint } from 'eslint';

import { consistentSpellingRule } from '../consistentSpellingRule';

// `@html-eslint/eslint-plugin` ships as an ES module only, but these tests compile to CommonJS
// (Jest runs the lib-commonjs output). A literal `import()` would be downleveled to `require()`
// and throw, so load it through a runtime dynamic import that survives compilation.
// eslint-disable-next-line no-new-func -- the only reliable way to import an ESM-only package from a CommonJS bundle
const importEsm: (specifier: string) => Promise<{ default: ESLint.Plugin }> = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<{ default: ESLint.Plugin }>;

const dialectPlugin: ESLint.Plugin = {
  rules: { 'consistent-spelling': consistentSpellingRule }
};

let htmlPlugin: ESLint.Plugin;
let linter: Linter;

beforeAll(async () => {
  htmlPlugin = (await importEsm('@html-eslint/eslint-plugin')).default;
  linter = new Linter();
});

interface IRuleOptions {
  readonly dialect?: 'american' | 'british';
  readonly comments?: boolean;
  readonly strings?: boolean;
}

function makeConfig(options: IRuleOptions): Linter.Config {
  return {
    files: ['**/*.html'],
    plugins: { dialect: dialectPlugin, html: htmlPlugin },
    language: 'html/html',
    rules: { 'dialect/consistent-spelling': ['error', options] }
  };
}

function lint(code: string, options: IRuleOptions = {}): Linter.LintMessage[] {
  return linter.verify(code, makeConfig(options), 'file.html');
}

function fix(code: string, options: IRuleOptions = {}): string {
  return linter.verifyAndFix(code, makeConfig(options), 'file.html').output;
}

describe('HTML support (@html-eslint)', () => {
  it('leaves wholly American HTML alone', () => {
    expect(lint('<h1>The color</h1>\n<img alt="a color" src="x.png">\n')).toEqual([]);
  });

  it('auto-fixes element text and comment bodies', () => {
    const code: string = '<h1>The colour</h1>\n<!-- a neighbour note -->\n';
    const messages: Linter.LintMessage[] = lint(code);

    expect(messages).toHaveLength(2);
    expect(fix(code)).toBe('<h1>The color</h1>\n<!-- a neighbor note -->\n');
  });

  it('auto-fixes prose attribute values but not URLs, ids or classes', () => {
    const code: string = '<img alt="a colour" title="the flavour" src="colour.png" class="colour-x">';
    // Only alt and title are prose; src and class are left alone.
    expect(fix(code)).toBe('<img alt="a color" title="the flavor" src="colour.png" class="colour-x">');
  });

  it('does not touch script/style contents or tag names', () => {
    // Tag names and attribute keys are structural, never prose.
    expect(lint('<colour-picker data-colour="x"></colour-picker>')).toEqual([]);
  });

  it('enforces British when the dialect option is set', () => {
    expect(fix('<p>The color</p>', { dialect: 'british' })).toBe('<p>The colour</p>');
  });

  it('respects the comments toggle for text and comments', () => {
    expect(lint('<p>colour</p><!-- colour -->', { comments: false })).toEqual([]);
  });

  it('respects the strings toggle for attribute values', () => {
    expect(lint('<img alt="colour">', { strings: false })).toEqual([]);
  });
});
