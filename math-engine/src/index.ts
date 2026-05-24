import * as math from 'mathjs';
import { Equation, ensureNodeIds } from './tree';

export * from './interval';
export * from './tree';
export * from './validator';
export * from './simplify';

/**
 * Parses an equation string of the form "LHS = RHS" into an Equation tree.
 */
export const parseEquation = (eqStr: string): Equation => {
  const delimiter = '=';
  const parts = eqStr.split(delimiter);
  const expectedPartsCount = 2;

  if (parts.length !== expectedPartsCount) {
    throw new Error('Equation must contain exactly one "=" sign');
  }

  const eq = {
    lhs: math.parse(parts[0].trim()),
    rhs: math.parse(parts[1].trim()),
  };
  return ensureNodeIds(eq);
};

/**
 * Serializes an Equation tree back to a string form "LHS = RHS".
 */
export const equationToString = (eq: Equation): string => {
  return `${eq.lhs.toString()} = ${eq.rhs.toString()}`;
};
