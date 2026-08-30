# eslint-plugin-dialect

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

## The rule name

The rule is `dialect/consistent-spelling`, not `american-spelling`, because it enforces *either* dialect. `dialect: 'american'` is just the default.
