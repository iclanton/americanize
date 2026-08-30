# Change Log - @americanize/british-american-spellings

This log was last generated on Sun, 30 Aug 2026 06:53:20 GMT and should not be manually modified.

## 0.2.0
Sun, 30 Aug 2026 06:53:20 GMT

### Minor changes

- Now ships CommonJS, ES module (browser-ready) and type-declaration builds, selected automatically through the package `exports` map, and lets you deep-import individual modules under a stable `lib/*` subpath, e.g. `import { AMERICAN_TO_BRITISH } from '@americanize/british-american-spellings/lib/britishAmericanSpellings'`.
- Regenerate the spelling table from the VarCon dataset (Kevin Atkinson's SCOWL / English Speller Database), expanding it from ~1,379 to ~5,200 curated entries. The generator now lives in the @americanize/spelling-data-generator tool (TypeScript, using @rushstack/node-core-library); it pins the source by content hash, filters to common/verified entries, and applies the ambiguous-word overrides. Adds NOTICE.md attribution.

### Patches

- Add repository, homepage and bugs links, an MIT license file, and license/author metadata.
- Track the public API surface with API Extractor (report in etc/) and ship a rolled-up type-declaration file; the package `types` now resolve to it. Mark the ambiguous-word API (`AMBIGUOUS_AMERICAN_SPELLINGS` and the `includeAmbiguous` option) as `@beta`.
- Slim the published package down to just its build output: a `files` allowlist keeps development files (coverage, temp, src, .rush) out of the tarball.
- Roughly double the throughput of `findNonPreferredSpellings` by walking words inline instead of building an intermediate token array and re-resolving the lookup table per word.

## 0.1.0
Fri, 28 Aug 2026 08:05:44 GMT

### Minor changes

- Initial release.

