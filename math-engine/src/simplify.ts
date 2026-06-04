import * as math from 'mathjs';
import { Equation, getAllPaths, removeNodeAtPath, getNodeByPath, replaceNodeAtPath, ensureNodeIds } from './tree';
import { areEquationsEquivalent, getFunctionName } from './validator';

/**
 * Counts the total number of nodes in a mathematical syntax tree.
 */
const countNodes = (node: math.MathNode): number => {
  let count = 0;
  node.traverse((n) => {
    if (n.type !== 'ParenthesisNode') {
      count++;
    }
  });
  return count;
};

/**
 * Tries to remove a single node at path 'p' from the equation.
 * Returns the new equation if successful, otherwise null.
 */
export const trySingleRemoval = (eq: Equation, p: string): Equation | null => {
  try {
    const { newEquation } = removeNodeAtPath(eq, p);
    return newEquation;
  } catch {
    return null;
  }
};

/**
 * Tries to remove a pair of nodes at paths 'p1' and 'p2'.
 * Sorts them by depth (deeper first) to ensure path indices remain valid.
 * Returns the new equation if successful, otherwise null.
 */
export const tryDoubleRemoval = (eq: Equation, p1: string, p2: string): Equation | null => {
  try {
    // Sort paths descending by length (number of slashes) so we remove deeper nodes first
    const sortedPaths = [p1, p2].sort((a, b) => b.split('/').length - a.split('/').length);

    // Remove the first (deeper) node
    const res1 = removeNodeAtPath(eq, sortedPaths[0]);

    // Check if the second path is still valid in the new tree
    const currentPaths = getAllPaths(res1.newEquation);
    if (currentPaths.includes(sortedPaths[1])) {
      const res2 = removeNodeAtPath(res1.newEquation, sortedPaths[1]);
      return res2.newEquation;
    }
  } catch {
    // Graceful fallback for any traversal misalignment
  }
  return null;
};

/**
 * Checks recursively if a mathjs node is a subtree containing only constants (no variables).
 */
export const isConstantSubtree = (node: math.MathNode): boolean => {
  if (node.type === 'ConstantNode') return true;
  if (node.type === 'SymbolNode') {
    const name = (node as math.SymbolNode).name;
    return name === 'pi' || name === 'e';
  }
  if (node.type === 'ParenthesisNode') {
    return isConstantSubtree((node as math.ParenthesisNode).content);
  }
  if (node.type === 'OperatorNode') {
    return (node as math.OperatorNode).args.every(isConstantSubtree);
  }
  if (node.type === 'FunctionNode') {
    // Only check args, NOT the function name reference (which is a SymbolNode like 'sqrt')
    return (node as math.FunctionNode).args.every(isConstantSubtree);
  }
  return false;
};

const mathFraction = math.create(math.all, { number: 'Fraction' });

/**
 * Checks if a mathematical node contains any constant node with a decimal point.
 */
const hasDecimalConstant = (node: math.MathNode): boolean => {
  let hasDecimal = false;
  node.traverse((n) => {
    if (n.type === 'ConstantNode') {
      const valStr = String((n as math.ConstantNode).value);
      if (valStr.includes('.')) {
        hasDecimal = true;
      }
    }
  });
  return hasDecimal;
};

/**
 * Evaluates a constant subtree to its simplified form, preserving fractions (e.g. 2/12 -> 1/6)
 * instead of converting to decimal float.
 */
export const evaluateConstantSubtree = (node: math.MathNode): math.MathNode | null => {
  if (node.type === 'ConstantNode') return null;
  if (!isConstantSubtree(node)) return null;

  // Try fraction evaluation first if it doesn't contain decimals
  if (!hasDecimalConstant(node)) {
    try {
      const val = mathFraction.evaluate(node.toString());
      if (val && val.constructor?.name === 'Fraction') {
        const s = Number(val.s);
        const n = Number(val.n);
        const d = Number(val.d);

        if (d === 1) {
          return new math.ConstantNode(s * n);
        } else {
          return new math.OperatorNode('/', 'divide', [
            new math.ConstantNode(s * n),
            new math.ConstantNode(d)
          ]);
        }
      }
    } catch {
      // Ignore and fall through to standard numeric evaluation
    }
  }

  // Fall back to standard numeric evaluation
  try {
    const val = node.compile().evaluate();
    let numVal: number | null = null;
    if (typeof val === 'number') {
      numVal = val;
    } else if (val && typeof val === 'object' && 'toNumber' in val) {
      numVal = (val as unknown as { toNumber: () => number }).toNumber();
    } else {
      const parsed = parseFloat(val?.toString());
      if (!isNaN(parsed)) {
        numVal = parsed;
      }
    }
    if (numVal !== null && !isNaN(numVal) && isFinite(numVal)) {
      return new math.ConstantNode(numVal);
    }
  } catch {
    // ignore
  }

  return null;
};

