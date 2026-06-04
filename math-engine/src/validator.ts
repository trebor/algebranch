import * as math from 'mathjs';
import {
  Interval,
  createInterval,
  negInterval,
  addInterval,
  subInterval,
  mulInterval,
  divInterval,
  powInterval,
  sqrtInterval,
} from './interval';
import {
  Equation,
  getNodeByPath,
  replaceNodeAtPath,
  removeNodeAtPath,
  getAllPaths,
  ensureNodeIds,
  getChildren,
} from './tree';

// Global Constants
const CONST_PI = Math.PI;
const CONST_E = Math.E;
const POINT_TOLERANCE = 1e-9;
const INTERVAL_TOLERANCE = 1e-5;
const NUM_TEST_RUNS = 5;

// Variables default range for point/interval checks
const RANGE_MID_MIN = 1.0;
const RANGE_MID_MAX = 5.0;
const HALF_WIDTH = 0.05;

// Operator function mapping for math.OperatorNode constructors
const OP_TO_FN = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
} as const;

/**
 * Universal helper to extract the function name from a FunctionNode.
 * Robust against different mathjs versions where the name is stored in 'fn' or 'name'.
 */
export const getFunctionName = (node: math.FunctionNode): string => {
  const nodeAny = node as unknown as Record<string, unknown>;
  if (nodeAny.fn) {
    if (typeof nodeAny.fn === 'string') {
      return nodeAny.fn;
    }
    if (typeof nodeAny.fn === 'object' && nodeAny.fn !== null && 'name' in nodeAny.fn) {
      return (nodeAny.fn as { name: string }).name;
    }
  }
  if (typeof nodeAny.name === 'string') {
    return nodeAny.name;
  }
  return '';
};

/**
 * Helper to extract all variables from a node.
 */
export const getVariables = (node: math.MathNode): string[] => {
  const vars = new Set<string>();
  node.traverse((n) => {
    if (n.type === 'SymbolNode' && (n as math.SymbolNode).name !== 'pi' && (n as math.SymbolNode).name !== 'e') {
      vars.add((n as math.SymbolNode).name);
    }
  });
  return Array.from(vars);
};


/**
 * Recursively evaluates a mathjs node to an Interval.
 */
export const evaluateInterval = (node: math.MathNode, scope: Record<string, Interval>): Interval => {
  if (node.type === 'ConstantNode') {
    const constNode = node as math.ConstantNode;
    const val = Number(constNode.value);
    return createInterval(val, val);
  }
  if (node.type === 'SymbolNode') {
    const symbolNode = node as math.SymbolNode;
    if (symbolNode.name === 'pi') return createInterval(CONST_PI, CONST_PI);
    if (symbolNode.name === 'e') return createInterval(CONST_E, CONST_E);
    if (symbolNode.name in scope) return scope[symbolNode.name];
    throw new Error(`Symbol ${symbolNode.name} not in scope`);
  }
  if (node.type === 'ParenthesisNode') {
    const parenNode = node as math.ParenthesisNode;
    return evaluateInterval(parenNode.content, scope);
  }
  if (node.type === 'OperatorNode') {
    const opNode = node as math.OperatorNode;
    if (opNode.isUnary()) {
      const arg = evaluateInterval(opNode.args[0], scope);
      if (opNode.op === '-') return negInterval(arg);
      if (opNode.op === '+') return arg;
    } else {
      const left = evaluateInterval(opNode.args[0], scope);
      const right = evaluateInterval(opNode.args[1], scope);
      if (opNode.op === '+') return addInterval(left, right);
      if (opNode.op === '-') return subInterval(left, right);
      if (opNode.op === '*') return mulInterval(left, right);
      if (opNode.op === '/') return divInterval(left, right);
      if (opNode.op === '^') {
        const valExponent = 2;
        const midRight = (right.min + right.max) / valExponent;
        return powInterval(left, midRight);
      }
    }
  }
  if (node.type === 'FunctionNode') {
    const funcNode = node as math.FunctionNode;
    const nameStr = getFunctionName(funcNode);

    if (nameStr === 'sqrt') {
      const arg = evaluateInterval(funcNode.args[0], scope);
      return sqrtInterval(arg);
    }
    if (nameStr === 'nthRoot') {
      const base = evaluateInterval(funcNode.args[0], scope);
      let degree = 2;
      if (funcNode.args.length === 2) {
        const degreeInt = evaluateInterval(funcNode.args[1], scope);
        degree = (degreeInt.min + degreeInt.max) / 2;
      }
      return createInterval(Math.pow(base.min, 1 / degree), Math.pow(base.max, 1 / degree));
    }
    if (nameStr === 'sin' || nameStr === 'cos') {
      return createInterval(-1, 1);
    }
    if (nameStr === 'tan' || nameStr === 'cot' || nameStr === 'sec' || nameStr === 'csc' || nameStr === 'log') {
      return createInterval(-Infinity, Infinity);
    }
  }
  throw new Error(`Unsupported interval node type: ${node.type}`);
};

