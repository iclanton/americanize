/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import type { Rule } from 'eslint';
import type { Identifier, Position, PrivateIdentifier, TemplateElement } from 'estree';
import type { CSSRuleVisitor, CSSSourceCode, CSSSyntaxElement } from '@eslint/css';
import type { JSONRuleVisitor } from '@eslint/json';
import type { MarkdownRuleVisitor } from '@eslint/markdown';
import type {
  Attribute as HtmlAttribute,
  AttributeValue as HtmlAttributeValue,
  CommentContent as HtmlCommentContent,
  Text as HtmlText
} from '@html-eslint/types';
import type { AST as YamlAST } from 'yaml-eslint-parser';

import { findNonPreferredSpellings } from '@americanize/british-american-spellings';
import type { SpellingDialect } from '@americanize/british-american-spellings';

// Momoa node shapes, derived from the visitor `@eslint/json` publishes rather than hand-rolled.
// The `Document` handler receives the document node, whose `tokens` are how JSONC/JSON5 comments
// are reached. Object keys and values (the `Member` handler's arguments) are a different shape,
// so `JsonCheckableNode` - what the string/identifier scan accepts - is derived from `Member`.
type JsonDocumentNode = Parameters<Required<JSONRuleVisitor>['Document']>[0];
type JsonMemberNode = Parameters<Required<JSONRuleVisitor>['Member']>[0];
type JsonCheckableNode = JsonMemberNode['name'] | JsonMemberNode['value'];

// `@html-eslint` (html/html) node types come from `@html-eslint/types`. The plugin publishes no
// visitor type (unlike `@eslint/json`/`@eslint/markdown`), and a visitor cannot be derived from
// its `AnyHTMLNode` union either: the underlying `es-html-parser` types each node's `type` as the
// whole `NodeTypes` enum rather than a per-node literal, so a discriminated mapped type collapses.
// Hence the small `IHtmlListener` below is declared by hand, using those published node types.
// Only user-facing text is checked: element `Text`, `<!-- -->` comment bodies (`CommentContent`)
// and a curated set of attribute values.
type HtmlValueNode = HtmlText | HtmlCommentContent | HtmlAttributeValue;

// HTML attribute names whose values are human-readable prose (auto-fixed, like a string).
const HTML_PROSE_ATTRIBUTES: ReadonlySet<string> = new Set<string>([
  'alt',
  'title',
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext'
]);

// HTML attribute names whose values are author-chosen identifiers or references to them (a CSS
// class, an element id, a form-control name, ...). These are checked but *reported only* - never
// auto-fixed - because renaming one would break the stylesheet, script or anchor that refers to
// it, exactly like a JavaScript identifier. Everything else (URLs, `data-*`, `type`, ...) is
// left alone entirely.
const HTML_IDENTIFIER_ATTRIBUTES: ReadonlySet<string> = new Set<string>([
  'class',
  'id',
  'name',
  'for',
  'form',
  'list',
  'headers',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant'
]);

/** Options accepted by the `consistent-spelling` rule. */
export interface IConsistentSpellingOptions {
  /** Which English to enforce: `'american'` (default), `'british'`, `'canadian'` or `'australian'`. */
  readonly dialect: SpellingDialect;
  /** Check identifiers (variable, function, class and member names; JSON object keys). Defaults to `true`. */
  readonly identifiers: boolean;
  /** Check `//` and block comments (Markdown prose). Defaults to `true`. */
  readonly comments: boolean;
  /** Check string literals and template strings (JSON string values). Defaults to `true`. */
  readonly strings: boolean;
  /**
   * Check the file-path portion of `import`/`require` specifiers - the part inside a package
   * (`./utils/myModule`, `pkg/subpath`). The package name itself is never checked, since it
   * is chosen by the dependency, not by this codebase. Defaults to `true`.
   */
  readonly importPaths: boolean;
  /**
   * When enforcing British, also flag American spellings that are widely accepted in British
   * English anyway (`program`, `disk`, `analog`, `dialog`). No effect for American. Defaults
   * to `false`.
   */
  readonly includeAmbiguous: boolean;
  /** Non-preferred spellings to leave alone, lower-cased (e.g. a third-party API you cannot rename). */
  readonly allow: readonly string[];
}

