# Change Log - eslint-plugin-dialect

This log was last generated on Tue, 01 Sep 2026 06:58:12 GMT and should not be manually modified.

## 0.4.0
Tue, 01 Sep 2026 06:58:12 GMT

### Minor changes

- Support linting CSS when paired with the `@eslint/css` language plugin: `/* */` comments and string values are checked like comments/strings (auto-fixed), and class/id selector names like identifiers (report-only). SCSS is supported best-effort in the parser's `tolerant` mode.
- Support linting HTML when paired with the `@html-eslint/eslint-plugin` language plugin. Element text and `<!-- -->` comment bodies are checked like comments; prose attribute values (`alt`, `title`, `aria-*`) like strings (auto-fixed); and identifier attributes (`class`, `id`, `name`, `for`, ...) like identifiers (report-only). Tag names, URLs and `data-*` values are left alone.
- Support the JSONC and JSON5 languages from `@eslint/json`, including JSON5 unquoted keys and `//` / `/* */` comments (checked under the `comments` toggle). Fixes a crash when the rule ran under a JSON5 `language` (a JSON5 `Identifier` key collided with the JavaScript `Identifier` visitor).
- Support linting JSON (and RESJSON) when paired with the `@eslint/json` language plugin: string values are checked like string literals (auto-fixed) and object keys like identifiers (report-only), reusing the existing `strings`/`identifiers` options.
- Support linting Markdown prose when paired with the `@eslint/markdown` language plugin: prose text (paragraphs, headings, list items, link text) is checked like a comment and auto-fixed, while inline code, fenced code blocks and link URLs are left alone.
- Support linting YAML when paired with the `yaml-eslint-parser` parser (via `languageOptions.parser`): `#` comments and scalar values are checked like comments/strings (auto-fixed), and mapping keys like identifiers (report-only).

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