/**
 * Helper to identify and simplify roots of matching powers (e.g. sqrt(x^2) -> x, nthRoot(x^3, 3) -> x).
 */
export const trySimplifyRootOfPower = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'FunctionNode') {
    return null;
  }
  const funcNode = node as math.FunctionNode;
  const nameStr = getFunctionName(funcNode);

  if (nameStr === 'sqrt') {
    if (funcNode.args.length === 1) {
      let inner = funcNode.args[0];
      while (inner.type === 'ParenthesisNode') {
        inner = (inner as math.ParenthesisNode).content;
      }
      if (inner.type === 'OperatorNode') {
        const opNode = inner as math.OperatorNode;
        if (opNode.op === '^' && opNode.args.length === 2) {
          let exponent = opNode.args[1];
          while (exponent.type === 'ParenthesisNode') {
            exponent = (exponent as math.ParenthesisNode).content;
          }
          if (exponent.type === 'ConstantNode' && Number((exponent as math.ConstantNode).value) === 2) {
            return opNode.args[0];
          }
        }
      }
    }
  }

  if (nameStr === 'nthRoot') {
    if (funcNode.args.length === 1) {
      let inner = funcNode.args[0];
      while (inner.type === 'ParenthesisNode') {
        inner = (inner as math.ParenthesisNode).content;
      }
      if (inner.type === 'OperatorNode') {
        const opNode = inner as math.OperatorNode;
        if (opNode.op === '^' && opNode.args.length === 2) {
          let exponent = opNode.args[1];
          while (exponent.type === 'ParenthesisNode') {
            exponent = (exponent as math.ParenthesisNode).content;
          }
          if (exponent.type === 'ConstantNode' && Number((exponent as math.ConstantNode).value) === 2) {
            return opNode.args[0];
          }
        }
      }
    } else if (funcNode.args.length === 2) {
      let inner = funcNode.args[0];
      let degree = funcNode.args[1];
      while (inner.type === 'ParenthesisNode') {
        inner = (inner as math.ParenthesisNode).content;
      }
      while (degree.type === 'ParenthesisNode') {
        degree = (degree as math.ParenthesisNode).content;
      }
      if (inner.type === 'OperatorNode') {
        const opNode = inner as math.OperatorNode;
        if (opNode.op === '^' && opNode.args.length === 2) {
          let exponent = opNode.args[1];
          while (exponent.type === 'ParenthesisNode') {
            exponent = (exponent as math.ParenthesisNode).content;
          }
          if (exponent.toString() === degree.toString()) {
            return opNode.args[0];
          }
        }
      }
    }
  }

  return null;
};

/**
 * Helper to identify and simplify powers of matching roots (e.g. (sqrt(x))^2 -> x, (nthRoot(x, n))^n -> x).
 */
export const trySimplifyPowerOfRoot = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode') {
    return null;
  }
  const opNode = node as math.OperatorNode;
  if (opNode.op !== '^' || opNode.args.length !== 2) {
    return null;
  }

  let base = opNode.args[0];
  let exponent = opNode.args[1];

  // Unwrap parentheses
  while (base.type === 'ParenthesisNode') {
    base = (base as math.ParenthesisNode).content;
  }
  while (exponent.type === 'ParenthesisNode') {
    exponent = (exponent as math.ParenthesisNode).content;
  }

  if (base.type !== 'FunctionNode') {
    return null;
  }
  const baseFunc = base as math.FunctionNode;
  const nameStr = getFunctionName(baseFunc);

  if (nameStr === 'sqrt') {
    if (baseFunc.args.length === 1) {
      if (exponent.type === 'ConstantNode' && Number((exponent as math.ConstantNode).value) === 2) {
        return baseFunc.args[0];
      }
    }
  }

  if (nameStr === 'nthRoot') {
    if (baseFunc.args.length === 1) {
      // Default degree is 2 for nthRoot with 1 argument (equivalent to square root)
      if (exponent.type === 'ConstantNode' && Number((exponent as math.ConstantNode).value) === 2) {
        return baseFunc.args[0];
      }
    } else if (baseFunc.args.length === 2) {
      let rootDegree = baseFunc.args[1];
      while (rootDegree.type === 'ParenthesisNode') {
        rootDegree = (rootDegree as math.ParenthesisNode).content;
      }
      if (exponent.toString() === rootDegree.toString()) {
        return baseFunc.args[0];
      }
    }
  }

  return null;
};

