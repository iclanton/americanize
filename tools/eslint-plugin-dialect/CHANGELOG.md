# Change Log - eslint-plugin-dialect

This log was last generated on Sun, 30 Aug 2026 06:53:20 GMT and should not be manually modified.

## 0.3.0
Sun, 30 Aug 2026 06:53:20 GMT

### Minor changes

- Expand the enforced spelling dictionary from ~1,379 to ~5,200 entries by updating the `@americanize/british-american-spellings` dependency (regenerated from the VarCon dataset), so the rule recognises many more British/American spelling differences.

### Patches

- Add repository, homepage and bugs links, an MIT license file, and license/author metadata.
- Correct the README comparison with eslint-plugin-communist-spelling: both plugins can enforce either dialect; the difference is scope.
- Skip allow-listed spellings inline while scanning rather than allocating a filtered copy of every match.

## 0.2.0
Fri, 28 Aug 2026 09:31:15 GMT

### Minor changes

- Stop flagging package names in import/require specifiers; add an `importPaths` option (default true) to check the in-package file path, report-only. Auto-fix string and template-string spellings so `eslint --fix` corrects them (previously suggestion-only).

## 0.1.0
Fri, 28 Aug 2026 08:05:44 GMT

### Minor changes

- Initial release.