const isValFinite = (val: any): boolean => {
  if (typeof val === 'object' && val !== null && val.isComplex) {
    return Number.isFinite(val.re) && Number.isFinite(val.im);
  }
  return Number.isFinite(Number(val));
};
const isValNaN = (val: any): boolean => {
  if (typeof val === 'object' && val !== null && val.isComplex) {
    return Number.isNaN(val.re) || Number.isNaN(val.im);
  }
  return Number.isNaN(Number(val));
};

const isReal = (val: any): boolean => {
  if (typeof val === 'object' && val !== null && val.isComplex) {
    return Math.abs(val.im) < 1e-9;
  }
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
};

/**
 * Recursively evaluates a mathjs node to a single number or complex number (point evaluation).
 */
export const evaluatePoint = (node: math.MathNode, scope: Record<string, number>): any => {
  if (node.type === 'ConstantNode') {
    const constNode = node as math.ConstantNode;
    return Number(constNode.value);
  }
  if (node.type === 'SymbolNode') {
    const symbolNode = node as math.SymbolNode;
    if (symbolNode.name === 'pi') return CONST_PI;
    if (symbolNode.name === 'e') return CONST_E;
    if (symbolNode.name in scope) return scope[symbolNode.name];
    throw new Error(`Symbol ${symbolNode.name} not in scope`);
  }
  if (node.type === 'ParenthesisNode') {
    const parenNode = node as math.ParenthesisNode;
    return evaluatePoint(parenNode.content, scope);
  }
  if (node.type === 'OperatorNode') {
    const opNode = node as math.OperatorNode;
    const args = opNode.args.map((arg) => evaluatePoint(arg, scope));
    if (opNode.isUnary()) {
      if (opNode.op === '-') return math.unaryMinus(args[0]) as any;
      if (opNode.op === '+') return args[0];
    } else {
      const [left, right] = args;
      if (opNode.op === '+') return math.add(left, right) as any;
      if (opNode.op === '-') return math.subtract(left, right) as any;
      if (opNode.op === '*') return math.multiply(left, right) as any;
      if (opNode.op === '/') return math.divide(left, right) as any;
      if (opNode.op === '^') return math.pow(left, right) as any;
    }
  }
  if (node.type === 'FunctionNode') {
    const funcNode = node as math.FunctionNode;
    const args = funcNode.args.map((arg) => evaluatePoint(arg, scope));
    const nameStr = getFunctionName(funcNode);

    if (nameStr === 'sqrt') return math.sqrt(args[0]) as any;
    if (nameStr === 'nthRoot') {
      const base = args[0];
      const degree = args[1] !== undefined ? args[1] : 2;
      return math.pow(base, math.divide(1, degree)) as any;
    }
    if (nameStr === 'sin') return math.sin(args[0]) as any;
    if (nameStr === 'cos') return math.cos(args[0]) as any;
    if (nameStr === 'tan') return math.tan(args[0]) as any;
    if (nameStr === 'cot') return math.cot(args[0]) as any;
    if (nameStr === 'sec') return math.sec(args[0]) as any;
    if (nameStr === 'csc') return math.csc(args[0]) as any;
    if (nameStr === 'log') {
      const val = args[0];
      const base = args[1] !== undefined ? args[1] : Math.E;
      return math.log(val, base) as any;
    }
  }
  throw new Error(`Unsupported point node type: ${node.type}`);
};

/**
 * Numerically solves LHS - RHS = 0 for a specific variable using Newton-Raphson.
 * Returns the root value or null if it fails to converge.
 */
export const solveForVariable = (
  nodeLHS: math.MathNode,
  nodeRHS: math.MathNode,
  solveVar: string,
  scope: Record<string, number>,
  initialGuess: number = 1.0
): any | null => {
  const f = (x: any): any => {
    const localScope = { ...scope, [solveVar]: x };
    return math.subtract(evaluatePoint(nodeLHS, localScope), evaluatePoint(nodeRHS, localScope));
  };

  let x: any = initialGuess; // Initial guess
  const maxIterations = 20;
  const tolerance = 1e-10;
  const h = 1e-5;

  for (let i = 0; i < maxIterations; i++) {
    const y = f(x);
    if (isValNaN(y) || !isValFinite(y)) {
      return null;
    }
    if (Number(math.abs(y)) < tolerance) {
      return x;
    }
    const dy = math.divide(math.subtract(f(math.add(x, h)), f(math.subtract(x, h))), 2 * h);
    if (Number(math.abs(dy)) < 1e-12) {
      x = math.add(x, 1.5); // Shift guess if derivative is zero
      continue;
    }
    x = math.subtract(x, math.divide(y, dy));
  }

  if (Number(math.abs(f(x))) < 1e-7) {
    return x;
  }
  return null;
};

