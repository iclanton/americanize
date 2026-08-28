/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import {
  BRITISH_TO_AMERICAN,
  findBritishSpellings,
  getAmericanSpelling,
  isBritishSpelling,
  matchCase
} from '../index';
import type { ISpellingMatch } from '../index';

describe(getAmericanSpelling.name, () => {
  it('translates a known British spelling', () => {
    expect(getAmericanSpelling('colour')).toBe('color');
    expect(getAmericanSpelling('behaviour')).toBe('behavior');
    expect(getAmericanSpelling('organise')).toBe('organize');
    expect(getAmericanSpelling('centre')).toBe('center');
  });

  it('returns undefined for words that are already American', () => {
    expect(getAmericanSpelling('color')).toBeUndefined();
    expect(getAmericanSpelling('center')).toBeUndefined();
  });

  it('returns undefined for words with no British/American distinction', () => {
    expect(getAmericanSpelling('function')).toBeUndefined();
    expect(getAmericanSpelling('')).toBeUndefined();
  });

  it('does not flag the -ise words that stay -ise in American English', () => {
    // `advertise`, `exercise`, `surprise` and friends are not `-ize` words in either dialect.
    expect(getAmericanSpelling('advertise')).toBeUndefined();
    expect(getAmericanSpelling('exercise')).toBeUndefined();
    expect(getAmericanSpelling('surprise')).toBeUndefined();
    expect(getAmericanSpelling('compromise')).toBeUndefined();
  });

  it('preserves the casing of the input word', () => {
    expect(getAmericanSpelling('Colour')).toBe('Color');
    expect(getAmericanSpelling('COLOUR')).toBe('COLOR');
    expect(getAmericanSpelling('colour')).toBe('color');
  });
});

describe(isBritishSpelling.name, () => {
  it('recognises British spellings regardless of case', () => {
    expect(isBritishSpelling('colour')).toBe(true);
    expect(isBritishSpelling('Colour')).toBe(true);
    expect(isBritishSpelling('color')).toBe(false);
  });
});

describe(matchCase.name, () => {
  it('mirrors all-upper, capitalised and lower casings', () => {
    expect(matchCase('COLOUR', 'color')).toBe('COLOR');
    expect(matchCase('Colour', 'color')).toBe('Color');
    expect(matchCase('colour', 'color')).toBe('color');
  });

  it('falls back to the replacement casing for mixed case', () => {
    expect(matchCase('cOlOuR', 'color')).toBe('color');
  });
});

describe(findBritishSpellings.name, () => {
  it('finds a spelling inside a snake_case identifier', () => {
    const matches: ISpellingMatch[] = findBritishSpellings('default_colour_value');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.british).toBe('colour');
    expect(matches[0]?.american).toBe('color');
    expect(matches[0]?.word).toBe('colour');
    expect(matches[0]?.index).toBe('default_'.length);
  });

  it('splits camelCase and reports each offending sub-word', () => {
    const matches: ISpellingMatch[] = findBritishSpellings('favouriteColour');
    const british: string[] = matches.map((match: ISpellingMatch): string => match.british);

    expect(british).toEqual(['favourite', 'colour']);
  });

  it('handles acronym boundaries such as HTTPColour', () => {
    const matches: ISpellingMatch[] = findBritishSpellings('HTTPColourClient');
    const british: string[] = matches.map((match: ISpellingMatch): string => match.british);

    expect(british).toEqual(['colour']);
  });

  it('finds multiple spellings in a sentence of prose', () => {
    const matches: ISpellingMatch[] = findBritishSpellings(
      'Initialise the colour of the neighbour before you analyse it.'
    );
    const american: string[] = matches.map((match: ISpellingMatch): string => match.american);

    expect(american).toEqual(['Initialize', 'color', 'neighbor', 'analyze']);
  });

  it('returns nothing for wholly American text', () => {
    expect(findBritishSpellings('initialize the color of the neighbor')).toEqual([]);
  });
});

describe('BRITISH_TO_AMERICAN table', () => {
  it('never maps a word to itself', () => {
    for (const [british, american] of Object.entries(BRITISH_TO_AMERICAN)) {
      expect(british).not.toBe(american);
    }
  });

  it('is entirely lower-case on both sides', () => {
    for (const [british, american] of Object.entries(BRITISH_TO_AMERICAN)) {
      expect(british).toBe(british.toLowerCase());
      expect(american).toBe(american.toLowerCase());
    }
  });
});