/**
 * Identifies distribution opportunities (e.g. a * (b + c) -> a * b + a * c, or (b + c) / a -> b / a + c / a)
 * and returns the expanded mathematical node.
 */
export const tryDistribution = (node: math.MathNode): math.MathNode | null => {
  if (!node) return null;

  // Case 1: Multiplication, e.g. a * (b + c) or (b + c) * a
  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '*') {
    const opNode = node as math.OperatorNode;
    const left = opNode.args[0];
    const right = opNode.args[1];

    // Subcase 1A: a * (b + c) or a * (b - c)
    let rightContent = right;
    while (rightContent.type === 'ParenthesisNode') {
      rightContent = (rightContent as math.ParenthesisNode).content;
    }
    if (rightContent.type === 'OperatorNode' && ((rightContent as math.OperatorNode).op === '+' || (rightContent as math.OperatorNode).op === '-')) {
      const innerOp = rightContent as math.OperatorNode;
      const a = left;
      const b = innerOp.args[0];
      const c = innerOp.args[1];
      const op = innerOp.op;

      const term1 = new math.OperatorNode('*', 'multiply', [a, b]);
      const term2 = new math.OperatorNode('*', 'multiply', [a, c]);
      return new math.OperatorNode(op, op === '+' ? 'add' : 'subtract', [
        new math.ParenthesisNode(term1),
        new math.ParenthesisNode(term2),
      ]);
    }

    // Subcase 1B: (b + c) * a or (b - c) * a
    let leftContent = left;
    while (leftContent.type === 'ParenthesisNode') {
      leftContent = (leftContent as math.ParenthesisNode).content;
    }
    if (leftContent.type === 'OperatorNode' && ((leftContent as math.OperatorNode).op === '+' || (leftContent as math.OperatorNode).op === '-')) {
      const innerOp = leftContent as math.OperatorNode;
      const a = right;
      const b = innerOp.args[0];
      const c = innerOp.args[1];
      const op = innerOp.op;

      const term1 = new math.OperatorNode('*', 'multiply', [b, a]);
      const term2 = new math.OperatorNode('*', 'multiply', [c, a]);
      return new math.OperatorNode(op, op === '+' ? 'add' : 'subtract', [
        new math.ParenthesisNode(term1),
        new math.ParenthesisNode(term2),
      ]);
    }
  }

  // Case 2: Division, e.g. (b + c) / a or (b - c) / a
  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '/') {
    const opNode = node as math.OperatorNode;
    const left = opNode.args[0];
    const right = opNode.args[1];

    let leftContent = left;
    while (leftContent.type === 'ParenthesisNode') {
      leftContent = (leftContent as math.ParenthesisNode).content;
    }
    if (leftContent.type === 'OperatorNode' && ((leftContent as math.OperatorNode).op === '+' || (leftContent as math.OperatorNode).op === '-')) {
      const innerOp = leftContent as math.OperatorNode;
      const a = right;
      const b = innerOp.args[0];
      const c = innerOp.args[1];
      const op = innerOp.op;

      const term1 = new math.OperatorNode('/', 'divide', [b, a]);
      const term2 = new math.OperatorNode('/', 'divide', [c, a]);
      return new math.OperatorNode(op, op === '+' ? 'add' : 'subtract', [
        new math.ParenthesisNode(term1),
        new math.ParenthesisNode(term2),
      ]);
    }
  }

  return null;
};

