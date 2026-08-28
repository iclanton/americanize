module.exports = [
  ...require('@americanize/eslint-config/profile/node'),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname
      }
    }
  }
];
