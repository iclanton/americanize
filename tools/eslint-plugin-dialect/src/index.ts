/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import type { ESLint, Linter, Rule } from 'eslint';

import { consistentSpellingRule } from './consistentSpellingRule';
import { name, version } from '../package.json';

const rules: Record<string, Rule.RuleModule> = {
  'consistent-spelling': consistentSpellingRule
};

const recommended: Linter.Config = {
  rules: { 'dialect/consistent-spelling': 'warn' }
};

// The same rule, configured the other way: enforce British spellings.
const british: Linter.Config = {
  rules: { 'dialect/consistent-spelling': ['warn', { dialect: 'british' }] }
};

/**
 * The `eslint-plugin-dialect` plugin object.
 *
 * Register it in a flat config and enable the rule as `dialect/consistent-spelling`:
 *
 * ```js
 * const dialect = require('eslint-plugin-dialect');
 * module.exports = [
 *   { plugins: { dialect }, rules: { 'dialect/consistent-spelling': 'warn' } }
 * ];
 * ```
 *
 * or spread `dialect.configs.recommended` (American) or `dialect.configs.british` alongside a
 * `plugins` entry. Pass `{ dialect: 'british' }` to the rule directly for the same effect.
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