const DEFAULT_OPTIONS: IConsistentSpellingOptions = {
  dialect: 'american',
  identifiers: true,
  comments: true,
  strings: true,
  importPaths: true,
  includeAmbiguous: false,
  allow: []
};

// Human-readable name of each dialect, for the message the developer reads.
const DIALECT_LABEL: Record<SpellingDialect, string> = {
  american: 'American',
  british: 'British',
  canadian: 'Canadian',
  australian: 'Australian'
};

// The word being corrected can come from more than one dialect (a Canadian correction may
// replace an American, British or Australian spelling), so name the counterpart precisely only
// for the American/British pair and fall back to a generic label otherwise.
const OFFENDING_LABEL: Record<SpellingDialect, string> = {
  american: 'British',
  british: 'American',
  canadian: 'non-Canadian',
  australian: 'non-Australian'
};

function resolveOptions(raw: unknown): IConsistentSpellingOptions {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_OPTIONS;
  }

  const options: Partial<IConsistentSpellingOptions> = raw as Partial<IConsistentSpellingOptions>;
  const allow: readonly string[] = (options.allow ?? DEFAULT_OPTIONS.allow).map((word: string): string =>
    word.toLowerCase()
  );

  return {
    ...DEFAULT_OPTIONS,
    ...options,
    allow
  };
}

/**
 * The `consistent-spelling` rule: flags spellings of the wrong dialect in identifiers,
 * comments and string literals and steers them to the configured dialect (American by
 * default, or British/Canadian/Australian via the `dialect` option).
 *
 * Comments and strings are auto-fixable. Identifiers and import file paths are reported only,
 * because renaming one - without following it to every reference or to the file on disk -
 * would break the build.
 */
