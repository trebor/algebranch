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
  RelationOperator,
  flipRelation,
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

// Inequality region sampling: points are drawn symmetrically about zero so both
// sides of a solution boundary are exercised. Samples within REGION_BOUNDARY_SKIP
// of a boundary are ignored (their truth value is dominated by float error), and
// equivalence requires at least REGION_MIN_VALID_SAMPLES agreeing samples.
const REGION_SAMPLE_RANGE = 8.0;
const REGION_SAMPLE_COUNT = 48;
const REGION_BOUNDARY_SKIP = 1e-6;
const REGION_MIN_VALID_SAMPLES = 6;
// Relative tolerance for deciding two signed gaps (lhs - rhs) coincide, used only
// for the degenerate constant-inequality fallback below.
const REGION_GAP_TOLERANCE = 1e-6;

// Relation strictness classes — equivalent inequalities must share a class (a
// strict `<` is never equivalent to a non-strict `<=`, regardless of region).
const RELATION_CLASS: Record<RelationOperator, 'eq' | 'strict' | 'nonstrict'> = {
  '=': 'eq',
  '<': 'strict',
  '>': 'strict',
  '<=': 'nonstrict',
  '>=': 'nonstrict',
};

// Whether a relation points "less-than"; away from the boundary this fully
// determines satisfaction, so strict/non-strict need not be distinguished here.
const RELATION_IS_LESS: Record<string, boolean> = { '<': true, '<=': true };

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
  const visit = (n: math.MathNode) => {
    if (!n) return;
    if (n.type === 'SymbolNode') {
      const name = (n as math.SymbolNode).name;
      if (name !== 'pi' && name !== 'e') {
        vars.add(name);
      }
      return;
    }
    if (n.type === 'FunctionNode') {
      (n as math.FunctionNode).args.forEach(visit);
      return;
    }
    getChildren(n).forEach(visit);
  };
  visit(node);
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
 * Tests whether two EXPRESSIONS are value-equal for all variable assignments (a
 * local identity, e.g. `x + 0` vs `x`), by sampling several points. This is
 * stronger than equation equivalence (same solution set): `A / 5` and `A` share
 * roots when the other side is 0 but are NOT value-equal. Used to gate
 * node-removal "simplifications" so they reflect a genuine local identity rather
 * than an equation-structure coincidence (#33). Sample points avoid 0 to dodge
 * spurious division-by-zero; undefined samples are skipped.
 */
export const areExpressionsValueEqual = (a: math.MathNode, b: math.MathNode): boolean => {
  const vars = Array.from(new Set([...getVariables(a), ...getVariables(b)]));
  let validSamples = 0;
  for (let i = 0; i < 8; i++) {
    const scope: Record<string, number> = {};
    vars.forEach((v, idx) => { scope[v] = 0.7 + i * 1.3 + idx * 0.5; });
    try {
      const va = evaluatePoint(a, scope);
      const vb = evaluatePoint(b, scope);
      const diff = Number(math.abs(math.subtract(va, vb)));
      const mag = Number(math.abs(va));
      if (isValNaN(diff) || !isValFinite(diff) || isValNaN(mag) || !isValFinite(mag)) continue;
      validSamples++;
      if (diff > 1e-6 * (1 + mag)) return false;
    } catch {
      continue;
    }
  }
  return validSamples >= 2;
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
export const areEquationsEquivalentInterval = (
  eq1: Equation,
  eq2: Equation,
  variables: string[]
): 'equivalent' | 'different' | 'inconclusive' => {
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
        return 'inconclusive';
      }

      const d1 = subInterval(lhs1, rhs1);
      const d2 = subInterval(lhs2, rhs2);

      const diff = subInterval(d1, d2);
      if (diff.min > INTERVAL_TOLERANCE || diff.max < -INTERVAL_TOLERANCE) {
        return 'different';
      }
    }
    return 'equivalent';
  } catch {
    return 'inconclusive';
  }
};

/**
 * Tests whether two inequalities carve out the same solution region, by sampling
 * random points and comparing the truth value of each (away from boundaries,
 * where float error dominates). Assumes both relations are inequalities of the
 * same strictness class.
 */
