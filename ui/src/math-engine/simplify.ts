import * as math from 'mathjs';
import { Equation, getAllPaths, removeNodeAtPath, getNodeByPath, replaceNodeAtPath } from './tree';
import { areEquationsEquivalent, getFunctionName } from './validator';

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
 * Checks if a given path has a simplification opportunity.
 * Returns the simplified Equation if found, otherwise null.
 */
export const getSimplificationForPath = (eq: Equation, p: string): Equation | null => {
  try {
    const node = getNodeByPath(eq, p);
    if (!node) return null;

    const isDiff = (candidate: Equation): boolean => {
      return candidate.lhs.toString() !== eq.lhs.toString() || candidate.rhs.toString() !== eq.rhs.toString();
    };

    // 1. Try constant folding first (non-constant subtrees composed entirely of constants)
    if (node.type !== 'ConstantNode' && isConstantSubtree(node)) {
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
          const candidate = replaceNodeAtPath(eq, p, new math.ConstantNode(numVal));
          if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
            return candidate;
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Unpack redundant parenthesis at this path
    if (node.type === 'ParenthesisNode') {
      const paren = node as math.ParenthesisNode;
      const candidate = replaceNodeAtPath(eq, p, paren.content);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 2.5 Try simplifying root of power (e.g. sqrt(x ^ 2) -> x)
    const rootPowerSimplified = trySimplifyRootOfPower(node);
    if (rootPowerSimplified) {
      const candidate = replaceNodeAtPath(eq, p, rootPowerSimplified);
      if (isDiff(candidate)) {
        return candidate;
      }
    }

    // 3. Try single removal of this node
    const singleCandidate = trySingleRemoval(eq, p);
    if (singleCandidate && isDiff(singleCandidate) && areEquationsEquivalent(eq, singleCandidate)) {
      return singleCandidate;
    }

    // 4. Try double removal involving this node and another node
    const allPaths = getAllPaths(eq);
    for (let i = 0; i < allPaths.length; i++) {
      const otherPath = allPaths[i];
      if (otherPath === p) continue;
      const doubleCandidate = tryDoubleRemoval(eq, p, otherPath);
      if (doubleCandidate && isDiff(doubleCandidate) && areEquationsEquivalent(eq, doubleCandidate)) {
        return doubleCandidate;
      }
    }

    // 5. Try mathjs built-in simplify for algebraic reductions (e.g. combining like terms: 3 * x - x -> 2 * x)
    try {
      const simplifiedNode = math.simplify(node.toString());
      if (simplifiedNode.toString() !== node.toString()) {
        const candidate = replaceNodeAtPath(eq, p, simplifiedNode);
        if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
          return candidate;
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
            const candidate = replaceNodeAtPath(currentEq, paths[i], new math.ConstantNode(numVal));
            if (areEquationsEquivalent(currentEq, candidate)) {
              currentEq = candidate;
              simplified = true;
              break; // Restart scan on the simplified tree
            }
          }
        } catch {
          // ignore
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

      // Try root of power simplification (e.g. sqrt(x ^ 2) -> x)
      const rootPowerSimplified = trySimplifyRootOfPower(node);
      if (rootPowerSimplified) {
        const candidate = replaceNodeAtPath(currentEq, paths[i], rootPowerSimplified);
        currentEq = candidate;
        simplified = true;
        break; // Restart scan on the simplified tree
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
          const candidate = replaceNodeAtPath(currentEq, paths[i], simplifiedNode);
          if (areEquationsEquivalent(currentEq, candidate)) {
            currentEq = candidate;
            simplified = true;
            break; // Restart scan on the simplified tree
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
