/*! Copyright (c) Ian Clanton-Thuon. All rights reserved. */

import {
  AMBIGUOUS_AMERICAN_SPELLINGS,
  AMERICAN_TO_BRITISH,
  BRITISH_TO_AMERICAN,
  findAmericanSpellings,
  findAustralianSpellings,
  findBritishSpellings,
  findCanadianSpellings,
  findNonPreferredSpellings,
  getAmericanSpelling,
  getAustralianSpelling,
  getBritishSpelling,
  getCanadianSpelling,
  isAmericanSpelling,
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

describe(getBritishSpelling.name, () => {
  it('translates a known American spelling', () => {
    expect(getBritishSpelling('color')).toBe('colour');
    expect(getBritishSpelling('behavior')).toBe('behaviour');
    expect(getBritishSpelling('organize')).toBe('organise');
    expect(getBritishSpelling('center')).toBe('centre');
  });

  it('returns undefined for words that are already British', () => {
    expect(getBritishSpelling('colour')).toBeUndefined();
    expect(getBritishSpelling('centre')).toBeUndefined();
  });

  it('round-trips with getAmericanSpelling', () => {
    expect(getBritishSpelling(getAmericanSpelling('colour') as string)).toBe('colour');
    expect(getAmericanSpelling(getBritishSpelling('color') as string)).toBe('color');
  });

  it('preserves the casing of the input word', () => {
    expect(getBritishSpelling('Color')).toBe('Colour');
    expect(getBritishSpelling('COLOR')).toBe('COLOUR');
  });
});

describe(isBritishSpelling.name, () => {
  it('recognises British spellings regardless of case', () => {
    expect(isBritishSpelling('colour')).toBe(true);
    expect(isBritishSpelling('Colour')).toBe(true);
    expect(isBritishSpelling('color')).toBe(false);
  });
});

describe(isAmericanSpelling.name, () => {
  it('recognises American spellings regardless of case', () => {
    expect(isAmericanSpelling('color')).toBe(true);
    expect(isAmericanSpelling('Color')).toBe(true);
    expect(isAmericanSpelling('colour')).toBe(false);
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

    const [match] = matches;
    expect(match?.from).toBe('colour');
    expect(match?.to).toBe('color');
    expect(match?.word).toBe('colour');
    expect(match?.index).toBe('default_'.length);
  });

  it('splits camelCase and reports each offending sub-word', () => {
    const matches: ISpellingMatch[] = findBritishSpellings('favouriteColour');
    const from: string[] = matches.map((match: ISpellingMatch): string => match.from);

    expect(from).toEqual(['favourite', 'colour']);
  });

  it('handles acronym boundaries such as HTTPColour', () => {
    const matches: ISpellingMatch[] = findBritishSpellings('HTTPColourClient');
    const from: string[] = matches.map((match: ISpellingMatch): string => match.from);

    expect(from).toEqual(['colour']);
  });

  it('finds multiple spellings in a sentence of prose', () => {
    const matches: ISpellingMatch[] = findBritishSpellings(
      'Initialise the colour of the neighbour before you analyse it.'
    );
    const to: string[] = matches.map((match: ISpellingMatch): string => match.to);

    expect(to).toEqual(['Initialize', 'color', 'neighbor', 'analyze']);
  });

  it('returns nothing for wholly American text', () => {
    expect(findBritishSpellings('initialize the color of the neighbor')).toEqual([]);
  });
});

describe(findAmericanSpellings.name, () => {
  it('finds American spellings and steers them to British', () => {
    const matches: ISpellingMatch[] = findAmericanSpellings(
      'Initialize the color of the neighbor before you analyze it.'
    );
    const to: string[] = matches.map((match: ISpellingMatch): string => match.to);

    expect(to).toEqual(['Initialise', 'colour', 'neighbour', 'analyse']);
  });

  it('returns nothing for wholly British text', () => {
    expect(findAmericanSpellings('initialise the colour of the neighbour')).toEqual([]);
  });

  it('is equivalent to findNonPreferredSpellings with the british target', () => {
    expect(findAmericanSpellings('color')).toEqual(findNonPreferredSpellings('color', 'british'));
  });
});

describe('ambiguous American spellings', () => {
  it('are not steered to British by default', () => {
    // `program`, `disk`, `analog` and `dialog` are all accepted in British English.
    expect(getBritishSpelling('program')).toBeUndefined();
    expect(getBritishSpelling('disk')).toBeUndefined();
    expect(isAmericanSpelling('program')).toBe(false);
    expect(findAmericanSpellings('the program on disk uses a dialog')).toEqual([]);
  });

  it('are steered to British when includeAmbiguous is set', () => {
    expect(getBritishSpelling('program', { includeAmbiguous: true })).toBe('programme');
    expect(getBritishSpelling('Disk', { includeAmbiguous: true })).toBe('Disc');
    expect(isAmericanSpelling('program', { includeAmbiguous: true })).toBe(true);

    const matches: ISpellingMatch[] = findAmericanSpellings('the program on disk', {
      includeAmbiguous: true
    });
    expect(matches.map((match: ISpellingMatch): string => match.to)).toEqual(['programme', 'disc']);
  });

  it('do not affect the American direction', () => {
    // Going the other way, the British forms are still corrected to American as usual.
    expect(getAmericanSpelling('programme')).toBe('program');
    expect(getAmericanSpelling('disc')).toBe('disk');
    expect(isBritishSpelling('programme')).toBe(true);
  });

  it('are all present as American spellings in the table', () => {
    for (const word of AMBIGUOUS_AMERICAN_SPELLINGS) {
      expect(AMERICAN_TO_BRITISH.has(word)).toBe(true);
    }
  });
});

describe(`${BRITISH_TO_AMERICAN.constructor.name} tables`, () => {
  it('are populated', () => {
    // Guards against the loops below passing vacuously if a table is ever emptied or its
    // type changes out from under this suite.
    expect(BRITISH_TO_AMERICAN.size).toBeGreaterThan(1000);
    expect(AMERICAN_TO_BRITISH.size).toBeGreaterThan(1000);
  });

  it('never map a word to itself', () => {
    for (const [from, to] of BRITISH_TO_AMERICAN) {
      expect(from).not.toBe(to);
    }
    for (const [from, to] of AMERICAN_TO_BRITISH) {
      expect(from).not.toBe(to);
    }
  });

  it('are entirely lower-case on both sides', () => {
    for (const [from, to] of BRITISH_TO_AMERICAN) {
      expect(from).toBe(from.toLowerCase());
      expect(to).toBe(to.toLowerCase());
    }
    for (const [from, to] of AMERICAN_TO_BRITISH) {
      expect(from).toBe(from.toLowerCase());
      expect(to).toBe(to.toLowerCase());
    }
  });

  it('invert each other for every American word', () => {
    for (const [american, british] of AMERICAN_TO_BRITISH) {
      expect(BRITISH_TO_AMERICAN.get(british)).toBe(american);
    }
  });
});

describe(getCanadianSpelling.name, () => {
  it('keeps British -our/-re/-ce spellings', () => {
    // Canadian English follows British for these families.
    expect(getCanadianSpelling('color')).toBe('colour');
    expect(getCanadianSpelling('center')).toBe('centre');
    expect(getCanadianSpelling('defense')).toBe('defence');
    expect(getCanadianSpelling('behavior')).toBe('behaviour');
  });

  it('takes American -ize/-yze endings', () => {
    // The one place Canadian sides with American: -ize/-yze verbs and their inflections.
    expect(getCanadianSpelling('organise')).toBe('organize');
    expect(getCanadianSpelling('realise')).toBe('realize');
    expect(getCanadianSpelling('analyse')).toBe('analyze');
  });

  it('takes a handful of American forms Canadians prefer', () => {
    expect(getCanadianSpelling('aluminium')).toBe('aluminum');
    expect(getCanadianSpelling('aeroplane')).toBe('airplane');
  });

  it('returns undefined for words already in Canadian form', () => {
    expect(getCanadianSpelling('colour')).toBeUndefined();
    expect(getCanadianSpelling('organize')).toBeUndefined();
    expect(getCanadianSpelling('aluminum')).toBeUndefined();
  });

  it('preserves the casing of the input word', () => {
    expect(getCanadianSpelling('Organise')).toBe('Organize');
    expect(getCanadianSpelling('COLOR')).toBe('COLOUR');
  });
});

describe(getAustralianSpelling.name, () => {
  it('follows British spellings, including -ise endings', () => {
    expect(getAustralianSpelling('color')).toBe('colour');
    expect(getAustralianSpelling('center')).toBe('centre');
    expect(getAustralianSpelling('organize')).toBe('organise');
    expect(getAustralianSpelling('analyze')).toBe('analyse');
  });

  it('takes the few American forms Australians prefer', () => {
    // VarCon marks these with the Australian primary tag.
    expect(getAustralianSpelling('enquire')).toBe('inquire');
    expect(getAustralianSpelling('liquorice')).toBe('licorice');
  });

  it('returns undefined for words already in Australian form', () => {
    expect(getAustralianSpelling('colour')).toBeUndefined();
    expect(getAustralianSpelling('organise')).toBeUndefined();
    expect(getAustralianSpelling('inquire')).toBeUndefined();
  });
});

describe(findCanadianSpellings.name, () => {
  it('steers a mixed sentence to Canadian', () => {
    const matches: ISpellingMatch[] = findCanadianSpellings(
      'Initialise the color of the neighbor before you analyse it.'
    );
    const to: string[] = matches.map((match: ISpellingMatch): string => match.to);

    // British -ise/-yse take the American -ize/-yze; American -or takes the British -our.
    expect(to).toEqual(['Initialize', 'colour', 'neighbour', 'analyze']);
  });

  it('leaves wholly Canadian text untouched', () => {
    expect(findCanadianSpellings('initialize the colour of the neighbour')).toEqual([]);
  });
});

describe(findAustralianSpellings.name, () => {
  it('steers a mixed sentence to Australian', () => {
    const matches: ISpellingMatch[] = findAustralianSpellings('Organize the color scheme');
    const to: string[] = matches.map((match: ISpellingMatch): string => match.to);

    expect(to).toEqual(['Organise', 'colour']);
  });

  it('is equivalent to findNonPreferredSpellings with the australian target', () => {
    expect(findAustralianSpellings('color')).toEqual(findNonPreferredSpellings('color', 'australian'));
  });
});