const areInequalityRegionsEquivalent = (
  eq1: Equation,
  eq2: Equation,
  variables: string[],
  rel1: RelationOperator,
  rel2: RelationOperator
): boolean => {
  const satisfies = (diff: number, relation: RelationOperator): boolean =>
    RELATION_IS_LESS[relation] ? diff < 0 : diff > 0;

  let validSamples = 0;
  let finiteSamples = 0;
  let gapsCoincide = true; // whether the signed gaps (lhs - rhs) match at every point
  for (let i = 0; i < REGION_SAMPLE_COUNT; i++) {
    const scope: Record<string, number> = {};
    variables.forEach((v) => {
      scope[v] = (Math.random() * 2 - 1) * REGION_SAMPLE_RANGE;
    });

    let d1: number;
    let d2: number;
    try {
      d1 = Number(math.subtract(evaluatePoint(eq1.lhs, scope), evaluatePoint(eq1.rhs, scope)));
      d2 = Number(math.subtract(evaluatePoint(eq2.lhs, scope), evaluatePoint(eq2.rhs, scope)));
    } catch {
      continue;
    }

    if (!Number.isFinite(d1) || !Number.isFinite(d2)) continue;

    finiteSamples++;
    if (Math.abs(d1 - d2) > REGION_GAP_TOLERANCE * (1 + Math.abs(d1))) {
      gapsCoincide = false;
    }

    if (Math.abs(d1) < REGION_BOUNDARY_SKIP || Math.abs(d2) < REGION_BOUNDARY_SKIP) continue;

    validSamples++;
    if (satisfies(d1, rel1) !== satisfies(d2, rel2)) {
      return false;
    }
  }

  if (validSamples >= REGION_MIN_VALID_SAMPLES) return true;

  // Degenerate case: the two sides coincide at (almost) every point, so the gap is
  // ~0 everywhere and there are no off-boundary samples to compare (e.g. a fold
  // like `-(-3) * -1 > 3 * -1` vs `-3 > -3`). Such inequalities are constant-valued;
  // with a shared strictness class, identical signed gaps mean identical truth.
  return finiteSamples >= REGION_MIN_VALID_SAMPLES && gapsCoincide;
};

/**
 * Fast two-stage validation check for equation/inequality equivalence.
 *
 * Equality is handled by the interval + root-matching solver. Inequalities must
 * (1) share a strictness class, (2) have coincident boundaries (the `=` form is
 * checked with the same solver), and (3) define the same solution region
 * (sampled). A relation/strictness-class mismatch short-circuits to false.
 */