const isEquationReal = (eq: Equation, scope: Record<string, number>): boolean => {
  try {
    const valLHS = evaluatePoint(eq.lhs, scope);
    const valRHS = evaluatePoint(eq.rhs, scope);
    return isReal(valLHS) && isReal(valRHS);
  } catch {
    return false;
  }
};

/**
 * Checks if target equation is satisfied when source equation's root is found.
 */
export const isEquationSatisfiedAtRoot = (
  eqSource: Equation,
  eqTarget: Equation,
  variables: string[],
  scope: Record<string, number>
): boolean => {
  const guesses = [1.0, -1.0, 5.0, -5.0, 0.5, -0.5, 0.1, -0.1];
  let hasCheckedAnyRoot = false;
  const isRealEq = isEquationReal(eqSource, scope);

  for (const solveVar of variables) {
    for (const guess of guesses) {
      const root = solveForVariable(eqSource.lhs, eqSource.rhs, solveVar, { ...scope }, guess);
      if (root !== null && isValFinite(root) && !isValNaN(root)) {
        if (isRealEq && !isReal(root)) {
          continue;
        }
        hasCheckedAnyRoot = true;
        const localScope = { ...scope, [solveVar]: root };
        const dTarget = math.subtract(evaluatePoint(eqTarget.lhs, localScope), evaluatePoint(eqTarget.rhs, localScope));
        if (isValNaN(dTarget) || !isValFinite(dTarget) || Number(math.abs(dTarget)) > 1e-5) {
          return false;
        }
      }
    }
  }

  if (!hasCheckedAnyRoot) {
    // Fallback for constant equations or equations with no real roots on the domain
    const d1 = math.subtract(evaluatePoint(eqSource.lhs, scope), evaluatePoint(eqSource.rhs, scope));
    const d2 = math.subtract(evaluatePoint(eqTarget.lhs, scope), evaluatePoint(eqTarget.rhs, scope));
    if (isValNaN(d1) || isValNaN(d2) || !isValFinite(d1) || !isValFinite(d2)) {
      return false;
    }
    return Number(math.abs(math.subtract(d1, d2))) <= POINT_TOLERANCE;
  }

  return true;
};

/**
 * Tests if two equations are equivalent using point evaluation across multiple random midpoints.
 */
