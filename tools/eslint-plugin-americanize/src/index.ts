/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import type { ESLint, Linter, Rule } from 'eslint';

import { americanSpellingRule } from './americanSpellingRule';

const rules: Record<string, Rule.RuleModule> = {
  'american-spelling': americanSpellingRule
};

const recommended: Linter.Config = {
  rules: { 'americanize/american-spelling': 'error' }
};

/**
 * The `eslint-plugin-americanize` plugin object.
 *
 * Register it in a flat config and enable the rule as `americanize/american-spelling`:
 *
 * ```js
 * const americanize = require('eslint-plugin-americanize');
 * module.exports = [
 *   { plugins: { americanize }, rules: { 'americanize/american-spelling': 'error' } }
 * ];
 * ```
 *
 * or spread `americanize.configs.recommended` alongside a `plugins` entry.
 */
const plugin: ESLint.Plugin = {
  meta: {
    name: 'eslint-plugin-americanize',
    version: '1.0.0'
  },
  rules,
  configs: { recommended }
};

export = plugin;
