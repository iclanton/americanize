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
    // This tool deals in British spellings as data (the override table, VarCon parsing), so
    // opt out of our own spelling rule here.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'dialect/consistent-spelling': 'off'
    }
  }
];