/**
 * Helper to check if two paths are compatible for double removal (algebraic inverse cancellation).
 * Disallows mixed additive/multiplicative parent chains or function node boundaries.
 */
export const arePathsCompatibleForDoubleRemoval = (eq: Equation, p1: string, p2: string): boolean => {
  const parts1 = p1.split('/');
  const parts2 = p2.split('/');
  const commonParts: string[] = [];
  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] === parts2[i]) {
      commonParts.push(parts1[i]);
    } else {
      break;
    }
  }
  const lcaPath = commonParts.join('/');
  if (!lcaPath) return false;

  const getOperatorsInPathToLCA = (path: string): string[] => {
    const operators: string[] = [];
    let current = path;
    while (current !== lcaPath && current.includes('/')) {
      current = current.substring(0, current.lastIndexOf('/'));
      try {
        const node = getNodeByPath(eq, current);
        if (node.type === 'OperatorNode') {
          operators.push((node as math.OperatorNode).op);
        } else {
          operators.push('other');
        }
      } catch {
        operators.push('other');
      }
    }
    return operators;
  };

  const ops1 = getOperatorsInPathToLCA(p1);
  const ops2 = getOperatorsInPathToLCA(p2);

  try {
    const lcaNode = getNodeByPath(eq, lcaPath);
    if (lcaNode.type === 'OperatorNode') {
      ops1.push((lcaNode as math.OperatorNode).op);
    } else {
      ops1.push('other');
    }
  } catch {
    ops1.push('other');
  }

  const allOps = [...ops1, ...ops2];
  const hasAdditive = allOps.some(op => op === '+' || op === '-');
  const hasMultiplicative = allOps.some(op => op === '*' || op === '/');
  const hasOther = allOps.some(op => op !== '+' && op !== '-' && op !== '*' && op !== '/');

  if (hasOther) return false;
  if (hasAdditive && hasMultiplicative) return false;
  return true;
};

/**
 * Helper to combine multiplied terms of the same base (e.g. x * x -> x^2, x^2 * x -> x^3, x^A * x^B -> x^(A + B)).
 */
export const tryCombinePowerTerms = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode' || (node as math.OperatorNode).op !== '*') {
    return null;
  }
  const opNode = node as math.OperatorNode;
  const left = opNode.args[0];
  const right = opNode.args[1];

  let baseLeft = left;
  let expLeft: math.MathNode = new math.ConstantNode(1);
  if (left.type === 'OperatorNode' && (left as math.OperatorNode).op === '^') {
    baseLeft = (left as math.OperatorNode).args[0];
    expLeft = (left as math.OperatorNode).args[1];
  }

  let baseRight = right;
  let expRight: math.MathNode = new math.ConstantNode(1);
  if (right.type === 'OperatorNode' && (right as math.OperatorNode).op === '^') {
    baseRight = (right as math.OperatorNode).args[0];
    expRight = (right as math.OperatorNode).args[1];
  }

  // Helper to strip outer parentheses for base comparison
  const getCleanBaseStr = (n: math.MathNode): string => {
    let curr = n;
    while (curr.type === 'ParenthesisNode') {
      curr = (curr as math.ParenthesisNode).content;
    }
    return curr.toString();
  };

  if (getCleanBaseStr(baseLeft) === getCleanBaseStr(baseRight)) {
    // Combine them!
    // Exponent sum: expLeft + expRight
    let sumNode: math.MathNode;
    try {
      const valL = expLeft.type === 'ConstantNode' ? Number((expLeft as math.ConstantNode).value) : NaN;
      const valR = expRight.type === 'ConstantNode' ? Number((expRight as math.ConstantNode).value) : NaN;
      if (!isNaN(valL) && !isNaN(valR)) {
        sumNode = new math.ConstantNode(valL + valR);
      } else {
        sumNode = new math.OperatorNode('+', 'add', [expLeft, expRight]);
      }
    } catch {
      sumNode = new math.OperatorNode('+', 'add', [expLeft, expRight]);
    }

    return new math.OperatorNode('^', 'pow', [baseLeft, sumNode]);
  }

  return null;
};

/**
 * Helper to expand a power term to repeated multiplication (e.g. x^3 -> x * x * x).
 * Limited to positive integer exponents >= 2 and <= 10 (to avoid excessive growth).
 */
