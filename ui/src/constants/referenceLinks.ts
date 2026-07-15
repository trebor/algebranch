// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { StepChange } from 'math-engine';

const URL_QUADRATIC_FORMULA = 'https://en.wikipedia.org/wiki/Quadratic_formula';
const URL_QUADRATIC_EQUATION = 'https://en.wikipedia.org/wiki/Quadratic_equation';
const URL_DISTRIBUTIVE_PROPERTY = 'https://en.wikipedia.org/wiki/Distributive_property';
const URL_FACTORIZATION = 'https://en.wikipedia.org/wiki/Factorization';
const URL_SUBSTITUTION = 'https://en.wikipedia.org/wiki/Substitution_(algebra)';
const URL_EQUALITY_MATHEMATICS = 'https://en.wikipedia.org/wiki/Equality_(mathematics)';
const URL_RATIONALISATION = 'https://en.wikipedia.org/wiki/Rationalisation_(mathematics)';
const URL_COMPLETING_THE_SQUARE = 'https://en.wikipedia.org/wiki/Completing_the_square';
const URL_DIFFERENCE_OF_TWO_SQUARES = 'https://en.wikipedia.org/wiki/Difference_of_two_squares';
const URL_LOWEST_COMMON_DENOMINATOR = 'https://en.wikipedia.org/wiki/Lowest_common_denominator';
const URL_SQUARE_ROOT = 'https://en.wikipedia.org/wiki/Square_root';

/**
 * Returns a reference Wikipedia URL for the given step change operation, or null if none is mapped.
 */
export const getReferenceUrl = (change: StepChange): string | null => {
  if (change.kind === 'rewrite') {
    if (change.label) {
      if (change.label === 'Rationalize Denominator') {
        return URL_RATIONALISATION;
      }
      if (change.label === 'Complete the Square') {
        return URL_COMPLETING_THE_SQUARE;
      }
      if (
        change.label === 'Difference of Squares' ||
        change.label === 'Factor Difference of Squares' ||
        change.label.includes('Difference of Squares')
      ) {
        return URL_DIFFERENCE_OF_TWO_SQUARES;
      }
      if (change.label === 'Combine Fractions') {
        return URL_LOWEST_COMMON_DENOMINATOR;
      }
      if (change.label.startsWith('Take Root')) {
        return URL_SQUARE_ROOT;
      }
    }

    const op = change.op;
    if (op === 'quadratic') {
      return URL_QUADRATIC_FORMULA;
    }
    if (op === 'quadratic_standard_form') {
      return URL_QUADRATIC_EQUATION;
    }
    if (op === 'expand') {
      return URL_DISTRIBUTIVE_PROPERTY;
    }
    if (op === 'factor') {
      return URL_FACTORIZATION;
    }
    if (op === 'substitute') {
      return URL_SUBSTITUTION;
    }
  } else if (change.kind === 'bothSides') {
    const op = change.op;
    if (
      op === 'add' ||
      op === 'subtract' ||
      op === 'multiply' ||
      op === 'divide' ||
      op === 'power' ||
      op === 'root'
    ) {
      return URL_EQUALITY_MATHEMATICS;
    }
  }

  return null;
};
