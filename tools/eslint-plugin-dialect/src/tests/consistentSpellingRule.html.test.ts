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
  readonly identifiers?: boolean;
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
    // alt and title are prose (fixed); src is a URL (ignored); class is an identifier (flagged
    // below, but never auto-fixed - so unchanged here).
    expect(fix(code)).toBe('<img alt="a color" title="the flavor" src="colour.png" class="colour-x">');
  });

  it('flags identifier attributes (class, id, ...) but never rewrites them', () => {
    // A CSS class name like `lightColour` is referenced from stylesheets/scripts, so it is
    // report-only, like a JavaScript identifier.
    const code: string = '<div class="lightColour" id="darkId" for="theColour"></div>';
    const messages: Linter.LintMessage[] = lint(code);

    // `lightColour` -> colour and `theColour` -> colour are flagged; `darkId` has no British word.
    expect(messages).toHaveLength(2);
    expect(fix(code)).toBe(code);
  });

  it('respects the identifiers toggle for identifier attributes', () => {
    expect(lint('<div class="lightColour"></div>', { identifiers: false })).toEqual([]);
  });

  it('does not touch URLs, data-* attributes or tag names', () => {
    // Tag names, URL attributes and data-* payloads are structural, never prose.
    expect(lint('<a href="colour.html" data-colour="x">ok</a>')).toEqual([]);
  });

  it.each(['american', 'british'] as const)('preserves encoded SVG metadata in %s mode', (dialect) => {
    const code: string = [
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/">',
      '<metadata><i:aipgf i:pgfEncoding="zstd/base64"><![CDATA[',
      'SMumJj01k3kw',
      '2greWEwj3Mmb',
      'SMomJj01k3kw',
      ']]></i:aipgf></metadata>',
      '</svg>'
    ].join('\n');

    expect(lint(code, { dialect })).toEqual([]);
    expect(fix(code, { dialect })).toBe(code);
  });

  it('still checks SVG prose, including CDATA, alongside metadata', () => {
    const code: string =
      '<svg><metadata><nested>colour</nested></metadata>' +
      '<title>colour</title><desc>neighbour</desc><text>flavour</text>' +
      '<text><![CDATA[colour]]></text><text aria-label="colour">ok</text><!-- colour --></svg>';

    expect(lint(code)).toHaveLength(6);
    expect(fix(code)).toBe(
      '<svg><metadata><nested>colour</nested></metadata>' +
        '<title>color</title><desc>neighbor</desc><text>flavor</text>' +
        '<text><![CDATA[color]]></text><text aria-label="color">ok</text><!-- color --></svg>'
    );
  });

  it('does not exclude metadata text outside SVG', () => {
    const code: string = '<metadata><span>colour</span></metadata>';

    expect(lint(code)).toHaveLength(1);
    expect(fix(code)).toBe('<metadata><span>color</span></metadata>');
  });

  it('enforces British when the dialect option is set', () => {
    expect(fix('<p>The color</p>', { dialect: 'british' })).toBe('<p>The colour</p>');
  });

  it('respects the comments toggle for text and comments', () => {
    expect(lint('<p>colour</p><!-- colour -->', { comments: false })).toEqual([]);
  });

  it('respects the strings toggle for prose attribute values', () => {
    expect(lint('<img alt="colour">', { strings: false })).toEqual([]);
  });
});