export const areEquationsEquivalentPoint = (eq1: Equation, eq2: Equation, variables: string[]): boolean => {
  try {
    const numTestRuns = 3;

    for (let run = 0; run < numTestRuns; run++) {
      const scope: Record<string, number> = {};
      variables.forEach((v) => {
        scope[v] = Math.random() * (RANGE_MID_MAX - RANGE_MID_MIN) + RANGE_MID_MIN;
      });

      // Find roots of eq1
      const roots1: Record<string, any[]> = {};
      const guesses = [1.0, -1.0, 5.0, -5.0, 0.5, -0.5, 0.1, -0.1];
      const isRealEq1 = isEquationReal(eq1, scope);

      for (const solveVar of variables) {
        roots1[solveVar] = [];
        for (const guess of guesses) {
          const root = solveForVariable(eq1.lhs, eq1.rhs, solveVar, { ...scope }, guess);
          if (root !== null && isValFinite(root) && !isValNaN(root)) {
            if (isRealEq1 && !isReal(root)) {
              continue;
            }
            roots1[solveVar].push(root);
          }
        }
      }

      // Find roots of eq2, using roots1 as extra guesses
      const roots2: Record<string, any[]> = {};
      const isRealEq2 = isEquationReal(eq2, scope);
      for (const solveVar of variables) {
        roots2[solveVar] = [];
        const extraGuesses = [...guesses, ...roots1[solveVar]];
        for (const guess of extraGuesses) {
          const root = solveForVariable(eq2.lhs, eq2.rhs, solveVar, { ...scope }, guess);
          if (root !== null && isValFinite(root) && !isValNaN(root)) {
            if (isRealEq2 && !isReal(root)) {
              continue;
            }
            roots2[solveVar].push(root);
          }
        }
      }

      // Now verify root equivalence:
      // 1. Every root in roots1 satisfies eq2
      for (const solveVar of variables) {
        for (const root of roots1[solveVar]) {
          const localScope = { ...scope, [solveVar]: root };
          const dTarget = math.subtract(evaluatePoint(eq2.lhs, localScope), evaluatePoint(eq2.rhs, localScope));
          if (isValNaN(dTarget) || !isValFinite(dTarget) || Number(math.abs(dTarget)) > 1e-5) {
            return false;
          }
        }
      }

      // 2. Every root in roots2 satisfies eq1
      for (const solveVar of variables) {
        for (const root of roots2[solveVar]) {
          const localScope = { ...scope, [solveVar]: root };
          const dTarget = math.subtract(evaluatePoint(eq1.lhs, localScope), evaluatePoint(eq1.rhs, localScope));
          if (isValNaN(dTarget) || !isValFinite(dTarget) || Number(math.abs(dTarget)) > 1e-5) {
            return false;
          }
        }
      }

      // If no roots were checked at all (e.g. constant equations), fall back to random point diff
      let hasCheckedAnyRoot = false;
      for (const solveVar of variables) {
        if (roots1[solveVar].length > 0 || roots2[solveVar].length > 0) {
          hasCheckedAnyRoot = true;
          break;
        }
      }

      if (!hasCheckedAnyRoot) {
        const d1 = math.subtract(evaluatePoint(eq1.lhs, scope), evaluatePoint(eq1.rhs, scope));
        const d2 = math.subtract(evaluatePoint(eq2.lhs, scope), evaluatePoint(eq2.rhs, scope));
        if (isValNaN(d1) || isValNaN(d2) || !isValFinite(d1) || !isValFinite(d2)) {
          return false;
        }
        if (Number(math.abs(math.subtract(d1, d2))) > POINT_TOLERANCE) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Tests if two equations are equivalent using rigorous Interval Arithmetic.
 */
export const areEquationsEquivalentInterval = (eq1: Equation, eq2: Equation, variables: string[]): boolean => {
  try {
    for (let run = 0; run < NUM_TEST_RUNS; run++) {
      const scope: Record<string, Interval> = {};
      variables.forEach((v) => {
        const mid = Math.random() * (RANGE_MID_MAX - RANGE_MID_MIN) + RANGE_MID_MIN;
        scope[v] = createInterval(mid - HALF_WIDTH, mid + HALF_WIDTH);
      });

      const lhs1 = evaluateInterval(eq1.lhs, scope);
      const rhs1 = evaluateInterval(eq1.rhs, scope);
      const lhs2 = evaluateInterval(eq2.lhs, scope);
      const rhs2 = evaluateInterval(eq2.rhs, scope);

      // Reject non-finite bounds (division by zero / undefined ranges) immediately
      if (
        !isFinite(lhs1.min) || !isFinite(lhs1.max) ||
        !isFinite(rhs1.min) || !isFinite(rhs1.max) ||
        !isFinite(lhs2.min) || !isFinite(lhs2.max) ||
        !isFinite(rhs2.min) || !isFinite(rhs2.max)
      ) {
        return false;
      }

      const d1 = subInterval(lhs1, rhs1);
      const d2 = subInterval(lhs2, rhs2);

      const diff = subInterval(d1, d2);
      if (diff.min > INTERVAL_TOLERANCE || diff.max < -INTERVAL_TOLERANCE) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Fast two-stage validation check for equation equivalence.
 */
export const areEquationsEquivalent = (eq1: Equation, eq2: Equation): boolean => {
  const vars1 = getVariables(eq1.lhs).concat(getVariables(eq1.rhs));
  const vars2 = getVariables(eq2.lhs).concat(getVariables(eq2.rhs));
  const variables = Array.from(new Set(vars1.concat(vars2)));

  if (variables.length === 0) {
    variables.push('x');
  }

  return areEquationsEquivalentPoint(eq1, eq2, variables);
};

/**
 * Helper to get all parent paths that should be excluded from drop targets.
 * This includes the immediate parent and any parenthesis wrapping it, up to and including
 * the first non-parenthesis operator ancestor.
 */
export const getExcludedParentPaths = (eq: Equation, sourcePath: string): Set<string> => {
  const excluded = new Set<string>();
  if (!sourcePath.includes('/')) {
    return excluded;
  }

  let currentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
  while (true) {
    excluded.add(currentPath);
    try {
      const node = getNodeByPath(eq, currentPath);
      if (node.type !== 'ParenthesisNode') {
        break;
      }
    } catch {
      break;
    }
    if (!currentPath.includes('/')) {
      break;
    }
    currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
  }
  return excluded;
};

/**
 * Checks if a node is an additive or multiplicative neutral constant (0 or 1).
 * Unwraps parenthesis nodes recursively.
 */
export const isNeutralNode = (node: math.MathNode): boolean => {
  let current = node;
  while (current.type === 'ParenthesisNode') {
    current = (current as math.ParenthesisNode).content;
  }
  if (current.type === 'ConstantNode') {
    const val = Number((current as math.ConstantNode).value);
    return val === 0 || val === 1;
  }
  return false;
};

/**
 * Checks if a path is draggable (meaning it does not have any power '^' or function ancestor above it).
 */
export const isPathDraggable = (eq: Equation, sourcePath: string): boolean => {
  if (!sourcePath.includes('/')) {
    return true;
  }

  let currentPath = sourcePath;
  while (currentPath.includes('/')) {
    currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    try {
      const ancestor = getNodeByPath(eq, currentPath);
      if (ancestor.type === 'FunctionNode') {
        return false;
      }
      if (ancestor.type === 'OperatorNode') {
        const opNode = ancestor as math.OperatorNode;
        if (opNode.op === '^') {
          return false;
        }
      }
    } catch {
      break;
    }
  }
  return true;
};

interface SignedTerm {
  node: math.MathNode;
  sign: number;
}

const hasVariable = (node: math.MathNode, varName: string): boolean => {
  let found = false;
  node.traverse((n) => {
    if (n.type === 'SymbolNode' && (n as math.SymbolNode).name === varName) {
      found = true;
    }
  });
  return found;
};

const collectTerms = (node: math.MathNode, sign: number, terms: SignedTerm[]) => {
  if (node.type === 'ParenthesisNode') {
    collectTerms((node as math.ParenthesisNode).content, sign, terms);
    return;
  }
  if (node.type === 'OperatorNode') {
    const opNode = node as math.OperatorNode;
    if (opNode.op === '+') {
      collectTerms(opNode.args[0], sign, terms);
      collectTerms(opNode.args[1], sign, terms);
      return;
    }
    if (opNode.op === '-') {
      if (opNode.isUnary()) {
        collectTerms(opNode.args[0], -sign, terms);
      } else {
        collectTerms(opNode.args[0], sign, terms);
        collectTerms(opNode.args[1], -sign, terms);
      }
      return;
    }
  }
  terms.push({ node, sign });
};

interface TermCategory {
  category: 'a' | 'b' | 'c';
  coeff: math.MathNode;
}

const getTermCategory = (node: math.MathNode, solveVar: string): TermCategory | null => {
  if (!hasVariable(node, solveVar)) {
    return { category: 'c', coeff: node };
  }

  // Check if it's solveVar^2
  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '^') {
    const opNode = node as math.OperatorNode;
    let base = opNode.args[0];
    let exponent = opNode.args[1];
    while (base.type === 'ParenthesisNode') base = (base as math.ParenthesisNode).content;
    while (exponent.type === 'ParenthesisNode') exponent = (exponent as math.ParenthesisNode).content;

    if (
      base.type === 'SymbolNode' &&
      (base as math.SymbolNode).name === solveVar &&
      exponent.type === 'ConstantNode' &&
      Number((exponent as math.ConstantNode).value) === 2
    ) {
      return { category: 'a', coeff: new math.ConstantNode(1) };
    }
  }

  // Check if it's Coeff * solveVar^2 or solveVar^2 * Coeff
  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '*') {
    const opNode = node as math.OperatorNode;
    for (let i = 0; i < 2; i++) {
      const target = opNode.args[i];
      const coeff = opNode.args[1 - i];
      let unwrappedTarget = target;
      while (unwrappedTarget.type === 'ParenthesisNode') {
        unwrappedTarget = (unwrappedTarget as math.ParenthesisNode).content;
      }
      if (
        unwrappedTarget.type === 'OperatorNode' &&
        (unwrappedTarget as math.OperatorNode).op === '^'
      ) {
        const pNode = unwrappedTarget as math.OperatorNode;
        let base = pNode.args[0];
        let exponent = pNode.args[1];
        while (base.type === 'ParenthesisNode') base = (base as math.ParenthesisNode).content;
        while (exponent.type === 'ParenthesisNode') exponent = (exponent as math.ParenthesisNode).content;

        if (
          base.type === 'SymbolNode' &&
          (base as math.SymbolNode).name === solveVar &&
          exponent.type === 'ConstantNode' &&
          Number((exponent as math.ConstantNode).value) === 2
        ) {
          return { category: 'a', coeff };
        }
      }
    }

    // Check if it's Coeff * solveVar or solveVar * Coeff
    for (let i = 0; i < 2; i++) {
      const target = opNode.args[i];
      const coeff = opNode.args[1 - i];
      let unwrappedTarget = target;
      while (unwrappedTarget.type === 'ParenthesisNode') {
        unwrappedTarget = (unwrappedTarget as math.ParenthesisNode).content;
      }
      if (
        unwrappedTarget.type === 'SymbolNode' &&
        (unwrappedTarget as math.SymbolNode).name === solveVar
      ) {
        return { category: 'b', coeff };
      }
    }
  }

  // Check if it's solveVar directly
  let unwrapped = node;
  while (unwrapped.type === 'ParenthesisNode') unwrapped = (unwrapped as math.ParenthesisNode).content;
  if (unwrapped.type === 'SymbolNode' && (unwrapped as math.SymbolNode).name === solveVar) {
    return { category: 'b', coeff: new math.ConstantNode(1) };
  }

  return null;
};

const isZeroNode = (node: math.MathNode): boolean => {
  let curr = node;
  while (curr.type === 'ParenthesisNode') curr = (curr as math.ParenthesisNode).content;
  return curr.type === 'ConstantNode' && Number((curr as math.ConstantNode).value) === 0;
};

const sumTerms = (list: SignedTerm[]): math.MathNode => {
  const filtered = list.filter(item => !isZeroNode(item.node));
  if (filtered.length === 0) return new math.ConstantNode(0);
  let acc: math.MathNode = filtered[0].sign === -1
    ? new math.OperatorNode('-', 'unaryMinus', [filtered[0].node])
    : filtered[0].node;

  for (let i = 1; i < filtered.length; i++) {
    const item = filtered[i];
    if (item.sign === 1) {
      acc = new math.OperatorNode('+', 'add', [acc, item.node]);
    } else {
      acc = new math.OperatorNode('-', 'subtract', [acc, item.node]);
    }
  }
  return acc;
};

const tryExtractQuadratic = (lhs: math.MathNode, rhs: math.MathNode, solveVar: string) => {
  const fullExpr = new math.OperatorNode('-', 'subtract', [lhs, rhs]);
  const terms: SignedTerm[] = [];
  collectTerms(fullExpr, 1, terms);

  const aList: SignedTerm[] = [];
  const bList: SignedTerm[] = [];
  const cList: SignedTerm[] = [];

  for (const t of terms) {
    const cat = getTermCategory(t.node, solveVar);
    if (!cat) return null; // Contains unsupported term structure (e.g. solveVar^3)
    if (cat.category === 'a') {
      aList.push({ node: cat.coeff, sign: t.sign });
    } else if (cat.category === 'b') {
      bList.push({ node: cat.coeff, sign: t.sign });
    } else {
      cList.push({ node: cat.coeff, sign: t.sign });
    }
  }

  if (aList.length === 0) return null; // No quadratic term

  const a = sumTerms(aList);
  const b = sumTerms(bList);
  const c = sumTerms(cList);

  return { a, b, c };
};

export interface QuadraticFormulaSolutions {
  solveVar: string;
  pos: Equation;
  neg: Equation;
}

export const getQuadraticFormulaSolutions = (eq: Equation): QuadraticFormulaSolutions[] => {
  const vars1 = getVariables(eq.lhs).concat(getVariables(eq.rhs));
  const vars = Array.from(new Set(vars1));
  const solutions: QuadraticFormulaSolutions[] = [];

  for (const solveVar of vars) {
    const coeffs = tryExtractQuadratic(eq.lhs, eq.rhs, solveVar);
    if (coeffs) {
      const { a, b, c } = coeffs;

      // Skip the quadratic formula when b=0 (no linear term).
      // When b=0, the equation reduces to ax² = -c, which is solvable by
      // simple isolation and square root — the pedagogically correct approach.
      if (isZeroNode(b)) continue;

      const b_sq = new math.OperatorNode('^', 'pow', [b, new math.ConstantNode(2)]);
      const four_a = new math.OperatorNode('*', 'multiply', [new math.ConstantNode(4), a]);
      const four_a_c = new math.OperatorNode('*', 'multiply', [four_a, c]);
      const discriminant = new math.OperatorNode('-', 'subtract', [b_sq, four_a_c]);
      const sqrt_d = new math.FunctionNode('sqrt', [discriminant]);

      let num_pos: math.MathNode;
      let num_neg: math.MathNode;
      if (isZeroNode(b)) {
        num_pos = sqrt_d;
        num_neg = new math.OperatorNode('-', 'unaryMinus', [sqrt_d]);
      } else {
        const neg_b = new math.OperatorNode('-', 'unaryMinus', [b]);
        num_pos = new math.OperatorNode('+', 'add', [neg_b, sqrt_d]);
        num_neg = new math.OperatorNode('-', 'subtract', [neg_b, sqrt_d]);
      }

      const two_a = new math.OperatorNode('*', 'multiply', [new math.ConstantNode(2), a]);
      
      const formula_pos = new math.OperatorNode('/', 'divide', [
        new math.ParenthesisNode(num_pos),
        new math.ParenthesisNode(two_a)
      ]);
      const formula_neg = new math.OperatorNode('/', 'divide', [
        new math.ParenthesisNode(num_neg),
        new math.ParenthesisNode(two_a)
      ]);

      const varNode = new math.SymbolNode(solveVar);

      // Determine where the quadratic was located (mostly on LHS or RHS)
      const lhsHasQuadratic = hasVariable(eq.lhs, solveVar);
      
      let posEq: Equation;
      let negEq: Equation;

      if (lhsHasQuadratic) {
        posEq = ensureNodeIds({ lhs: varNode, rhs: formula_pos });
        negEq = ensureNodeIds({ lhs: varNode, rhs: formula_neg });
      } else {
        posEq = ensureNodeIds({ lhs: formula_pos, rhs: varNode });
        negEq = ensureNodeIds({ lhs: formula_neg, rhs: varNode });
      }

      solutions.push({
        solveVar,
        pos: posEq,
        neg: negEq
      });
    }
  }

  return solutions;
};

/**
 * Maps a path from the temporary equation (after source node is removed)
 * back to the corresponding node path in the original equation.
 */
export const mapPathTempToOrig = (
  originalEq: Equation,
  sourcePath: string,
  targetPath: string
): string => {
  const sParts = sourcePath.split('/');
  const tParts = targetPath.split('/');

  if (sParts[0] !== tParts[0] || sParts.length === 1) {
    return targetPath;
  }

  const parentLength = sParts.length - 1;
  const parentPath = sParts.slice(0, parentLength).join('/');

  // Check if targetPath starts with parentPath
  let startsWithParent = true;
  if (tParts.length < parentLength) {
    startsWithParent = false;
  } else {
    for (let i = 0; i < parentLength; i++) {
      if (sParts[i] !== tParts[i]) {
        startsWithParent = false;
        break;
      }
    }
  }

  if (!startsWithParent) {
    return targetPath;
  }

  const parentNode = getNodeByPath(originalEq, parentPath);
  const children = getChildren(parentNode);
  const idxToRemove = parseInt(sParts[parentLength], 10);

  if (children.length === 2) {
    // Binary node: removing one child returns the other.
    // The remaining child (which was at parentPath / remainingIdx) is now at parentPath in tempEq.
    const remainingIdx = idxToRemove === 0 ? 1 : 0;
    const rest = tParts.slice(parentLength);
    return [parentPath, remainingIdx.toString(), ...rest].join('/');
  } else if (children.length === 1) {
    // Unary node: removing child returns 0.
    return targetPath;
  } else {
    // N-ary node: filter out idxToRemove
    const rest = tParts.slice(parentLength);
    if (rest.length === 0) {
      return targetPath;
    }
    const idxInTemp = parseInt(rest[0], 10);
    const origIdx = idxInTemp >= idxToRemove ? idxInTemp + 1 : idxInTemp;
    return [parentPath, origIdx.toString(), ...rest.slice(1)].join('/');
  }
};

/**
 * Generates all mathematically valid target equations for a selected node.
 * Maps destination path string to the resulting Equation.
 */
export const generateValidMoves = (originalEq: Equation, sourcePath: string): Record<string, Equation> => {
  const moves: Record<string, Equation> = {};

  try {
    // IMPORTANT: Check draggability FIRST. If the node is inside a power or function node,
    // it cannot be dragged and should not trigger any moves — including the quadratic formula.
    // The quadratic formula is still offered through the reduction/identity system (getReducibleOptions).
    if (!isPathDraggable(originalEq, sourcePath)) {
      return moves;
    }

    // Check if the selected node is a variable that can be solved via the quadratic formula
    const selectedNode = getNodeByPath(originalEq, sourcePath);
    if (selectedNode.type === 'SymbolNode') {
      const solveVar = (selectedNode as math.SymbolNode).name;
      const coeffs = tryExtractQuadratic(originalEq.lhs, originalEq.rhs, solveVar);
      if (coeffs) {
        const { a, b, c } = coeffs;

        // Skip the quadratic formula when b=0 (no linear term).
        // When b=0, the equation is solvable by isolation + square root.
        if (!isZeroNode(b)) {

        const b_sq = new math.OperatorNode('^', 'pow', [b, new math.ConstantNode(2)]);
        const four_a = new math.OperatorNode('*', 'multiply', [new math.ConstantNode(4), a]);
        const four_a_c = new math.OperatorNode('*', 'multiply', [four_a, c]);
        const discriminant = new math.OperatorNode('-', 'subtract', [b_sq, four_a_c]);
        const sqrt_d = new math.FunctionNode('sqrt', [discriminant]);

        let num_pos: math.MathNode;
        if (isZeroNode(b)) {
          num_pos = sqrt_d;
        } else {
          const neg_b = new math.OperatorNode('-', 'unaryMinus', [b]);
          num_pos = new math.OperatorNode('+', 'add', [neg_b, sqrt_d]);
        }

        const two_a = new math.OperatorNode('*', 'multiply', [new math.ConstantNode(2), a]);
        const formula_pos = new math.OperatorNode('/', 'divide', [
          new math.ParenthesisNode(num_pos),
          new math.ParenthesisNode(two_a)
        ]);

        const varNode = new math.SymbolNode(solveVar);

        if (sourcePath.startsWith('lhs')) {
          moves['rhs'] = ensureNodeIds({ lhs: varNode, rhs: formula_pos });
        } else {
          moves['lhs'] = ensureNodeIds({ lhs: formula_pos, rhs: varNode });
        }

        return moves; // Return early with the quadratic formula solve move!
        }
      }
    }

    const { newEquation: tempEq, removedNode } = removeNodeAtPath(originalEq, sourcePath);
    const targetPaths = getAllPaths(tempEq);
    const excludedParents = getExcludedParentPaths(originalEq, sourcePath);

    targetPaths.forEach((targetPath) => {
      if (excludedParents.has(targetPath)) {
        return;
      }

      // Strictly exclude moving a node onto itself
      if (targetPath === sourcePath) {
        return;
      }

      // If it's a cross-equals move, the target path must be the root of the destination side
      const isCrossEquals = (
        (sourcePath.startsWith('lhs') && targetPath.startsWith('rhs')) ||
        (sourcePath.startsWith('rhs') && targetPath.startsWith('lhs'))
      );
      if (isCrossEquals && targetPath !== 'lhs' && targetPath !== 'rhs') {
        return;
      }

      const targetNode = getNodeByPath(tempEq, targetPath);

      // Declared as const to satisfy TypeScript operator union types
      const ops = ['+', '-', '*', '/'] as const;

      ops.forEach((op) => {
        // Cast via never to satisfy very specific types of OperatorNodeMap in mathjs
        const nodeStandard = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [targetNode, removedNode]);
        const eqStandard = replaceNodeAtPath(tempEq, targetPath, nodeStandard);
        
        const isNoOpStandard = (
          originalEq.lhs.toString() === eqStandard.lhs.toString() &&
          originalEq.rhs.toString() === eqStandard.rhs.toString()
        );

        let isEquivalentStandard = false;
        if (!isNoOpStandard) {
          try {
            const paramVar = new math.SymbolNode('__y');
            const targetPathInOrig = mapPathTempToOrig(originalEq, sourcePath, targetPath);
            const originalEqParam = replaceNodeAtPath(originalEq, targetPathInOrig, paramVar);

            const nodeStandardParam = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [paramVar, removedNode]);
            const eqStandardParam = replaceNodeAtPath(tempEq, targetPath, nodeStandardParam);

            isEquivalentStandard = areEquationsEquivalent(originalEqParam, eqStandardParam);
          } catch (e) {
            isEquivalentStandard = areEquationsEquivalent(originalEq, eqStandard);
          }
        }

        if (!isNoOpStandard && isEquivalentStandard) {
          moves[targetPath] = eqStandard;
        }

        if (op === '-' || op === '/') {
          const nodeReverse = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [removedNode, targetNode]);
          const eqReverse = replaceNodeAtPath(tempEq, targetPath, nodeReverse);
          
          const isNoOpReverse = (
            originalEq.lhs.toString() === eqReverse.lhs.toString() &&
            originalEq.rhs.toString() === eqReverse.rhs.toString()
          );

          let isEquivalentReverse = false;
          if (!isNoOpReverse) {
            try {
              const paramVar = new math.SymbolNode('__y');
              const targetPathInOrig = mapPathTempToOrig(originalEq, sourcePath, targetPath);
              const originalEqParam = replaceNodeAtPath(originalEq, targetPathInOrig, paramVar);

              const nodeReverseParam = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [removedNode, paramVar]);
              const eqReverseParam = replaceNodeAtPath(tempEq, targetPath, nodeReverseParam);

              isEquivalentReverse = areEquationsEquivalent(originalEqParam, eqReverseParam);
            } catch (e) {
              isEquivalentReverse = areEquationsEquivalent(originalEq, eqReverse);
            }
          }

          if (!isNoOpReverse && isEquivalentReverse) {
            moves[targetPath] = eqReverse;
          }
        }
      });

      // Direct replacement is only valid if we are overwriting a neutral constant (0 or 1)
      if (isNeutralNode(targetNode)) {
        const eqDirect = replaceNodeAtPath(tempEq, targetPath, removedNode);
        
        const isNoOpDirect = (
          originalEq.lhs.toString() === eqDirect.lhs.toString() &&
          originalEq.rhs.toString() === eqDirect.rhs.toString()
        );

        if (!isNoOpDirect && areEquationsEquivalent(originalEq, eqDirect)) {
          moves[targetPath] = eqDirect;
        }
      }
    });
  } catch (err) {
    console.error('Error generating valid moves:', err);
  }

  return moves;
};
