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
 * Recursively evaluates a mathjs node to a single number (point evaluation).
 */
export const evaluatePoint = (node: math.MathNode, scope: Record<string, number>): number => {
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
      if (opNode.op === '-') return -args[0];
      if (opNode.op === '+') return args[0];
    } else {
      const [left, right] = args;
      if (opNode.op === '+') return left + right;
      if (opNode.op === '-') return left - right;
      if (opNode.op === '*') return left * right;
      if (opNode.op === '/') return left / right;
      if (opNode.op === '^') return Math.pow(left, right);
    }
  }
  if (node.type === 'FunctionNode') {
    const funcNode = node as math.FunctionNode;
    const args = funcNode.args.map((arg) => evaluatePoint(arg, scope));
    const nameStr = getFunctionName(funcNode);

    if (nameStr === 'sqrt') return Math.sqrt(args[0]);
    if (nameStr === 'sin') return Math.sin(args[0]);
    if (nameStr === 'cos') return Math.cos(args[0]);
    if (nameStr === 'log') return Math.log(args[0]);
  }
  throw new Error(`Unsupported point node type: ${node.type}`);
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
  }
  throw new Error(`Unsupported interval node type: ${node.type}`);
};

/**
 * Numerically solves LHS - RHS = 0 for a specific variable using Newton-Raphson.
 * Returns the root value or null if it fails to converge.
 */
export const solveForVariable = (
  nodeLHS: math.MathNode,
  nodeRHS: math.MathNode,
  solveVar: string,
  scope: Record<string, number>
): number | null => {
  const f = (x: number): number => {
    const localScope = { ...scope, [solveVar]: x };
    return evaluatePoint(nodeLHS, localScope) - evaluatePoint(nodeRHS, localScope);
  };

  let x = 1.0; // Initial guess
  const maxIterations = 20;
  const tolerance = 1e-10;
  const h = 1e-5;

  for (let i = 0; i < maxIterations; i++) {
    const y = f(x);
    if (isNaN(y) || !isFinite(y)) {
      return null;
    }
    if (Math.abs(y) < tolerance) {
      return x;
    }
    const dy = (f(x + h) - f(x - h)) / (2 * h);
    if (Math.abs(dy) < 1e-12) {
      x += 1.5; // Shift guess if derivative is zero
      continue;
    }
    x = x - y / dy;
  }

  if (Math.abs(f(x)) < 1e-7) {
    return x;
  }
  return null;
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
  let solved = false;
  for (const solveVar of variables) {
    const root = solveForVariable(eqSource.lhs, eqSource.rhs, solveVar, { ...scope });
    if (root !== null) {
      scope[solveVar] = root;
      solved = true;
      break;
    }
  }

  if (!solved) {
    // Fallback for constant equations or equations with no real roots on the domain
    const d1 = evaluatePoint(eqSource.lhs, scope) - evaluatePoint(eqSource.rhs, scope);
    const d2 = evaluatePoint(eqTarget.lhs, scope) - evaluatePoint(eqTarget.rhs, scope);
    if (isNaN(d1) || isNaN(d2) || !isFinite(d1) || !isFinite(d2)) {
      return false;
    }
    return Math.abs(d1 - d2) <= POINT_TOLERANCE;
  }

  // Check if eqTarget is satisfied at this root
  const dTarget = evaluatePoint(eqTarget.lhs, scope) - evaluatePoint(eqTarget.rhs, scope);
  return !isNaN(dTarget) && isFinite(dTarget) && Math.abs(dTarget) <= 1e-6;
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

      // 1. Check if root of eq1 satisfies eq2
      if (!isEquationSatisfiedAtRoot(eq1, eq2, variables, { ...scope })) {
        return false;
      }

      // 2. Check if root of eq2 satisfies eq1
      if (!isEquationSatisfiedAtRoot(eq2, eq1, variables, { ...scope })) {
        return false;
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
 * Generates all mathematically valid target equations for a selected node.
 * Maps destination path string to the resulting Equation.
 */
export const generateValidMoves = (originalEq: Equation, sourcePath: string): Record<string, Equation> => {
  const moves: Record<string, Equation> = {};

  try {
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

        if (!isNoOpStandard && areEquationsEquivalent(originalEq, eqStandard)) {
          moves[targetPath] = eqStandard;
        }

        if (op === '-' || op === '/') {
          const nodeReverse = new math.OperatorNode(op as never, OP_TO_FN[op] as never, [removedNode, targetNode]);
          const eqReverse = replaceNodeAtPath(tempEq, targetPath, nodeReverse);
          
          const isNoOpReverse = (
            originalEq.lhs.toString() === eqReverse.lhs.toString() &&
            originalEq.rhs.toString() === eqReverse.rhs.toString()
          );

          if (!isNoOpReverse && areEquationsEquivalent(originalEq, eqReverse)) {
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
