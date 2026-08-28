# americanize

A [Rush](https://rushjs.io/) monorepo of TypeScript projects, built with
[Heft](https://heft.rushstack.io/), that keeps a codebase writing American English.

It ships two things:

- **`@americanize/british-american-spellings`** — a reviewable table of British → American
  word spellings, plus small case-preserving lookup helpers.
- **`eslint-plugin-americanize`** — an ESLint rule that flags British (Commonwealth)
  spellings in identifiers, comments and strings and steers them to the American spelling.
  It is the American counterpart to
  [`eslint-plugin-communist-spelling`](https://github.com/dprgarner/eslint-plugin-communist-spelling).

## Layout

| Project                                    | Role                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `libraries/british-american-spellings`     | The spelling table (`BRITISH_TO_AMERICAN`) and its lookup helpers.        |
| `tools/eslint-plugin-americanize`          | The `american-spelling` ESLint rule. Depends on the spellings library.   |
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
`compromise`, …) are deliberately absent.

```ts
import {
  getAmericanSpelling,
  findBritishSpellings
} from '@americanize/british-american-spellings';

getAmericanSpelling('Colour'); // 'Color'  (casing preserved)
getAmericanSpelling('color'); // undefined (already American)

findBritishSpellings('favouriteColour');
// [{ british: 'favourite', american: 'favorite', word: 'favourite', index: 0 },
//  { british: 'colour',    american: 'Color',    word: 'Colour',    index: 9 }]
```

`findBritishSpellings` splits `camelCase`, `snake_case`, `kebab-case`, `SCREAMING_CASE`,
acronym boundaries and plain prose, which is what lets one rule cover identifiers, comments
and strings alike.

## The ESLint rule

Register the plugin in a flat config and enable `americanize/american-spelling`:

```js
// eslint.config.js
const americanize = require('eslint-plugin-americanize');

module.exports = [
  {
    plugins: { americanize },
    rules: {
      'americanize/american-spelling': [
        'error',
        {
          identifiers: true, // variable, function, class and member names
          comments: true, //    line and block comments
          strings: true, //     string literals and template strings
          allow: [] //          British spellings to leave alone (e.g. a third-party API)
        }
      ]
    }
  }
];
```

or spread the bundled config:

```js
const americanize = require('eslint-plugin-americanize');
module.exports = [{ plugins: { americanize }, ...americanize.configs.recommended }];
```

### What gets fixed

- **Comments** are **auto-fixed** (`--fix`), preserving the original casing.
- **Strings** offer an editor **suggestion** rather than an automatic fix, because rewriting
  a string changes program data.
- **Identifiers** are **reported only**. A rename the rule cannot follow to every reference
  would break the build, so it flags the name and leaves the rename to you. Only binding
  positions (declarations, parameters, and members you define) are checked — never a
  property read or an imported name you cannot rename.