export const consistentSpellingRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce a single English dialect (American, British, Canadian or Australian) in identifiers, comments and strings.',
      recommended: true
    },
    fixable: 'code',
    messages: {
      usePreferred: "Prefer the {{preferred}} spelling '{{to}}' over the {{offending}} '{{from}}'."
    },
    schema: [
      {
        type: 'object',
        properties: {
          dialect: { enum: ['american', 'british', 'canadian', 'australian'] },
          identifiers: { type: 'boolean' },
          comments: { type: 'boolean' },
          strings: { type: 'boolean' },
          importPaths: { type: 'boolean' },
          includeAmbiguous: { type: 'boolean' },
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
    const {
      sourceCode,
      options: [unresolvedOptions]
    } = context;
    const { dialect, allow, comments, strings, identifiers, importPaths, includeAmbiguous } =
      resolveOptions(unresolvedOptions);
    const allowed: ReadonlySet<string> = new Set(allow);

    const preferredLabel: string = DIALECT_LABEL[dialect];
    const offendingLabel: string = OFFENDING_LABEL[dialect];

    // Report every non-preferred spelling inside the source span [start, end). Reading the
    // span straight from the source text keeps match offsets aligned with the file, whether
    // the span is a comment, a quoted string, an identifier or part of an import path. In
    // `'fix'` mode the correction is applied by `--fix`; in `'report'` mode it is only
    // flagged, for cases a text edit cannot safely resolve (an identifier used elsewhere, or
    // an import path whose file on disk would also need renaming).
    function reportSpan(start: number, end: number, mode: 'fix' | 'report'): void {
      const text: string = sourceCode.getText().slice(start, end);

      for (const match of findNonPreferredSpellings(text, dialect, { includeAmbiguous })) {
        if (allowed.has(match.from)) {
          continue;
        }

        const { index, word, to } = match;
        const matchStart: number = start + index;
        const matchEnd: number = matchStart + word.length;
        const loc: { start: Position; end: Position } = {
          start: sourceCode.getLocFromIndex(matchStart),
          end: sourceCode.getLocFromIndex(matchEnd)
        };
        const data: Record<string, string> = {
          from: word,
          to,
          preferred: preferredLabel,
          offending: offendingLabel
        };

        if (mode === 'fix') {
          context.report({
            loc,
            messageId: 'usePreferred',
            data,
            fix: (fixer: Rule.RuleFixer): Rule.Fix => fixer.replaceTextRange([matchStart, matchEnd], to)
          });
        } else {
          context.report({ loc, messageId: 'usePreferred', data });
        }
      }
    }

    const listener: Rule.RuleListener = {};

    if (comments) {
      listener.Program = (): void => {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.range !== undefined) {
            reportSpan(comment.range[0], comment.range[1], 'fix');
          }
        }
      };
    }

    if (strings || importPaths) {
      listener.Literal = (node: Rule.Node): void => {
        if (node.type !== 'Literal' || typeof node.value !== 'string' || node.range === undefined) {
          return;
        }

        const specifier: string | undefined = importedModuleSpecifier(node);
        if (specifier !== undefined) {
          // An import/require specifier. Never touch the package name; only the in-package
          // file path, and only when asked to - report-only, since the file must be renamed too.
          if (importPaths) {
            const fileStart: number = inPackageFilePathStart(specifier);
            if (fileStart < specifier.length) {
              const contentStart: number = node.range[0] + 1; // skip the opening quote
              reportSpan(contentStart + fileStart, contentStart + specifier.length, 'report');
            }
          }
          return;
        }

        if (strings) {
          const {
            range: [start, end]
          } = node;
          reportSpan(start, end, 'fix');
        }
      };
    }

    if (strings) {
      listener.TemplateElement = (element: TemplateElement): void => {
        const { range } = element;
        if (range !== undefined) {
          const [start, end] = range;
          reportSpan(start, end, 'fix');
        }
      };
    }

    if (identifiers) {
      listener.Identifier = (node: Identifier & Rule.Node): void => {
        const { range } = node;
        if (isBindingIdentifier(node) && range !== undefined) {
          const [start, end] = range;
          reportSpan(start, end, 'report');
        }
      };

      listener.PrivateIdentifier = (node: PrivateIdentifier & Rule.Node): void => {
        const { range } = node;
        if (range !== undefined) {
          const [start, end] = range;
          reportSpan(start, end, 'report');
        }
      };
    }

    // `@eslint/json` (Momoa) support. When a JSON `language` is active, ESLint dispatches these
    // node types instead of the ESTree ones above. Object keys map to the `identifiers` toggle
    // and are report-only, since a key rename is a data-contract change; string values map to
    // the `strings` toggle and are auto-fixable, exactly like their JavaScript counterparts. A
    // JSON5 unquoted key is an `Identifier` node (which also collides with the ESTree
    // `Identifier` visitor above - that one bails out when it sees a node with no ESTree parent).
    function scanJsonNode(node: JsonCheckableNode | undefined, mode: 'fix' | 'report'): void {
      if ((node?.type === 'String' || node?.type === 'Identifier') && node.range !== undefined) {
        reportSpan(node.range[0], node.range[1], mode);
      }
    }

    // `listener` is typed for the ESTree AST; register the Momoa keys through the visitor type
    // that `@eslint/json` publishes, so the node arguments are fully typed (`MemberNode`, ...).
    const jsonListener: JSONRuleVisitor = listener as unknown as JSONRuleVisitor;

    if (identifiers || strings) {
      jsonListener.Member = (node): void => {
        const { name, value } = node;
        if (identifiers) {
          scanJsonNode(name, 'report');
        }

        if (strings) {
          scanJsonNode(value, 'fix');
        }
      };
    }

    if (strings) {
      jsonListener.Element = (node): void => {
        scanJsonNode(node.value, 'fix');
      };
    }

    // JSONC/JSON5 comments are not traversable AST nodes and `@eslint/json` exposes no
    // `getAllComments()`, but they appear as `LineComment`/`BlockComment` entries in the token
    // stream. Scan them once at the document root, under the `comments` toggle (auto-fixable,
    // like a JavaScript comment). Plain JSON has no comment tokens, so this is a no-op there.
    if (comments) {
      jsonListener.Document = (): void => {
        const { tokens } = sourceCode.ast as unknown as JsonDocumentNode;
        for (const { type, range } of tokens ?? []) {
          if ((type === 'LineComment' || type === 'BlockComment') && range !== undefined) {
            reportSpan(range[0], range[1], 'fix');
          }
        }
      };
    }

    // `@eslint/markdown` (mdast) support, via the visitor type `@eslint/markdown` publishes.
    // Under a Markdown `language`, ESLint dispatches these node types instead. Prose is
    // documentation-style text, so it maps to the `comments` toggle and is auto-fixable;
    // visiting only `text` leaves skips code spans, fenced code blocks and link URLs.
    const markdownListener: MarkdownRuleVisitor = listener as MarkdownRuleVisitor;

    if (comments) {
      markdownListener.text = (node): void => {
        const start: number | undefined = node.position?.start.offset;
        const end: number | undefined = node.position?.end.offset;
        if (start !== undefined && end !== undefined) {
          reportSpan(start, end, 'fix');
        }
      };
    }

    // `@html-eslint` (html/html) support. Element text and `<!-- -->` comment bodies are prose
    // (the `comments` toggle); prose attribute values map to `strings` (auto-fixed) and
    // identifier attributes (class, id, ...) to `identifiers` (report-only). Tags, URLs and
    // other attributes are left alone. (The HTML root is also named `Program`, but the ESTree
    // `Program` handler above is a harmless no-op here - HTML exposes no ESLint-style comments,
    // so its `getAllComments()` is empty.)
    interface IHtmlListener {
      Text?: (node: HtmlText) => void;
      CommentContent?: (node: HtmlCommentContent) => void;
      Attribute?: (node: HtmlAttribute) => void;
    }
    const htmlListener: IHtmlListener = listener as IHtmlListener;

    function scanHtmlNode(node: HtmlValueNode | undefined, mode: 'fix' | 'report'): void {
      if (node?.range) {
        const {
          range: [start, end]
        } = node;
        reportSpan(start, end, mode);
      }
    }

    if (comments) {
      htmlListener.Text = (node): void => {
        scanHtmlNode(node, 'fix');
      };
      htmlListener.CommentContent = (node): void => {
        scanHtmlNode(node, 'fix');
      };
    }

    if (identifiers || strings) {
      htmlListener.Attribute = (node): void => {
        const {
          key: { value: rawName },
          value
        } = node;
        const normalizedValue: string = rawName.toLowerCase();
        if (strings && HTML_PROSE_ATTRIBUTES.has(normalizedValue)) {
          scanHtmlNode(value, 'fix');
        } else if (identifiers && HTML_IDENTIFIER_ATTRIBUTES.has(normalizedValue)) {
          scanHtmlNode(value, 'report');
        }
      };
    }

    // `@eslint/css` (css/css) support, via the visitor type `@eslint/css` publishes. `/* */`
    // comments and string values are prose (the `comments`/`strings` toggles, auto-fixed); class
    // and id selector names are identifiers (report-only), since renaming one would break the
    // HTML/JS that references it. Value keywords, URLs and property names are left alone. CSS
    // nodes carry source offsets on `loc`. (A CSS `Identifier` value node reaches the ESTree
    // `Identifier` handler above, which no-ops on a parentless node.)
    const cssListener: CSSRuleVisitor = listener as CSSRuleVisitor;

    function scanCssLoc(loc: CSSSyntaxElement['loc'], mode: 'fix' | 'report'): void {
      if (loc) {
        reportSpan(loc.start.offset, loc.end.offset, mode);
      }
    }

    if (comments) {
      cssListener.StyleSheet = (): void => {
        const { comments: cssComments } = sourceCode as unknown as CSSSourceCode;
        for (const comment of cssComments ?? []) {
          scanCssLoc(comment.loc, 'fix');
        }
      };
    }

    if (strings) {
      cssListener.String = (node): void => {
        // `String` is also the Momoa (JSON) node type; those carry a `range` while css-tree
        // nodes do not, so skip them here (JSON strings are handled by `Member`/`Element`).
        if (!('range' in node)) {
          scanCssLoc(node.loc, 'fix');
        }
      };
    }

    if (identifiers) {
      cssListener.ClassSelector = (node): void => {
        scanCssLoc(node.loc, 'report');
      };
      cssListener.IdSelector = (node): void => {
        scanCssLoc(node.loc, 'report');
      };
    }

    // `yaml-eslint-parser` support. Unlike the others this is a *parser* (configured via
    // `languageOptions.parser`), so it produces an ESTree-superset AST: the root is a `Program`,
    // which means YAML `#` comments flow through the ESTree comment handler above for free. Here
    // we add the YAML-specific nodes: a mapping key is an identifier (report-only, since config
    // keys are referenced elsewhere) and mapping/sequence scalar values are strings (auto-fixed).
    interface IYamlListener {
      YAMLPair?: (node: YamlAST.YAMLPair) => void;
      YAMLSequence?: (node: YamlAST.YAMLSequence) => void;
    }
    const yamlListener: IYamlListener = listener as IYamlListener;

    function scanYamlScalar(
      node: YamlAST.YAMLContent | YamlAST.YAMLWithMeta | null,
      mode: 'fix' | 'report'
    ): void {
      if (node?.type === 'YAMLScalar') {
        const [start, end] = node.range;
        reportSpan(start, end, mode);
      }
    }

    if (identifiers || strings) {
      yamlListener.YAMLPair = (node): void => {
        if (identifiers) {
          scanYamlScalar(node.key, 'report');
        }

        if (strings) {
          scanYamlScalar(node.value, 'fix');
        }
      };
    }

    if (strings) {
      yamlListener.YAMLSequence = (node): void => {
        for (const entry of node.entries) {
          scanYamlScalar(entry, 'fix');
        }
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
    // Reached under a non-ESTree language whose AST also has an `Identifier` node (a JSON5
    // unquoted key), which carries no ESTree parent. Those keys are handled by the JSON
    // `Member` visitor instead, so ignore them here.
    return false;
  }

  const { type } = parent;

  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (type) {
    case 'VariableDeclarator': {
      return parent.id === node;
    }

    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      return isFunctionNameOrParam(parent, node);
    }

    case 'ClassDeclaration':
    case 'ClassExpression': {
      return parent.id === node;
    }

    case 'Property': {
      const { key, computed } = parent;
      return key === node && !computed;
    }

    case 'PropertyDefinition':
    case 'MethodDefinition': {
      const { key, computed } = parent;
      return key === node && !computed;
    }

    default: {
      return false;
    }
  }
}

