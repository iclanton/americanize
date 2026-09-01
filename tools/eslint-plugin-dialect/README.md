# eslint-plugin-dialect

[![npm version](https://badge.fury.io/js/eslint-plugin-dialect.svg)](https://badge.fury.io/js/eslint-plugin-dialect)

An ESLint rule that enforces a single English dialect - **American** (default) or **British** - in identifiers, comments and strings, and steers offending words to the configured dialect. It was inspired by [`eslint-plugin-communist-spelling`](https://github.com/dprgarner/eslint-plugin-communist-spelling) and is backed by the reviewable table in [`@americanize/british-american-spellings`](https://www.npmjs.com/package/@americanize/british-american-spellings). Both plugins can enforce either dialect; the difference is scope - `eslint-plugin-dialect` also checks comments, strings and import file paths (and auto-fixes comments and strings), while `communist-spelling` focuses on identifiers (with finer identifier controls).

```ts
const favouriteColour = 1; // 👉 Prefer the American spelling 'favorite' over the British 'favourite'.
const favoriteColor = 1; //   👍
```

## Install

```sh
npm install --save-dev eslint-plugin-dialect
```

Requires ESLint 9+ (flat config).

## Usage

```js
// eslint.config.js
const dialect = require('eslint-plugin-dialect');

module.exports = [
  {
    plugins: { dialect },
    rules: {
      'dialect/consistent-spelling': 'error'
    }
  }
];
```

Or spread a bundled config - `recommended` (American) or `british`:

```js
const dialect = require('eslint-plugin-dialect');

module.exports = [
  { plugins: { dialect }, ...dialect.configs.recommended } // American
  // { plugins: { dialect }, ...dialect.configs.british }  // British
];
```

## Options

```js
'dialect/consistent-spelling': [
  'error',
  {
    dialect: 'american', //   'american' (default) or 'british'
    identifiers: true, //     check variable, function, class and member names
    comments: true, //        check line and block comments
    strings: true, //         check string literals and template strings
    importPaths: true, //     check the file-path part of import/require specifiers
    includeAmbiguous: false, // when british, also flag program/disk/analog/dialog
    allow: [] //              spellings to leave alone, e.g. ['licence', 'practise']
  }
]
```

| Option | Default | Description |
| --- | --- | --- |
| `dialect` | `'american'` | Which dialect to enforce. |
| `identifiers` | `true` | Check identifier names. |
| `comments` | `true` | Check `//` and block comments. |
| `strings` | `true` | Check string literals and template strings. |
| `importPaths` | `true` | Check the file-path portion of `import`/`require` specifiers (`./foo/colourBar`, `pkg/colourBar`). The **package name** is never checked - it belongs to the dependency, not you (so `import 'axe-core'` is never flagged). |
| `includeAmbiguous` | `false` | When enforcing British, also flag American spellings that are accepted in British English (`program`, `disk`, `analog`, `dialog`). No effect for American. |
| `allow` | `[]` | Spellings to leave alone (case-insensitive), e.g. a third-party API you cannot rename, or the noun/verb pairs (`licence`/`practise`) you would rather not touch. |

## What gets fixed

- **Comments** and **strings** are **auto-fixed** (`eslint --fix`), preserving the original casing.
- **Identifiers** and **import file paths** are **reported only**. A rename the rule cannot follow - to every reference, or to the file on disk - would break the build, so it flags the name and leaves the rename to you. For identifiers, only binding positions (declarations, parameters, and members you define) are checked - never a property read or an imported name. For imports, only the in-package file path is checked, never the package name.

`camelCase`, `snake_case`, `kebab-case` and `SCREAMING_CASE` are split into words, so `favouriteColour` flags both `favourite` and `Colour` independently.

## Linting JSON (and RESJSON)

The rule also works on JSON when you pair it with ESLint's official [`@eslint/json`](https://www.npmjs.com/package/@eslint/json) language plugin (install it alongside this one). Add a config block that selects the JSON language for the files you want to check:

```js
const dialect = require('eslint-plugin-dialect');
const json = require('@eslint/json');

module.exports = [
  {
    files: ['**/*.json', '**/*.resjson'],
    // Skip machine-owned or schema-fixed files whose keys you cannot rename.
    ignores: ['**/package.json', '**/tsconfig*.json'],
    language: 'json/json',
    plugins: { json, dialect },
    rules: { 'dialect/consistent-spelling': 'warn' }
  }
];
```

In JSON, the rule maps onto the same `identifiers` / `strings` toggles as in JavaScript:

- **String values** are treated like string literals - **auto-fixed**.
- **Object keys** are treated like identifiers - **reported only**, since a key is usually a contract other code depends on. Set `identifiers: false` to ignore keys entirely (handy for pure data files).

RESJSON is just JSON, so the same block covers it - point `files` at `**/*.resjson`. For JSON with comments and trailing commas use `language: 'json/jsonc'`, and for JSON5 use `language: 'json/json5'`; add the matching `files` glob (`**/*.jsonc`, `**/*.json5`). In JSONC and JSON5, `//` and `/* */` comments are checked under the `comments` toggle (auto-fixed, like a JavaScript comment). In JSON5, an unquoted key is checked like any other key. Because the JSON handling keys off the language, one set-up enforces a dialect across `.json`, `.jsonc`, `.json5` and `.resjson`.

## Linting Markdown

The rule also checks Markdown prose when paired with ESLint's official [`@eslint/markdown`](https://www.npmjs.com/package/@eslint/markdown) language plugin (install it alongside this one):

```js
const dialect = require('eslint-plugin-dialect');
const markdown = require('@eslint/markdown');

module.exports = [
  {
    files: ['**/*.md'],
    language: 'markdown/gfm',
    plugins: { markdown, dialect },
    rules: { 'dialect/consistent-spelling': 'warn' }
  }
];
```

Prose is treated as documentation text, mapped onto the **`comments`** toggle, and is **auto-fixed**. Only prose is checked: paragraphs, headings, list items, emphasis and link **text**. Inline code (`` `likeThis` ``), fenced code blocks and link **URLs** are left alone, because they are not prose nodes. Use `language: 'markdown/commonmark'` for strict CommonMark instead of GitHub-flavoured Markdown. (Note: auto-fixing a heading changes its generated anchor, so an in-page link to that heading may need updating.)

To *also* lint the code inside fenced ` ```js ` blocks with the JavaScript rules, add `@eslint/markdown`'s processor separately - that is orthogonal to the prose check above.

## The rule name

The rule is `dialect/consistent-spelling`, not `american-spelling`, because it enforces *either* dialect. `dialect: 'american'` is just the default.
