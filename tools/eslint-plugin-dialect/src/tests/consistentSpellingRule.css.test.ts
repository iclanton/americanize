/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { Linter } from 'eslint';
import type { ESLint } from 'eslint';

import { consistentSpellingRule } from '../consistentSpellingRule';

// `@eslint/css` ships as an ES module only, but these tests compile to CommonJS (Jest runs the
// lib-commonjs output). A literal `import()` would be downleveled to `require()` and throw, so
// load it through a runtime dynamic import that survives compilation.
// eslint-disable-next-line no-new-func -- the only reliable way to import an ESM-only package from a CommonJS bundle
const importEsm: (specifier: string) => Promise<{ default: ESLint.Plugin }> = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<{ default: ESLint.Plugin }>;

const dialectPlugin: ESLint.Plugin = {
  rules: { 'consistent-spelling': consistentSpellingRule }
};

let cssPlugin: ESLint.Plugin;
let linter: Linter;

beforeAll(async () => {
  cssPlugin = (await importEsm('@eslint/css')).default;
  linter = new Linter();
});

interface IRuleOptions {
  readonly dialect?: 'american' | 'british';
  readonly comments?: boolean;
  readonly strings?: boolean;
  readonly identifiers?: boolean;
}

function makeConfig(options: IRuleOptions, tolerant: boolean): Linter.Config {
  return {
    files: ['**/*.css', '**/*.scss'],
    plugins: { dialect: dialectPlugin, css: cssPlugin },
    language: 'css/css',
    languageOptions: { tolerant },
    rules: { 'dialect/consistent-spelling': ['error', options] }
  };
}

function lint(code: string, options: IRuleOptions = {}): Linter.LintMessage[] {
  return linter.verify(code, makeConfig(options, false), 'file.css');
}

function fix(code: string, options: IRuleOptions = {}): string {
  return linter.verifyAndFix(code, makeConfig(options, false), 'file.css').output;
}

function lintScss(code: string): Linter.LintMessage[] {
  return linter.verify(code, makeConfig({}, true), 'file.scss');
}

describe('CSS support (@eslint/css)', () => {
  it('leaves wholly American CSS alone', () => {
    expect(lint('/* a color note */\n.lightColor { content: "the color"; }')).toEqual([]);
  });

  it('auto-fixes comments and string values', () => {
    const code: string = '/* a colour note */\n.a::before { content: "the flavour"; }';
    const messages: Linter.LintMessage[] = lint(code);

    expect(messages).toHaveLength(2);
    expect(fix(code)).toBe('/* a color note */\n.a::before { content: "the flavor"; }');
  });

  it('flags class and id selector names but never rewrites them', () => {
    const code: string = '.lightColour {}\n#mainColour {}';
    const messages: Linter.LintMessage[] = lint(code);

    // Both selector names are flagged (report-only); neither is auto-fixed.
    expect(messages).toHaveLength(2);
    expect(fix(code)).toBe(code);
  });

  it('leaves value keywords, property names and URLs alone', () => {
    // `colour` here is a value keyword, a custom-property name and a URL - none are checked.
    expect(lint('.a { color: colour; --brand-colour: 1; background: url(colour.png); }')).toEqual([]);
  });

  it('enforces British when the dialect option is set', () => {
    expect(fix('.a { content: "the color"; }', { dialect: 'british' })).toBe('.a { content: "the colour"; }');
  });

  it('respects the comments and strings toggles', () => {
    expect(lint('/* colour */\n.a { content: "colour"; }', { comments: false, strings: false })).toEqual([]);
  });

  it('respects the identifiers toggle for selectors', () => {
    expect(lint('.lightColour {}', { identifiers: false })).toEqual([]);
  });

  it('handles SCSS best-effort in tolerant mode (selectors and strings)', () => {
    // `//` line comments, `$variables` and deep nesting are SCSS-only and only partly understood
    // by the CSS parser, but class selectors and string values are still flagged.
    const scss: string = '.parentColour { content: "the flavour"; }';
    const to: string[] = lintScss(scss)
      .map((message: Linter.LintMessage): RegExpMatchArray | null => message.message.match(/'(\w+)'/))
      .map((match: RegExpMatchArray | null): string => (match?.[1] ?? '').toLowerCase());

    // The class selector and the string value are both flagged.
    expect(to).toContain('color');
    expect(to).toContain('flavor');
  });
});
