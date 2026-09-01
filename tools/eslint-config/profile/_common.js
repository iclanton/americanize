const { expandNamingConventionSelectors } = require('@rushstack/eslint-config/flat/profile/_macros');
const { commonNamingConventionSelectors } = require('@rushstack/eslint-config/flat/profile/_common');
const rushstackEslintPlugin = require('@rushstack/eslint-plugin');
const importEslintPlugin = require('eslint-plugin-import');
const headersEslintPlugin = require('eslint-plugin-headers');
const cssEslintPlugin = require('@eslint/css');
const yamlEslintParser = require('yaml-eslint-parser');
const htmlEslintPlugin = require('@html-eslint/eslint-plugin');
const markdownEslintPlugin = require('@eslint/markdown');
const jsonEslintPlugin = require('@eslint/json');

const nodeImportResolverPath = require.resolve('eslint-import-resolver-node');

// Dogfood our own spelling rule. `eslint-plugin-dialect` is consumed from the registry (see
// its `decoupledLocalDependencies` entry in rush.json) rather than as a workspace link, which
// keeps it out of this repo's build graph and always available as a prebuilt package.
const dialectEslintPlugin = require('eslint-plugin-dialect');

// Async functions/methods must end in `Async`. The @typescript-eslint `method`
// selector only matches class/object methods, so free functions (`function`)
// and async arrow functions assigned to a variable (`variable`) need their own
// block. Those selectors do NOT support the `private` modifier, so this block
// can't use `enforceLeadingUnderscoreWhenPrivate` (which injects `private` and
// would fail the rule's schema); the custom regex and filter are shared.
const asyncNameCustom = { regex: '^_?[a-zA-Z]\\w*Async$', match: true };
const asyncNameFilter = {
  regex: [
    // Names chosen by a host framework rather than by us: Heft calls `apply` on a
    // plugin, and ts-command-line calls `onExecute`.
    '^onExecute$'
  ]
    .map((x) => `(${x})`)
    .join('|'),
  match: false
};

