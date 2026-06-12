import * as math from 'mathjs';
import { Equation, ensureNodeIds } from './tree';

export * from './interval';
export * from './tree';
export * from './validator';
export * from './simplify';
export * from './matcher';
export * from './rules';
export * from './describe';

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

  if (!parts[0].trim() || !parts[1].trim()) {
    throw new Error('Both sides of the equation must be non-empty');
  }

  const eq = {
    lhs: math.parse(parts[0].trim()),
    rhs: math.parse(parts[1].trim()),
  };

  const allowedNodeTypes = new Set(['ConstantNode', 'SymbolNode', 'ParenthesisNode', 'OperatorNode', 'FunctionNode']);
  const allowedOperators = new Set(['+', '-', '*', '/', '^']);
  const allowedFunctions = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'sqrt', 'nthRoot']);
  const forbiddenSymbolNames = new Set(['undefined', 'null', 'nan', 'infinity', 'true', 'false']);

  const getFnName = (n: math.FunctionNode): string => {
    const nodeAny = n as any;
    if (nodeAny.fn) {
      if (typeof nodeAny.fn === 'string') return nodeAny.fn;
      if (typeof nodeAny.fn === 'object' && nodeAny.fn !== null && 'name' in nodeAny.fn) {
        return nodeAny.fn.name;
      }
    }
    return nodeAny.name || '';
  };

  const checkNode = (node: math.MathNode) => {
    node.traverse((n) => {
      if (!allowedNodeTypes.has(n.type)) {
        throw new Error(`Unsupported expression structure: "${n.type}" is not allowed`);
      }

      if (n.type === 'SymbolNode') {
        const name = (n as math.SymbolNode).name;
        if (forbiddenSymbolNames.has(name.toLowerCase())) {
          throw new Error(`"${name}" is a reserved keyword and cannot be used as a variable name`);
        }
      } else if (n.type === 'ConstantNode') {
        const val = (n as math.ConstantNode).value;
        if (typeof val !== 'number' || isNaN(val)) {
          throw new Error(`Value "${val}" is not allowed as a constant in equations`);
        }
      } else if (n.type === 'OperatorNode') {
        const opNode = n as math.OperatorNode;
        if (!allowedOperators.has(opNode.op)) {
          throw new Error(`Operator "${opNode.op}" is not allowed in equations`);
        }
      } else if (n.type === 'FunctionNode') {
        const funcNode = n as math.FunctionNode;
        const name = getFnName(funcNode);
        if (!allowedFunctions.has(name)) {
          throw new Error(`Function "${name}" is not allowed in equations`);
        }
      }
    });
  };
  checkNode(eq.lhs);
  checkNode(eq.rhs);

  return ensureNodeIds(eq);
};

/**
 * Formats a number with 2 decimal places if it's reasonably-sized, or scientific notation if very large/small.
 */
export const formatNumber = (val: any): string => {
  let numVal = val;
  if (typeof val === 'object' && val !== null) {
    if (typeof val.toNumber === 'function') {
      numVal = val.toNumber();
    } else {
      numVal = Number(val);
    }
  }
  
  if (typeof numVal !== 'number' || isNaN(numVal)) {
    return String(val);
  }

  const absVal = Math.abs(numVal);
  
  // Very large or very small -> scientific notation
  if (absVal >= 1e6 || (absVal > 0 && absVal < 1e-3)) {
    let formatted = numVal.toExponential(2);
    // Remove positive exponent plus signs, e.g. e+6 -> e6
    formatted = formatted.replace(/e\+/, 'e');
    // Remove trailing zeros in decimal part, e.g. 1.20e-6 -> 1.2e-6, 1.00e6 -> 1e6
    formatted = formatted.replace(/\.?0+(?=e)/, '');
    return formatted;
  }
  
  if (Number.isInteger(numVal)) {
    return numVal.toString();
  }
  
  // Round to max 2 decimal places
  const rounded = Math.round(numVal * 100) / 100;
  return rounded.toString();
};

/**
 * Serializes an Equation tree back to a string form "LHS = RHS".
 */
export const equationToString = (eq: Equation): string => {
  const options = {
    handler: (node: math.MathNode, options: any): string | undefined => {
      if (node.type === 'ConstantNode') {
        return formatNumber((node as math.ConstantNode).value);
      }
      return undefined;
    }
  };
  return `${eq.lhs.toString(options)} = ${eq.rhs.toString(options)}`;
};