export const areEquationsEquivalent = (eq1: Equation, eq2: Equation): boolean => {
  const rel1 = eq1.relation ?? '=';
  const rel2 = eq2.relation ?? '=';

  if (RELATION_CLASS[rel1] !== RELATION_CLASS[rel2]) {
    return false;
  }

  const vars1 = getVariables(eq1.lhs).concat(getVariables(eq1.rhs));
  const vars2 = getVariables(eq2.lhs).concat(getVariables(eq2.rhs));
  const variables = Array.from(new Set(vars1.concat(vars2)));

  if (variables.length === 0) {
    variables.push('x');
  }

  if (rel1 === '=') {
    const isWithinFormula = (
      eq1.lhs.toString() === eq2.lhs.toString() ||
      eq1.rhs.toString() === eq2.rhs.toString()
    );

    if (isWithinFormula) {
      const intervalResult = areEquationsEquivalentInterval(eq1, eq2, variables);
      if (intervalResult === 'different') {
        return false;
      }
    }

    return areEquationsEquivalentPoint(eq1, eq2, variables);
  }

  // Inequality: boundaries must coincide (checked on the `=` form) and the
  // solution regions must agree at sampled points.
  const boundary1: Equation = { lhs: eq1.lhs, rhs: eq1.rhs, relation: '=' };
  const boundary2: Equation = { lhs: eq2.lhs, rhs: eq2.rhs, relation: '=' };
  if (!areEquationsEquivalentPoint(boundary1, boundary2, variables)) {
    return false;
  }

  return areInequalityRegionsEquivalent(eq1, eq2, variables, rel1, rel2);
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

/**
 * Extract the quadratic coefficients {a, b, c} of a single expression in
 * `solveVar`, where the expression is read as a·solveVar² + b·solveVar + c.
 * Returns the coefficients as MathNodes, or null when the expression isn't a
 * quadratic in `solveVar` (no squared term, or an unsupported term like
 * solveVar³). Used both by the quadratic formula (over lhs − rhs) and by
 * completing the square (over a bare expression node) — #62.
 */
export const tryExtractQuadraticExpr = (expr: math.MathNode, solveVar: string) => {
  const terms: SignedTerm[] = [];
  collectTerms(expr, 1, terms);

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

const tryExtractQuadratic = (lhs: math.MathNode, rhs: math.MathNode, solveVar: string) => {
  const fullExpr = new math.OperatorNode('-', 'subtract', [lhs, rhs]);
  return tryExtractQuadraticExpr(fullExpr, solveVar);
};

/**
 * Append one `coeff · varPart` term (or a bare constant when `varPart` is null)
 * to a SignedTerm list, lifting the sign out of the coefficient and eliding a
 * unit coefficient so `1·x²` renders as `x²`. Zero coefficients are skipped.
 */
const pushStandardTerm = (
  list: SignedTerm[],
  coeff: math.MathNode,
  varPart: math.MathNode | null
) => {
  if (isZeroNode(coeff)) return;

  let sign = 1;
  let mag: math.MathNode = coeff;
  if (
    coeff.type === 'OperatorNode' &&
    (coeff as math.OperatorNode).fn === 'unaryMinus'
  ) {
    sign = -1;
    mag = (coeff as math.OperatorNode).args[0];
  } else if (
    coeff.type === 'ConstantNode' &&
    Number((coeff as math.ConstantNode).value) < 0
  ) {
    sign = -1;
    mag = new math.ConstantNode(Math.abs(Number((coeff as math.ConstantNode).value)));
  }

  const isUnit =
    mag.type === 'ConstantNode' && Number((mag as math.ConstantNode).value) === 1;

  let node: math.MathNode;
  if (!varPart) {
    node = mag; // constant term
  } else if (isUnit) {
    node = varPart; // 1·x² → x²
  } else {
    node = new math.OperatorNode('*', 'multiply', [mag, varPart]);
  }
  list.push({ node, sign });
};

/**
 * #90 — Produce the standard-form normalization `a·v² + b·v + c = 0` for a
 * quadratic in `solveVar` that is NOT already written with one side equal to
 * zero, so the `= 0` step (where a, b, c are read off) is inspectable rather
 * than hidden inside the quadratic-formula jump.
 *
 * Returns null when the equation is already in `= 0` standard form (exactly one
 * side is zero — apply the formula directly), when it isn't a quadratic in
 * `solveVar`, or when there's no linear term (b = 0) — the latter is solved by
 * isolation + square root rather than the formula, mirroring
 * getQuadraticFormulaSolutions.
 *
 * The trinomial is built on the side that currently holds the variable (the
 * other side becoming 0), with unit coefficients elided and zero terms dropped,
 * so the result reads as conventional standard form.
 */
export const getQuadraticStandardForm = (eq: Equation, solveVar: string): Equation | null => {
  const lhsZero = isZeroNode(eq.lhs);
  const rhsZero = isZeroNode(eq.rhs);
  // Exactly one side already zero ⇒ already in standard form; nothing to surface.
  if (lhsZero !== rhsZero) return null;

  // Read the coefficients off the side that holds the variable (var-side minus
  // the other side) so the standard form keeps its natural signs whichever side
  // the quadratic sits on, rather than negating when it's on the RHS.
  const varOnLhs = hasVariable(eq.lhs, solveVar);
  const coeffs = varOnLhs
    ? tryExtractQuadratic(eq.lhs, eq.rhs, solveVar)
    : tryExtractQuadratic(eq.rhs, eq.lhs, solveVar);
  if (!coeffs) return null;
  const { a, b, c } = coeffs;
  if (isZeroNode(a)) return null; // not actually quadratic in solveVar
  if (isZeroNode(b)) return null; // no linear term ⇒ square-root path, not the formula

  const varNode = new math.SymbolNode(solveVar);
  const varSq = new math.OperatorNode('^', 'pow', [varNode, new math.ConstantNode(2)]);

  const terms: SignedTerm[] = [];
  pushStandardTerm(terms, a, varSq);
  pushStandardTerm(terms, b, varNode);
  pushStandardTerm(terms, c, null);
  const quadratic = sumTerms(terms);

  const zero = new math.ConstantNode(0);
  const eqOut = varOnLhs
    ? { lhs: quadratic, rhs: zero }
    : { lhs: zero, rhs: quadratic };
  return ensureNodeIds(eqOut);
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

    // NOTE: The quadratic formula is intentionally NOT offered here as a drag move.
    // Dragging a variable should only generate standard transposition moves; the
    // quadratic formula (both roots) is offered exclusively via the equation-level
    // reduction/identity system (getReducibleOptions in simplify.ts). See issue #89.

    const { newEquation: tempEq, removedNode } = removeNodeAtPath(originalEq, sourcePath);
    const targetPaths = getAllPaths(tempEq);
    const excludedParents = getExcludedParentPaths(originalEq, sourcePath);

    // For inequalities, each transposition is tested with both the original and
    // the flipped relation; the equivalence validator keeps the mathematically
    // correct direction (e.g. dividing by a negative flips `<` to `>`) and
    // rejects the other. Equalities only ever test the inherited relation.
    const isInequality = !!originalEq.relation && originalEq.relation !== '=';
    const relationVariants: RelationOperator[] = isInequality
      ? [originalEq.relation as RelationOperator, flipRelation(originalEq.relation)]
      : ['='];

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

      // Parametrized original: the target subtree is replaced with a free symbol
      // so a move is validated as an identity over an arbitrary operand, not a
      // coincidence of the specific value. null if the path can't be mapped.
      const paramVar = new math.SymbolNode('__y');
      let originalEqParam: Equation | null = null;
      try {
        const targetPathInOrig = mapPathTempToOrig(originalEq, sourcePath, targetPath);
        originalEqParam = replaceNodeAtPath(originalEq, targetPathInOrig, paramVar);
      } catch {
        originalEqParam = null;
      }

      // Records the candidate under the first relation variant the validator
      // accepts. `candidateParamEq` (the parametrized form) is preferred; when it
      // can't be built we fall back to validating the concrete candidate.
      const tryAddMove = (candidateEq: Equation, candidateParamEq: Equation | null): void => {
        for (const rel of relationVariants) {
          const candRel: Equation = isInequality ? { ...candidateEq, relation: rel } : candidateEq;
          const isNoOp = (
            originalEq.lhs.toString() === candRel.lhs.toString() &&
            originalEq.rhs.toString() === candRel.rhs.toString() &&
            (originalEq.relation ?? '=') === rel
          );
          if (isNoOp) continue;

          let isEquivalent = false;
          try {
            if (candidateParamEq && originalEqParam) {
              const paramRel: Equation = isInequality ? { ...candidateParamEq, relation: rel } : candidateParamEq;
              isEquivalent = areEquationsEquivalent(originalEqParam, paramRel);
            } else {
              isEquivalent = areEquationsEquivalent(originalEq, candRel);
            }
          } catch {
            isEquivalent = areEquationsEquivalent(originalEq, candRel);
          }

          if (isEquivalent) {
            moves[targetPath] = candRel;
            return;
          }
        }
      };

      // Declared as const to satisfy TypeScript operator union types
      const ops = ['+', '-', '*', '/'] as const;

      ops.forEach((op) => {
        // Cast via never to satisfy very specific types of OperatorNodeMap in mathjs
        const nodeStandard = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [targetNode, removedNode]);
        const eqStandard = replaceNodeAtPath(tempEq, targetPath, nodeStandard);

        let eqStandardParam: Equation | null = null;
        if (originalEqParam) {
          try {
            const nodeStandardParam = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [paramVar, removedNode]);
            eqStandardParam = replaceNodeAtPath(tempEq, targetPath, nodeStandardParam);
          } catch {
            eqStandardParam = null;
          }
        }
        tryAddMove(eqStandard, eqStandardParam);

        if (op === '-' || op === '/') {
          const nodeReverse = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [removedNode, targetNode]);
          const eqReverse = replaceNodeAtPath(tempEq, targetPath, nodeReverse);

          let eqReverseParam: Equation | null = null;
          if (originalEqParam) {
            try {
              const nodeReverseParam = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [removedNode, paramVar]);
              eqReverseParam = replaceNodeAtPath(tempEq, targetPath, nodeReverseParam);
            } catch {
              eqReverseParam = null;
            }
          }
          tryAddMove(eqReverse, eqReverseParam);
        }
      });

      // Direct replacement is only valid if we are overwriting a neutral constant (0 or 1)
      if (isNeutralNode(targetNode)) {
        const eqDirect = replaceNodeAtPath(tempEq, targetPath, removedNode);
        tryAddMove(eqDirect, null);
      }
    });
  } catch (err) {
    console.error('Error generating valid moves:', err);
  }

  return moves;
};