function isFunctionNameOrParam(parent: Rule.Node, node: Rule.Node): boolean {
  if ('id' in parent && parent.id === node) {
    return true;
  }

  return 'params' in parent && parent.params.some((param): boolean => param === node);
}

// If `node` is the string specifier of an `import`/`export ... from`/dynamic `import()` or a
// `require(...)` call, returns the specifier text; otherwise returns undefined.
function importedModuleSpecifier(node: Rule.Node): string | undefined {
  const { parent } = node;
  const { type } = parent;

  const isFromSource: boolean =
    (type === 'ImportDeclaration' ||
      type === 'ExportAllDeclaration' ||
      type === 'ExportNamedDeclaration' ||
      type === 'ImportExpression') &&
    'source' in parent &&
    parent.source === node;

  const isRequireArgument: boolean =
    type === 'CallExpression' &&
    parent.callee.type === 'Identifier' &&
    parent.callee.name === 'require' &&
    parent.arguments[0] === node;

  if ((isFromSource || isRequireArgument) && node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  return undefined;
}

// The offset within a module specifier where its in-package file path begins. A bare package
// name (`pkg`, `@scope/pkg`) with no subpath contributes no file path (returns the string
// length); a relative or absolute specifier is entirely a file path (returns 0); a subpath
// import returns the offset just past `pkg/` or `@scope/pkg/`.
function inPackageFilePathStart(specifier: string): number {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return 0;
  }

  const segments: string[] = specifier.split('/');
  const packageSegmentCount: number = specifier.startsWith('@') ? 2 : 1;
  if (segments.length <= packageSegmentCount) {
    return specifier.length;
  }

  return segments.slice(0, packageSegmentCount).join('/').length + 1;
}
