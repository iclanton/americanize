# americanize

[![CI](https://github.com/iclanton/americanize/actions/workflows/ci.yml/badge.svg)](https://github.com/iclanton/americanize/actions/workflows/ci.yml)

A [Rush](https://rushjs.io/) monorepo of TypeScript projects, built with
[Heft](https://heft.rushstack.io/), that keeps a codebase writing a single English dialect —
American by default, or British.

It ships two things:

- **`@americanize/british-american-spellings`** — a reviewable table of British → American
  word spellings (and its inverse), plus small case-preserving lookup helpers that work in
  either direction.
- **`eslint-plugin-dialect`** — an ESLint rule that flags spellings of the wrong dialect
  in identifiers, comments and strings and steers them to the configured dialect. It is the
  American counterpart to
  [`eslint-plugin-communist-spelling`](https://github.com/dprgarner/eslint-plugin-communist-spelling).

## Layout

| Project                                    | Role                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `libraries/british-american-spellings`     | The spelling table (`BRITISH_TO_AMERICAN`) and its lookup helpers.        |
| `tools/eslint-plugin-dialect`          | The `consistent-spelling` ESLint rule. Depends on the spellings library.   |
| `tools/eslint-config`                      | The shared ESLint flat config used to lint this repo (`_common`, `node`).|
| `tools/local-build-rig`                    | The Heft `node` build/test rig every project extends.                    |

## Build & verify

```sh
# Install dependencies and generate the lockfile.
node common/scripts/install-run-rush.js update

# Build everything.
node common/scripts/install-run-rush.js build

# Build and run all unit tests.
node common/scripts/install-run-rush.js test
```

## The spelling table

`BRITISH_TO_AMERICAN` maps a lower-cased British spelling to its American form. Inflected
forms (`colour`/`colours`/`coloured`, `organise`/`organised`/`organisation`, …) are listed
explicitly, so a lookup is a single map read and the whole table is reviewable. The `-ise`
words that stay `-ise` in American English (`advertise`, `exercise`, `surprise`,
`compromise`, …) are deliberately absent. `AMERICAN_TO_BRITISH` is the inverse, for going the
other way.

```ts
import {
  getAmericanSpelling,
  getBritishSpelling,
  findBritishSpellings,
  findAmericanSpellings,
  findNonPreferredSpellings // the direction-agnostic core: findNonPreferredSpellings(text, 'american' | 'british')
} from '@americanize/british-american-spellings';

getAmericanSpelling('Colour'); // 'Color'  (casing preserved)
getAmericanSpelling('color'); // undefined (already American)
getBritishSpelling('Color'); //  'Colour'  (the other direction)

findBritishSpellings('favouriteColour');
// [{ from: 'favourite', to: 'favorite', word: 'favourite', index: 0 },
//  { from: 'colour',    to: 'Color',    word: 'Colour',    index: 9 }]
```

`findBritishSpellings` / `findAmericanSpellings` (and the direction-agnostic
`findNonPreferredSpellings`) split `camelCase`, `snake_case`, `kebab-case`, `SCREAMING_CASE`,
acronym boundaries and plain prose, which is what lets one rule cover identifiers, comments
and strings alike.

## The ESLint rule

Register the plugin in a flat config and enable `dialect/consistent-spelling`:

```js
// eslint.config.js
const dialect = require('eslint-plugin-dialect');

module.exports = [
  {
    plugins: { dialect },
    rules: {
      'dialect/consistent-spelling': [
        'error',
        {
          dialect: 'american', //   or 'british' to enforce British spellings instead
          identifiers: true, //     variable, function, class and member names
          comments: true, //        line and block comments
          strings: true, //         string literals and template strings
          includeAmbiguous: false, // when british, also flag program/disk/analog/dialog
          allow: [] //              spellings to leave alone (e.g. a third-party API)
        }
      ]
    }
  }
];
```

or spread a bundled config — `recommended` (American) or `british`:

```js
const dialect = require('eslint-plugin-dialect');
module.exports = [
  { plugins: { dialect }, ...dialect.configs.recommended } // American
  // { plugins: { dialect }, ...dialect.configs.british }  // British
];
```

### What gets fixed

- **Comments** are **auto-fixed** (`--fix`), preserving the original casing.
- **Strings** offer an editor **suggestion** rather than an automatic fix, because rewriting
  a string changes program data.
- **Identifiers** are **reported only**. A rename the rule cannot follow to every reference
  would break the build, so it flags the name and leaves the rename to you. Only binding
  positions (declarations, parameters, and members you define) are checked — never a
  property read or an imported name you cannot rename.

### Ambiguous spellings (British direction)

Some American spellings are accepted in British English too, especially in computing —
`program`, `disk`, `analog`, `dialog` (a *computer program*, a *hard disk* and a UI *dialog*
are spelled that way on both sides of the Atlantic). When enforcing British, these are left
alone by default. Set `includeAmbiguous: true` to steer them to `programme`, `disc`,
`analogue` and `dialogue` as well. The set is exported as `AMBIGUOUS_AMERICAN_SPELLINGS`.

