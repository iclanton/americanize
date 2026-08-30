# @americanize/british-american-spellings

[![npm version](https://badge.fury.io/js/%40americanize%2Fbritish-american-spellings.svg)](https://badge.fury.io/js/%40americanize%2Fbritish-american-spellings)

A reviewable table of British → American word spellings (and its inverse), plus Canadian and Australian variants, with small case-preserving lookup helpers that steer text toward any of the four dialects.

It is the data layer behind [`eslint-plugin-dialect`](https://www.npmjs.com/package/eslint-plugin-dialect), but it has no ESLint dependency and is useful on its own.

## Install

```sh
npm install @americanize/british-american-spellings
```

The package has **no runtime dependencies** and ships both CommonJS and ES module builds, so it works in Node (CommonJS or ESM) and in the browser.

### Browser / ESM usage

The `import` condition resolves to an ES module (`lib-esm/`), so any bundler (Vite, webpack, esbuild, Rollup, Parcel) can tree-shake and bundle it for the browser:

```ts
import { getAmericanSpelling, findBritishSpellings } from '@americanize/british-american-spellings';
```

The spelling table is loaded via a JSON import, which every major bundler handles natively. A **bundler is required** for browser use: the raw ESM files are not meant to be loaded directly over the network via `<script type="module">` (a native, un-bundled JSON import would need import attributes). In Node, `require(...)` and `import` both work out of the box.

### Package layout

The build is split by output kind - `lib-commonjs/` (CommonJS), `lib-esm/` (ES modules) and `lib-dts/` (type declarations) - wired together through the `exports` map, so the right one is picked automatically for `require`, `import` and type resolution. Individual modules can be deep-imported under a stable `lib/*` path, which routes to the correct variant folder:

```ts
import { AMERICAN_TO_BRITISH } from '@americanize/british-american-spellings/lib/britishAmericanSpellings';
```

## The tables

- **`BRITISH_TO_AMERICAN`** - `ReadonlyMap<string, string>` from a lower-cased British spelling to its American form. Inflected forms (`colour`/`colours`/`coloured`, `organise`/`organised`/`organisation`, …) are listed explicitly, so a lookup is a single map read and the whole table is reviewable. The `-ise` words that stay `-ise` in American English (`advertise`, `exercise`, `surprise`, `compromise`, …) are deliberately absent.
- **`AMERICAN_TO_BRITISH`** - the 1:1 inverse, for going the other way.
- **`AMBIGUOUS_AMERICAN_SPELLINGS`** - `ReadonlySet<string>` of American spellings that are also accepted in British English (`program`, `disk`, `analog`, `dialog` and their plurals - a *computer program*, a *hard disk* and a UI *dialog* are spelled that way on both sides).

### Where the data comes from

The table is generated from the **VarCon** dataset (Kevin Atkinson's SCOWL / English Speller Database) by the `@americanize/spelling-data-generator-heft-plugin` Heft plugin, which pins the source by content hash and keeps only the common, verified entries. See [`NOTICE.md`](./NOTICE.md) for attribution. The plugin contributes a `generate-dictionary` task to this project; run it to regenerate after the generator or the pinned dataset changes:

```sh
cd libraries/british-american-spellings && heft generate-dictionary
```

Pass `--varcon-file <path>` to generate from a local copy of the dataset instead of fetching it.

## Lookups

Every lookup ignores case and re-applies the input word's casing to the result.

```ts
import {
  getAmericanSpelling,
  getBritishSpelling,
  isBritishSpelling,
  isAmericanSpelling
} from '@americanize/british-american-spellings';

getAmericanSpelling('Colour'); // 'Color'  (casing preserved)
getAmericanSpelling('color'); //  undefined (already American)
getBritishSpelling('Color'); //   'Colour'

isBritishSpelling('colour'); //  true
isAmericanSpelling('color'); //  true
```

Or go through the direction-agnostic core with an explicit target dialect:

```ts
import { getPreferredSpelling, isNonPreferredSpelling } from '@americanize/british-american-spellings';

getPreferredSpelling('colour', 'american'); //  'color'
getPreferredSpelling('color', 'british'); //    'colour'
getPreferredSpelling('organise', 'canadian'); // 'organize' (British spelling, American -ize ending)
getPreferredSpelling('color', 'canadian'); //   'colour'
getPreferredSpelling('organize', 'australian'); // 'organise'
isNonPreferredSpelling('colour', 'american'); // true
```

### Canadian and Australian

Two more dialects sit on top of the British/American pair:

- **Canadian** is British spelling with American `-ize`/`-yze` endings (`colour` but `organize`, plus a few American forms such as `aluminum` and `airplane`).
- **Australian** tracks British closely, with a small handful of exceptions (`inquire`, `licorice`, `program`).

```ts
import { getCanadianSpelling, getAustralianSpelling } from '@americanize/british-american-spellings';

getCanadianSpelling('color'); //   'colour'  (keeps British -our)
getCanadianSpelling('organise'); // 'organize' (takes American -ize)
getAustralianSpelling('organize'); // 'organise' (follows British)
```

## Finding spellings in text

`findBritishSpellings` / `findAmericanSpellings` (and the direction-agnostic `findNonPreferredSpellings`) split a run of text into words - handling `camelCase`, `snake_case`, `kebab-case`, `SCREAMING_CASE`, acronym boundaries and plain prose - and return one `ISpellingMatch` per offending word, in order.

```ts
import { findBritishSpellings } from '@americanize/british-american-spellings';

findBritishSpellings('favouriteColour');
// [{ from: 'favourite', to: 'favorite', word: 'favourite', index: 0 },
//  { from: 'colour',    to: 'Color',    word: 'Colour',    index: 9 }]
```

Each match carries the offending spelling lower-cased (`from`), the preferred spelling cased to match the input (`to`), the exact matched substring (`word`) and its `index` in the text.

### Ambiguous spellings

When enforcing British, the `AMBIGUOUS_AMERICAN_SPELLINGS` are left alone by default. Pass `{ includeAmbiguous: true }` to steer them to their British forms too:

```ts
import { getBritishSpelling, findAmericanSpellings } from '@americanize/british-american-spellings';

getBritishSpelling('program'); //                          undefined (accepted in British too)
getBritishSpelling('program', { includeAmbiguous: true }); // 'programme'

findAmericanSpellings('the program on disk'); //                          []
findAmericanSpellings('the program on disk', { includeAmbiguous: true }); // program → programme, disk → disc
```

`includeAmbiguous` has no effect on the American direction.

## API

| Export | Description |
| --- | --- |
| `BRITISH_TO_AMERICAN`, `AMERICAN_TO_BRITISH` | The spelling tables (`ReadonlyMap<string, string>`). |
| `AMBIGUOUS_AMERICAN_SPELLINGS` | American spellings accepted in British English (`ReadonlySet<string>`). |
| `getPreferredSpelling(word, target, options?)` | Preferred spelling for `word`, or `undefined`. |
| `isNonPreferredSpelling(word, target, options?)` | Whether `word` has a distinct preferred form. |
| `findNonPreferredSpellings(text, target, options?)` | All offending words in `text`. |
| `getAmericanSpelling` / `getBritishSpelling` | Shorthands for the American/British directions. |
| `getCanadianSpelling` / `getAustralianSpelling` | Shorthands for the Canadian/Australian directions. |
| `isBritishSpelling` / `isAmericanSpelling` | Shorthands for the two directions. |
| `findBritishSpellings` / `findAmericanSpellings` | Shorthands for the American/British directions. |
| `findCanadianSpellings` / `findAustralianSpellings` | Shorthands for the Canadian/Australian directions. |
| `matchCase(source, replacement)` | Re-applies `source`'s casing onto `replacement`. |

`target` is `'american' | 'british' | 'canadian' | 'australian'` (`SpellingDialect`); `options` is `{ includeAmbiguous?: boolean }` (`ISpellingLookupOptions`). The `includeAmbiguous` option applies to the British direction only.