/**
 * Represents the truth status of an equation.
 * - 'contradiction': the equation contains no variables and simplifies to a false statement (e.g. 3 = -3 or 5 < 2).
 * - 'identity': the equation contains no variables and simplifies to a true statement (e.g. 0 = 0 or 1 < 3).
 * - 'conditional': the equation contains variables and its truth value depends on them (e.g. x = 3).
 */
export type EquationStatus = 'contradiction' | 'identity' | 'conditional';

/**
 * Evaluates a variable-free equation to determine if it is a contradiction, identity, or conditional.
 */
export const getEquationStatus = (eq: Equation): EquationStatus => {
  const vars = new Set<string>([
    ...getVariables(eq.lhs),
    ...getVariables(eq.rhs),
  ]);

  if (vars.size > 0) {
    return 'conditional';
  }

  try {
    const lhsVal = eq.lhs.compile().evaluate();
    const rhsVal = eq.rhs.compile().evaluate();
    const relation = eq.relation || '=';

    const cmp = math.compare(lhsVal, rhsVal) as number;
    if (relation === '=') return cmp === 0 ? 'identity' : 'contradiction';
    if (relation === '<') return cmp < 0 ? 'identity' : 'contradiction';
    if (relation === '>') return cmp > 0 ? 'identity' : 'contradiction';
    if (relation === '<=') return cmp <= 0 ? 'identity' : 'contradiction';
    if (relation === '>=') return cmp >= 0 ? 'identity' : 'contradiction';
  } catch (err) {
    console.error('Failed to evaluate constant equation:', err);
  }

  return 'conditional';
};

