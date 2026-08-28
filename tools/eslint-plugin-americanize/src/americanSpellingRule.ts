/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import type { Rule } from 'eslint';
import type { Identifier, Literal, Position, PrivateIdentifier, TemplateElement } from 'estree';

import { findBritishSpellings } from '@americanize/british-american-spellings';
import type { ISpellingMatch } from '@americanize/british-american-spellings';

/** Options accepted by the `american-spelling` rule. */
export interface IAmericanSpellingOptions {
  /** Check identifiers (variable, function, class and member names). Defaults to `true`. */
  readonly identifiers: boolean;
  /** Check `//` and block comments. Defaults to `true`. */
  readonly comments: boolean;
  /** Check string literals and template strings. Defaults to `true`. */
  readonly strings: boolean;
  /** British spellings to leave alone, lower-cased (e.g. a third-party API you cannot rename). */
  readonly allow: readonly string[];
}

const DEFAULT_OPTIONS: IAmericanSpellingOptions = {
  identifiers: true,
  comments: true,
  strings: true,
  allow: []
};

function resolveOptions(raw: unknown): IAmericanSpellingOptions {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_OPTIONS;
  }

  const provided: Partial<IAmericanSpellingOptions> = raw as Partial<IAmericanSpellingOptions>;
  const allow: readonly string[] = (provided.allow ?? DEFAULT_OPTIONS.allow).map((word: string): string =>
    word.toLowerCase()
  );

  return {
    identifiers: provided.identifiers ?? DEFAULT_OPTIONS.identifiers,
    comments: provided.comments ?? DEFAULT_OPTIONS.comments,
    strings: provided.strings ?? DEFAULT_OPTIONS.strings,
    allow
  };
}

/**
 * The `american-spelling` rule: flags British (Commonwealth) spellings in identifiers,
 * comments and string literals and steers them to the American spelling.
 *
 * Comments are auto-fixable; strings offer an editor suggestion; identifiers are reported
 * only, because a rename that the rule cannot follow to every reference would break the
 * build.
 */
export const americanSpellingRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce American English spellings in identifiers, comments and strings.',
      recommended: true
    },
    fixable: 'code',
    hasSuggestions: true,
    messages: {
      useAmerican: "Prefer the American spelling '{{american}}' over the British '{{british}}'.",
      replaceWith: "Replace '{{british}}' with '{{american}}'."
    },
    schema: [
      {
        type: 'object',
        properties: {
          identifiers: { type: 'boolean' },
          comments: { type: 'boolean' },
          strings: { type: 'boolean' },
          allow: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    const options: IAmericanSpellingOptions = resolveOptions(context.options[0]);
    const allowed: ReadonlySet<string> = new Set(options.allow);
    const { sourceCode } = context;

    function relevantMatches(text: string): ISpellingMatch[] {
      return findBritishSpellings(text).filter(
        (match: ISpellingMatch): boolean => !allowed.has(match.british)
      );
    }

    // Report every British spelling inside the source span [start, end). Reading the span
    // straight from the source text keeps match offsets aligned with the file regardless of
    // whether the span is a comment, a quoted string or a template chunk. When `fixable` is
    // true the fix is applied automatically; otherwise it is offered as a suggestion.
    function reportSpan(start: number, end: number, fixable: boolean): void {
      const text: string = sourceCode.getText().slice(start, end);

      for (const match of relevantMatches(text)) {
        const { index, word, american } = match;
        const matchStart: number = start + index;
        const matchEnd: number = matchStart + word.length;
        const loc: { start: Position; end: Position } = {
          start: sourceCode.getLocFromIndex(matchStart),
          end: sourceCode.getLocFromIndex(matchEnd)
        };
        const data: Record<string, string> = { british: word, american };
        const applyFix: (fixer: Rule.RuleFixer) => Rule.Fix = (fixer: Rule.RuleFixer): Rule.Fix =>
          fixer.replaceTextRange([matchStart, matchEnd], american);

        if (fixable) {
          context.report({ loc, messageId: 'useAmerican', data, fix: applyFix });
        } else {
          context.report({
            loc,
            messageId: 'useAmerican',
            data,
            suggest: [{ messageId: 'replaceWith', data, fix: applyFix }]
          });
        }
      }
    }

    // Identifiers are report-only. The declaration and each reference are separate AST
    // nodes, so a text-range fix here would rename one occurrence and silently break the
    // rest; leave the rename to the developer.
    function reportIdentifier(node: Identifier | PrivateIdentifier): void {
      const start: number = node.range?.[0] ?? 0;
      const text: string = node.name;

      for (const match of relevantMatches(text)) {
        const { index, word, american } = match;
        const matchStart: number = start + index;
        const matchEnd: number = matchStart + word.length;

        context.report({
          loc: {
            start: sourceCode.getLocFromIndex(matchStart),
            end: sourceCode.getLocFromIndex(matchEnd)
          },
          messageId: 'useAmerican',
          data: { british: word, american }
        });
      }
    }

    const listener: Rule.RuleListener = {};

    if (options.comments) {
      listener.Program = (): void => {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.range !== undefined) {
            reportSpan(comment.range[0], comment.range[1], true);
          }
        }
      };
    }

    if (options.strings) {
      listener.Literal = (node: Rule.Node): void => {
        const literal: Literal = node as Literal;
        if (typeof literal.value === 'string' && literal.range !== undefined) {
          reportSpan(literal.range[0], literal.range[1], false);
        }
      };

      listener.TemplateElement = (node: Rule.Node): void => {
        const element: TemplateElement = node as unknown as TemplateElement;
        if (element.range !== undefined) {
          reportSpan(element.range[0], element.range[1], false);
        }
      };
    }

    if (options.identifiers) {
      listener.Identifier = (node: Rule.Node): void => {
        if (isBindingIdentifier(node)) {
          reportIdentifier(node as Identifier);
        }
      };

      listener.PrivateIdentifier = (node: Rule.Node): void => {
        reportIdentifier(node as unknown as PrivateIdentifier);
      };
    }

    return listener;
  }
};

// A binding position is one where this codebase chooses the name: a declaration, a
// parameter, or a non-computed member we define. Property *reads* and imported names are
// excluded so the rule never fires on an API it cannot rename.
function isBindingIdentifier(node: Rule.Node): boolean {
  const parent: Rule.Node | undefined = node.parent as Rule.Node | undefined;
  if (parent === undefined) {
    return false;
  }

  if (parent.type === 'VariableDeclarator') {
    return parent.id === node;
  }

  if (
    parent.type === 'FunctionDeclaration' ||
    parent.type === 'FunctionExpression' ||
    parent.type === 'ArrowFunctionExpression'
  ) {
    return isFunctionNameOrParam(parent, node);
  }

  if (parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') {
    return parent.id === node;
  }

  if (parent.type === 'Property') {
    return parent.key === node && !parent.computed;
  }

  if (parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition') {
    return parent.key === node && !parent.computed;
  }

  return false;
}

function isFunctionNameOrParam(parent: Rule.Node, node: Rule.Node): boolean {
  if ('id' in parent && parent.id === node) {
    return true;
  }

  return 'params' in parent && parent.params.some((param): boolean => param === node);
}