module.exports = {
  localCommonConfig: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      plugins: {
        '@rushstack': rushstackEslintPlugin,
        import: importEslintPlugin,
        headers: headersEslintPlugin,
        dialect: dialectEslintPlugin
      },
      settings: {
        'import/resolver': nodeImportResolverPath
      },
      rules: {
        // Enforce American spellings across the repo via our own plugin.
        'dialect/consistent-spelling': 'warn',

        // Rationale: Backslashes are platform-specific and will cause breaks on non-Windows
        // platforms.
        '@rushstack/no-backslash-imports': 'error',
        // Rationale: Avoid consuming dependencies which would not otherwise be present when
        // the package is published.
        '@rushstack/no-external-local-imports': 'error',
        '@rushstack/no-transitive-dependency-imports': 'error',
        '@rushstack/normalized-imports': 'error',

        '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false, checkThenables: true }],
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/no-unnecessary-condition': 'warn',
        '@typescript-eslint/prefer-nullish-coalescing': 'warn',
        '@typescript-eslint/prefer-optional-chain': 'warn',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'error',

        'no-redeclare': 'off',
        '@typescript-eslint/no-redeclare': 'error',

        // Rationale: Can easily cause developer confusion.
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': 'warn',

        // Rationale: Catches a common coding mistake where a dependency is taken on a package or
        // module that is not available once the package is published.
        'import/no-extraneous-dependencies': ['error', { devDependencies: true, peerDependencies: true }],

        // Rationale: Use of `== null` comparisons is common-place
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        curly: ['error', 'all'],

        // Rationale: Consistent use of function declarations that allow for arrow functions.
        'func-style': ['warn', 'declaration', { allowArrowFunctions: true }],

        // Rationale: Loosen the rules for unused expressions to allow for ternary operators and
        // short circuits, which are widely used
        'no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],

        // Rationale: Use of `void` to explicitly indicate that a floating promise is expected
        // and allowed.
        'no-void': ['error', { allowAsStatement: true }],

        // Prefer @rushstack/terminal
        'no-console': ['warn'],
        'no-throw-literal': 'error',
        'prefer-const': 'error',

        // Rationale: Different implementations of `parseInt` may have different behavior when the
        // radix is not specified. We should always specify the radix.
        radix: 'error',

        // Rationale: Including the `type` annotation in the import statement for imports
        // only used as types prevents the import from being emitted in the compiled output.
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            disallowTypeAnnotations: false,
            fixStyle: 'inline-type-imports'
          }
        ],

        // Rationale: If all imports in an import statement are only used as types,
        // then the import statement should be omitted in the compiled JS output.
        '@typescript-eslint/no-import-type-side-effects': 'error',

        'headers/header-format': [
          'error',
          {
            source: 'string',
            style: 'jsdoc',
            // Emit a single-line `/*! ... */` legal banner: the `!` marks it as a
            // license comment the minifier preserves (and extracts to a
            // `*.LICENSE.txt`) instead of stripping it.
            blockPrefix: '! ',
            linePrefix: '',
            blockSuffix: ' ',
            trailingNewlines: 2,
            content: 'Copyright (c) Ian Clanton-Thuon. All rights reserved.'
          }
        ],

        '@typescript-eslint/naming-convention': [
          'warn',
          ...expandNamingConventionSelectors([
            ...commonNamingConventionSelectors,
            {
              selectors: ['method'],
              modifiers: ['async'],
              enforceLeadingUnderscoreWhenPrivate: true,

              format: null,
              custom: asyncNameCustom,
              leadingUnderscore: 'allow',

              filter: asyncNameFilter
            },
            {
              selectors: ['function', 'variable'],
              modifiers: ['async'],

              format: null,
              custom: asyncNameCustom,
              leadingUnderscore: 'allow',

              filter: asyncNameFilter
            }
          ])
        ],

        // Require `node:` protocol for imports of Node.js built-in modules
        'import/enforce-node-protocol-usage': ['warn', 'always'],

        // Group imports in the following way:
        // 1. Built-in modules (fs, path, etc.)
        // 2. External modules (react, azure-devops-extension-sdk, etc.)
        //    a. `@americanize` scoped packages
        // 3. Internal modules (and other types: parent, sibling, index)
        'import/order': [
          'warn',
          {
            // This option ensures that the @americanize packages end up in their own group
            distinctGroup: true,
            pathGroups: [
              {
                pattern: '@americanize/**',
                group: 'external',
                position: 'after'
              }
            ],
            // Ensure the @americanize packages are grouped with other external packages. By
            // default this option includes 'external'
            pathGroupsExcludedImportTypes: ['builtin', 'object'],
            groups: [
              'builtin',
              'external'
              // And then everything else (internal, parent, sibling, index)
            ],
            'newlines-between': 'always'
          }
        ]
      }
    },
    {
      files: ['**/*.json', '**/*.resjson'],
      // Skip machine-owned or schema-fixed files whose keys you cannot rename.
      ignores: ['**/package.json', '**/tsconfig*.json'],
      language: 'json/json',
      plugins: { json: jsonEslintPlugin, dialect: dialectEslintPlugin },
      rules: { 'dialect/consistent-spelling': 'warn' }
    },
    {
      files: ['**/*.md'],
      language: 'markdown/gfm',
      plugins: { markdown: markdownEslintPlugin, dialect: dialectEslintPlugin },
      rules: { 'dialect/consistent-spelling': 'warn' }
    },
    {
      files: ['**/*.html'],
      language: 'html/html',
      plugins: { html: htmlEslintPlugin, dialect: dialectEslintPlugin },
      rules: { 'dialect/consistent-spelling': 'warn' }
    },
    {
      files: ['**/*.css'],
      language: 'css/css',
      plugins: { css: cssEslintPlugin, dialect: dialectEslintPlugin },
      rules: { 'dialect/consistent-spelling': 'warn' }
    },
    {
      files: ['**/*.scss'],
      language: 'css/css',
      languageOptions: { tolerant: true },
      plugins: { css: cssEslintPlugin, dialect: dialectEslintPlugin },
      rules: { 'dialect/consistent-spelling': 'warn' }
    },
    {
      files: ['**/*.yaml', '**/*.yml'],
      languageOptions: { parser: yamlEslintParser },
      plugins: { dialect: dialectEslintPlugin },
      rules: { 'dialect/consistent-spelling': 'warn' }
    },
    {
      files: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/__mocks__/**/*.ts',
        '**/__tests__/**/*.ts',
        '**/test/**/*.ts',
        '**/test/**/*.tsx'
      ],
      rules: {
        'import/order': 'off',
        // Test fixtures deliberately contain British spellings as inputs.
        'dialect/consistent-spelling': 'off'
      }
    }
  ]
};
