/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import { RuleTester } from 'eslint';

import { americanSpellingRule } from '../americanSpellingRule';

const ruleTester: RuleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
});

// `RuleTester.run` registers its own `describe`/`it` blocks with the test framework, so it
// is called at module scope rather than nested inside a `describe`/`it` of our own.
ruleTester.run('american-spelling', americanSpellingRule, {
  valid: [
    // Already American.
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
    { code: "const s = 'colour';", options: [{ strings: false }] }
  ],
  invalid: [
    // Identifiers are report-only: flagged, but never rewritten.
    {
      code: 'const colour = 1;',
      output: null,
      errors: [{ messageId: 'useAmerican', data: { british: 'colour', american: 'color' } }]
    },
    // camelCase is split, so each sub-word is judged on its own.
    {
      code: 'const favouriteColour = 1;',
      output: null,
      errors: [
        { messageId: 'useAmerican', data: { british: 'favourite', american: 'favorite' } },
        { messageId: 'useAmerican', data: { british: 'Colour', american: 'Color' } }
      ]
    },
    // A function name and its parameter are both binding positions.
    {
      code: 'function initialise(behaviour) { return behaviour; }',
      output: null,
      errors: [
        { messageId: 'useAmerican', data: { british: 'initialise', american: 'initialize' } },
        { messageId: 'useAmerican', data: { british: 'behaviour', american: 'behavior' } }
      ]
    },
    // Line comments are auto-fixed.
    {
      code: '// set the colour here',
      output: '// set the color here',
      errors: [{ messageId: 'useAmerican', data: { british: 'colour', american: 'color' } }]
    },
    // Block/JSDoc comments too, preserving casing.
    {
      code: '/** The Colour of the pixel. */\nconst x = 1;',
      output: '/** The Color of the pixel. */\nconst x = 1;',
      errors: [{ messageId: 'useAmerican', data: { british: 'Colour', american: 'Color' } }]
    },
    // Strings are not auto-fixed, but offer a suggestion.
    {
      code: "const s = 'the colour is red';",
      output: null,
      errors: [
        {
          messageId: 'useAmerican',
          data: { british: 'colour', american: 'color' },
          suggestions: [{ messageId: 'replaceWith', output: "const s = 'the color is red';" }]
        }
      ]
    },
    // Template strings are handled the same way as quoted strings.
    {
      code: 'const s = `please initialise`;',
      output: null,
      errors: [
        {
          messageId: 'useAmerican',
          data: { british: 'initialise', american: 'initialize' },
          suggestions: [{ messageId: 'replaceWith', output: 'const s = `please initialize`;' }]
        }
      ]
    }
  ]
});
