module.exports = [
  ...require('@americanize/eslint-config/profile/node'),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname
      }
    }
  },
  {
    // This package is inherently about British spellings: its comments, examples and
    // identifiers (`isCapitalised`, `colourpicker`, ...) name them on purpose, so opt out of
    // our own spelling rule here.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'dialect/consistent-spelling': 'off'
    }
  }
];
