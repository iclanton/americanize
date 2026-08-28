/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import type { ESLint, Linter, Rule } from 'eslint';

import { americanSpellingRule } from './americanSpellingRule';
import { name, version } from '../package.json';

const rules: Record<string, Rule.RuleModule> = {
  'american-spelling': americanSpellingRule
};

const recommended: Linter.Config = {
  rules: { 'americanize/american-spelling': 'warn' }
};

// The same rule, configured the other way: enforce British spellings.
const british: Linter.Config = {
  rules: { 'americanize/american-spelling': ['warn', { dialect: 'british' }] }
};

/**
 * The `eslint-plugin-americanize` plugin object.
 *
 * Register it in a flat config and enable the rule as `americanize/american-spelling`:
 *
 * ```js
 * const americanize = require('eslint-plugin-americanize');
 * module.exports = [
 *   { plugins: { americanize }, rules: { 'americanize/american-spelling': 'warn' } }
 * ];
 * ```
 *
 * or spread `americanize.configs.recommended` (American) or `americanize.configs.british`
 * alongside a `plugins` entry. Pass `{ dialect: 'british' }` to the rule directly for the
 * same effect.
 */
const plugin: ESLint.Plugin = {
  meta: {
    name,
    version
  },
  rules,
  configs: { recommended, british }
};

export = plugin;
