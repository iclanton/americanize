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

// Enforce Canadian spellings (British with American `-ize` endings).
const canadian: Linter.Config = {
  rules: { 'dialect/consistent-spelling': ['warn', { dialect: 'canadian' }] }
};

// Enforce Australian spellings (close to British).
const australian: Linter.Config = {
  rules: { 'dialect/consistent-spelling': ['warn', { dialect: 'australian' }] }
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
 * or spread `dialect.configs.recommended` (American), `dialect.configs.british`,
 * `dialect.configs.canadian` or `dialect.configs.australian` alongside a `plugins` entry. Pass
 * `{ dialect: 'british' }` (or `'canadian'`/`'australian'`) to the rule directly for the same
 * effect.
 */
const plugin: ESLint.Plugin = {
  meta: {
    name,
    version
  },
  rules,
  configs: { recommended, british, canadian, australian }
};

export = plugin;
