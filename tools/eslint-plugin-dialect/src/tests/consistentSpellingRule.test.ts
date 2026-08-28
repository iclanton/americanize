/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { RuleTester } from 'eslint';

import { consistentSpellingRule } from '../consistentSpellingRule';

const ruleTester: RuleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
});

// `RuleTester.run` registers its own `describe`/`it` blocks with the test framework, so it
// is called at module scope rather than nested inside a `describe`/`it` of our own.
ruleTester.run('consistent-spelling', consistentSpellingRule, {
  valid: [
    // Already American (the default dialect).
    'const color = 1;',
    '// set the color',
    "const message = 'the color is red';",
    // Words that stay `-ise` in American English must not be flagged.
    'function exercise() {}',
    "const promise = 'surprise';",
    // Respect the allow list (case-insensitively).
    { code: 'const colour = 1;', options: [{ allow: ['Colour'] }] },
    // Respect the per-category toggles.
    { code: 'const colour = 1;', options: [{ identifiers: false }] },
    { code: '// the colour', options: [{ comments: false }] },
    { code: "const s = 'colour';", options: [{ strings: false }] },
    // With the British dialect selected, British spellings are the valid ones.
    { code: 'const colour = 1;', options: [{ dialect: 'british' }] },
    { code: '// the colour', options: [{ dialect: 'british' }] }
  ],
  invalid: [
    // Identifiers are report-only: flagged, but never rewritten.
    {
      code: 'const colour = 1;',
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'colour', to: 'color', preferred: 'American', offending: 'British' }
        }
      ]
    },
    // camelCase is split, so each sub-word is judged on its own.
    {
      code: 'const favouriteColour = 1;',
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'favourite', to: 'favorite', preferred: 'American', offending: 'British' }
        },
        {
          messageId: 'usePreferred',
          data: { from: 'Colour', to: 'Color', preferred: 'American', offending: 'British' }
        }
      ]
    },
    // Line comments are auto-fixed.
    {
      code: '// set the colour here',
      output: '// set the color here',
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'colour', to: 'color', preferred: 'American', offending: 'British' }
        }
      ]
    },
    // Block/JSDoc comments too, preserving casing.
    {
      code: '/** The Colour of the pixel. */\nconst x = 1;',
      output: '/** The Color of the pixel. */\nconst x = 1;',
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'Colour', to: 'Color', preferred: 'American', offending: 'British' }
        }
      ]
    },
    // Strings are not auto-fixed, but offer a suggestion.
    {
      code: "const s = 'the colour is red';",
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'colour', to: 'color', preferred: 'American', offending: 'British' },
          suggestions: [{ messageId: 'replaceWith', output: "const s = 'the color is red';" }]
        }
      ]
    },
    // The British dialect enforces the other direction: an identifier is flagged...
    {
      code: 'const color = 1;',
      options: [{ dialect: 'british' }],
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'color', to: 'colour', preferred: 'British', offending: 'American' }
        }
      ]
    },
    // ...a comment is auto-fixed to the British spelling...
    {
      code: '// initialize the color',
      options: [{ dialect: 'british' }],
      output: '// initialise the colour',
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'initialize', to: 'initialise', preferred: 'British', offending: 'American' }
        },
        {
          messageId: 'usePreferred',
          data: { from: 'color', to: 'colour', preferred: 'British', offending: 'American' }
        }
      ]
    },
    // ...and a string offers a British suggestion.
    {
      code: 'const s = `please normalize`;',
      options: [{ dialect: 'british' }],
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'normalize', to: 'normalise', preferred: 'British', offending: 'American' },
          suggestions: [{ messageId: 'replaceWith', output: 'const s = `please normalise`;' }]
        }
      ]
    }
  ]
});
