const nodeProfile = require('@rushstack/eslint-config/flat/profile/node-trusted-tool');
const friendlyLocalsMixin = require('@rushstack/eslint-config/flat/mixins/friendly-locals');
const tsdocMixin = require('@rushstack/eslint-config/flat/mixins/tsdoc');

const { localCommonConfig } = require('./_common');

module.exports = [
  ...nodeProfile,
  ...friendlyLocalsMixin,
  ...tsdocMixin,
  ...localCommonConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Rationale: Build tooling legitimately reports progress to the terminal, but
      // `console.log` is still discouraged in favour of a more specific level.
      'no-console': ['warn', { allow: ['debug', 'info', 'time', 'timeEnd', 'trace'] }]
    }
  }
];