export const tryExpandPowerTerm = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode' || (node as math.OperatorNode).op !== '^') {
    return null;
  }
  const opNode = node as math.OperatorNode;
  const base = opNode.args[0];
  const exponent = opNode.args[1];

  if (exponent.type !== 'ConstantNode') {
    return null;
  }
  const n = Number((exponent as math.ConstantNode).value);
  if (!Number.isInteger(n) || n < 2 || n > 10) {
    return null;
  }

  // Construct base * base * ... * base (n times)
  let result = base;
  for (let i = 1; i < n; i++) {
    result = new math.OperatorNode('*', 'multiply', [result, base]);
  }
  return result;
};

/**
 * Checks if a given path has a simplification opportunity.
 * Returns the simplified Equation if found, otherwise null.
 */
const getSimplificationForPathRaw = (eq: Equation, p: string): Equation | null => {
  try {
    const node = getNodeByPath(eq, p);
    if (!node) return null;

    const isDiff = (candidate: Equation): boolean => {
      const clean = (s: string) => s.replace(/[\s()]/g, '');
      return clean(candidate.lhs.toString()) !== clean(eq.lhs.toString()) ||
             clean(candidate.rhs.toString()) !== clean(eq.rhs.toString());
    };

    // 1. Try constant folding first (non-constant subtrees composed entirely of constants)
    if (node.type !== 'ConstantNode' && isConstantSubtree(node)) {
      const folded = evaluateConstantSubtree(node);
      if (folded) {
        const clean = (str: string) => str.replace(/[\s()]/g, '');
        if (clean(folded.toString()) !== clean(node.toString())) {
          const candidate = replaceNodeAtPath(eq, p, folded);
          if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
            return candidate;
          }
        }
      }
    }

    if (node.type === 'ParenthesisNode') {
      const paren = node as math.ParenthesisNode;
      const candidate = replaceNodeAtPath(eq, p, paren.content);
      const eqStr = `${eq.lhs.toString()} = ${eq.rhs.toString()}`;
      const candidateStr = `${candidate.lhs.toString()} = ${candidate.rhs.toString()}`;
      if (eqStr !== candidateStr && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 2.5 Try simplifying root of power (e.g. sqrt(x ^ 2) -> x) or power of root (e.g. (sqrt(x)) ^ 2 -> x)
    const rootPowerSimplified = trySimplifyRootOfPower(node) || trySimplifyPowerOfRoot(node);
    if (rootPowerSimplified) {
      const candidate = replaceNodeAtPath(eq, p, rootPowerSimplified);
      if (isDiff(candidate)) {
        return candidate;
      }
    }

    // 2.6 Try combining power terms (e.g. x * x -> x^2)
    const combinedPower = tryCombinePowerTerms(node);
    if (combinedPower) {
      const candidate = replaceNodeAtPath(eq, p, combinedPower);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 2.7 Try algebraic distribution, e.g. a * (b + c) -> a * b + a * c
    const distributedNode = tryDistribution(node);
    if (distributedNode) {
      const candidate = replaceNodeAtPath(eq, p, distributedNode);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 3. Try single removal of this node
    const singleCandidate = trySingleRemoval(eq, p);
    if (singleCandidate && isDiff(singleCandidate) && areEquationsEquivalent(eq, singleCandidate)) {
      return singleCandidate;
    }

    // 4. Try double removal involving this node and another node only if compatible (direct inverses)
    const allPaths = getAllPaths(eq);
    for (let i = 0; i < allPaths.length; i++) {
      const otherPath = allPaths[i];
      if (otherPath === p) continue;
      if (!arePathsCompatibleForDoubleRemoval(eq, p, otherPath)) continue;
      const doubleCandidate = tryDoubleRemoval(eq, p, otherPath);
      if (doubleCandidate && isDiff(doubleCandidate) && areEquationsEquivalent(eq, doubleCandidate)) {
        return doubleCandidate;
      }
    }

    // 5. Try mathjs built-in simplify for algebraic reductions (e.g. combining like terms: 3 * x - x -> 2 * x)
    try {
      const simplifiedNode = math.simplify(node.toString());
      if (simplifiedNode.toString() !== node.toString()) {
        // Enforce complexity reduction to filter out non-simplifying reorderings (e.g. (y - 1) * 2 -> 2 * (y - 1))
        if (countNodes(simplifiedNode) < countNodes(node)) {
          const candidate = replaceNodeAtPath(eq, p, simplifiedNode);
          if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
            return candidate;
          }
        }
      }
    } catch {
      // ignore
    }
  } catch {
    // Graceful fallback
  }

  return null;
};

export const getSimplificationForPath = (eq: Equation, p: string): Equation | null => {
  const result = getSimplificationForPathRaw(eq, p);
  return result ? ensureNodeIds(result) : null;
};

/**
 * Automatically simplifies an equation by trying all single and double node
 * removals and verifying equivalence. Iterates until no more nodes can be removed.
 */
export const autoSimplify = (eq: Equation): Equation => {
  let currentEq = eq;
  let simplified = true;

  // Max iterations safeguard to prevent any infinite loops
  const maxIterations = 50;
  let iteration = 0;

  while (simplified && iteration < maxIterations) {
    simplified = false;
    iteration++;

    const paths = getAllPaths(currentEq);

    // 1. Try single term eliminations, parenthesis unwrapping, or constant folding
    for (let i = 0; i < paths.length; i++) {
      const node = getNodeByPath(currentEq, paths[i]);

      // Try constant folding first
      if (node.type !== 'ConstantNode' && isConstantSubtree(node)) {
        const folded = evaluateConstantSubtree(node);
        if (folded) {
          const clean = (str: string) => str.replace(/[\s()]/g, '');
          if (clean(folded.toString()) !== clean(node.toString())) {
            const candidate = replaceNodeAtPath(currentEq, paths[i], folded);
            if (areEquationsEquivalent(currentEq, candidate)) {
              currentEq = candidate;
              simplified = true;
              break; // Restart scan on the simplified tree
            }
          }
        }
      }

      // Unpack redundant parentheses (e.g. (x) -> x)
      if (node.type === 'ParenthesisNode') {
        const paren = node as math.ParenthesisNode;
        const candidate = replaceNodeAtPath(currentEq, paths[i], paren.content);
        if (areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }

      // Try root of power simplification (e.g. sqrt(x ^ 2) -> x) or power of root (e.g. (sqrt(x)) ^ 2 -> x)
      const rootPowerSimplified = trySimplifyRootOfPower(node) || trySimplifyPowerOfRoot(node);
      if (rootPowerSimplified) {
        const candidate = replaceNodeAtPath(currentEq, paths[i], rootPowerSimplified);
        currentEq = candidate;
        simplified = true;
        break; // Restart scan on the simplified tree
      }

      // Try combining power terms (e.g. x * x -> x^2)
      const combinedPower = tryCombinePowerTerms(node);
      if (combinedPower) {
        const candidate = replaceNodeAtPath(currentEq, paths[i], combinedPower);
        if (areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }

      // Try algebraic distribution, e.g. a * (b + c) -> a * b + a * c
      const distributedNode = tryDistribution(node);
      if (distributedNode) {
        const candidate = replaceNodeAtPath(currentEq, paths[i], distributedNode);
        if (areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }

      // Try removing the single node
      const candidate = trySingleRemoval(currentEq, paths[i]);
      if (candidate && areEquationsEquivalent(currentEq, candidate)) {
        currentEq = candidate;
        simplified = true;
        break; // Restart scan on the simplified tree
      }

      // Try mathjs built-in simplify for algebraic reductions (e.g. combining like terms)
      try {
        const simplifiedNode = math.simplify(node.toString());
        if (simplifiedNode.toString() !== node.toString()) {
          // Enforce complexity reduction to filter out non-simplifying reorderings (e.g. (y - 1) * 2 -> 2 * (y - 1))
          if (countNodes(simplifiedNode) < countNodes(node)) {
            const candidate = replaceNodeAtPath(currentEq, paths[i], simplifiedNode);
            if (areEquationsEquivalent(currentEq, candidate)) {
              currentEq = candidate;
              simplified = true;
              break; // Restart scan on the simplified tree
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (simplified) continue;

    // 2. Try pair eliminations (e.g. + x - x, * y / y)
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const candidate = tryDoubleRemoval(currentEq, paths[i], paths[j]);
        if (candidate && areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }
      if (simplified) break;
    }
  }

  return currentEq;
};
