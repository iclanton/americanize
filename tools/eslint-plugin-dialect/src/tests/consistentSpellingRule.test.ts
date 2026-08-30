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
    { code: '// the colour', options: [{ dialect: 'british' }] },
    // Canadian keeps British -our/-re but uses American -ize endings.
    { code: 'const colour = 1;', options: [{ dialect: 'canadian' }] },
    { code: '// initialize the colour', options: [{ dialect: 'canadian' }] },
    // Australian is close to British, including -ise endings.
    { code: 'const colour = 1;', options: [{ dialect: 'australian' }] },
    { code: '// organise the colour', options: [{ dialect: 'australian' }] },
    // Ambiguous American spellings (program, disk, ...) are left alone under British by
    // default, since they are accepted in British English too.
    { code: '// the program writes to disk', options: [{ dialect: 'british' }] },
    { code: 'const dialog = 1;', options: [{ dialect: 'british' }] },
    // Import/require specifiers: the package name is never checked, even when it contains a
    // non-preferred spelling (e.g. `axe` -> `ax`, or a package literally named `colour-*`).
    "import { x } from 'axe-core';",
    "import { x } from 'colour-picker';",
    "const m = require('behaviour-lib');",
    "export { y } from '@scope/colour-utils';",
    // ...and the in-package file path is left alone when importPaths is off.
    { code: "import { x } from './colourPicker';", options: [{ importPaths: false }] }
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
    // Strings are auto-fixed.
    {
      code: "const s = 'the colour is red';",
      output: "const s = 'the color is red';",
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'colour', to: 'color', preferred: 'American', offending: 'British' }
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
    // ...and a template string is auto-fixed to the British spelling.
    {
      code: 'const s = `please normalize`;',
      options: [{ dialect: 'british' }],
      output: 'const s = `please normalise`;',
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'normalize', to: 'normalise', preferred: 'British', offending: 'American' }
        }
      ]
    },
    // includeAmbiguous opts the accepted-either-way spellings back in (British direction).
    {
      code: '// the program on disk',
      options: [{ dialect: 'british', includeAmbiguous: true }],
      output: '// the programme on disc',
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'program', to: 'programme', preferred: 'British', offending: 'American' }
        },
        {
          messageId: 'usePreferred',
          data: { from: 'disk', to: 'disc', preferred: 'British', offending: 'American' }
        }
      ]
    },
    // Canadian mixes both axes: a British -ise word and an American -or word are both fixed.
    {
      code: '// initialise the color',
      options: [{ dialect: 'canadian' }],
      output: '// initialize the colour',
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'initialise', to: 'initialize', preferred: 'Canadian', offending: 'non-Canadian' }
        },
        {
          messageId: 'usePreferred',
          data: { from: 'color', to: 'colour', preferred: 'Canadian', offending: 'non-Canadian' }
        }
      ]
    },
    // Australian follows British, so an American -ize word and -or word are steered across.
    {
      code: '// organize the color',
      options: [{ dialect: 'australian' }],
      output: '// organise the colour',
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'organize', to: 'organise', preferred: 'Australian', offending: 'non-Australian' }
        },
        {
          messageId: 'usePreferred',
          data: { from: 'color', to: 'colour', preferred: 'Australian', offending: 'non-Australian' }
        }
      ]
    },
    // The in-package file path of an import IS checked - report-only, since the file on disk
    // would also need renaming.
    {
      code: "import { x } from './colourPicker';",
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'colour', to: 'color', preferred: 'American', offending: 'British' }
        }
      ]
    },
    // A subpath after the package name is checked; the package name (`axe`) is not.
    {
      code: "import { x } from 'axe-core/behaviourUtils';",
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'behaviour', to: 'behavior', preferred: 'American', offending: 'British' }
        }
      ]
    },
    // Scoped-package subpaths too (the `@scope/pkg` part is skipped).
    {
      code: "import { x } from '@scope/pkg/colourUtils';",
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'colour', to: 'color', preferred: 'American', offending: 'British' }
        }
      ]
    },
    // require() file paths are checked the same way.
    {
      code: "const m = require('./colourUtils');",
      output: null,
      errors: [
        {
          messageId: 'usePreferred',
          data: { from: 'colour', to: 'color', preferred: 'American', offending: 'British' }
        }
      ]
    }
  ]
});
