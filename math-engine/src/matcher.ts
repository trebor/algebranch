import * as math from 'mathjs';
import { getFunctionName } from './validator';

export interface WildcardBindings {
  [wildcardName: string]: math.MathNode;
}

const isWildcard = (node: math.MathNode): boolean => {
  return node.type === 'SymbolNode' && (node as math.SymbolNode).name.startsWith('_');
};

const unwrap = (node: math.MathNode): math.MathNode => {
  let current = node;
  while (current.type === 'ParenthesisNode') {
    current = (current as math.ParenthesisNode).content;
  }
  return current;
};

const compareStringsASCII = (s1: string, s2: string): number => {
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    const c1 = s1.charCodeAt(i);
    const c2 = s2.charCodeAt(i);
    if (c1 !== c2) {
      return c1 - c2;
    }
  }
  return s1.length - s2.length;
};

const compareNodesForCommutative = (a: math.MathNode, b: math.MathNode): number => {
  const unwrappedA = unwrap(a);
  const unwrappedB = unwrap(b);

  const getScore = (n: math.MathNode): number => {
    if (n.type === 'ConstantNode') return 0;
    return 1;
  };

  const scoreA = getScore(unwrappedA);
  const scoreB = getScore(unwrappedB);

  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  return compareStringsASCII(unwrappedA.toString(), unwrappedB.toString());
};

const areNodesStructurallyEqual = (a: math.MathNode, b: math.MathNode): boolean => {
  const unwrappedA = unwrap(a);
  const unwrappedB = unwrap(b);

  if (unwrappedA.type !== unwrappedB.type) return false;

  if (unwrappedA.type === 'ConstantNode') {
    return (unwrappedA as math.ConstantNode).value === (unwrappedB as math.ConstantNode).value;
  }
  if (unwrappedA.type === 'SymbolNode') {
    return (unwrappedA as math.SymbolNode).name === (unwrappedB as math.SymbolNode).name;
  }
  if (unwrappedA.type === 'OperatorNode') {
    const opA = unwrappedA as math.OperatorNode;
    const opB = unwrappedB as math.OperatorNode;
    if (opA.op !== opB.op || opA.args.length !== opB.args.length) return false;
    return opA.args.every((arg, index) => areNodesStructurallyEqual(arg, opB.args[index]));
  }
  if (unwrappedA.type === 'FunctionNode') {
    const fnA = unwrappedA as math.FunctionNode;
    const fnB = unwrappedB as math.FunctionNode;
    if (getFunctionName(fnA) !== getFunctionName(fnB) || fnA.args.length !== fnB.args.length) return false;
    return fnA.args.every((arg, index) => areNodesStructurallyEqual(arg, fnB.args[index]));
  }
  return unwrappedA.toString().replace(/\s+/g, '') === unwrappedB.toString().replace(/\s+/g, '');
};

/**
 * Matches a pattern AST containing wildcard nodes (e.g. _A, _B) against a target node.
 * Returns the bindings dictionary if matched successfully, otherwise returns null.
 */
export function matchPattern(
  pattern: math.MathNode,
  target: math.MathNode,
  bindings: WildcardBindings = {}
): WildcardBindings | null {
  if (isWildcard(pattern)) {
    const name = (pattern as math.SymbolNode).name;
    const existing = bindings[name];
    if (existing) {
      if (areNodesStructurallyEqual(existing, target)) {
        return bindings;
      }
      return null;
    }
    // Bind to the exact target node (retaining parenthesization)
    return {
      ...bindings,
      [name]: target,
    };
  }

  // Handle standard node matching
  const unwrappedPattern = unwrap(pattern);
  const unwrappedTarget = unwrap(target);

  if (unwrappedPattern.type !== unwrappedTarget.type) {
    return null;
  }

  if (unwrappedPattern.type === 'ConstantNode') {
    if ((unwrappedPattern as math.ConstantNode).value === (unwrappedTarget as math.ConstantNode).value) {
      return bindings;
    }
    return null;
  }

  if (unwrappedPattern.type === 'SymbolNode') {
    if ((unwrappedPattern as math.SymbolNode).name === (unwrappedTarget as math.SymbolNode).name) {
      return bindings;
    }
    return null;
  }

  if (unwrappedPattern.type === 'OperatorNode') {
    const opP = unwrappedPattern as math.OperatorNode;
    const opT = unwrappedTarget as math.OperatorNode;

    if (opP.op !== opT.op || opP.args.length !== opT.args.length) {
      return null;
    }

    // Support commutative operations: + and *
    if (opP.op === '+' || opP.op === '*') {
      const sortedArgsP = [...opP.args].sort(compareNodesForCommutative);
      const sortedArgsT = [...opT.args].sort(compareNodesForCommutative);

      let currentBindings = { ...bindings };
      for (let i = 0; i < sortedArgsP.length; i++) {
        const next = matchPattern(sortedArgsP[i], sortedArgsT[i], currentBindings);
        if (next) {
          currentBindings = next;
        } else {
          return null;
        }
      }
      return currentBindings;
    }

    // Normal non-commutative operator matching
    let currentBindings = { ...bindings };
    for (let i = 0; i < opP.args.length; i++) {
      const next = matchPattern(opP.args[i], opT.args[i], currentBindings);
      if (next) {
        currentBindings = next;
      } else {
        return null;
      }
    }
    return currentBindings;
  }

  if (unwrappedPattern.type === 'FunctionNode') {
    const fnP = unwrappedPattern as math.FunctionNode;
    const fnT = unwrappedTarget as math.FunctionNode;

    if (getFunctionName(fnP) !== getFunctionName(fnT) || fnP.args.length !== fnT.args.length) {
      return null;
    }

    let currentBindings = { ...bindings };
    for (let i = 0; i < fnP.args.length; i++) {
      const next = matchPattern(fnP.args[i], fnT.args[i], currentBindings);
      if (next) {
        currentBindings = next;
      } else {
        return null;
      }
    }
    return currentBindings;
  }

  // Fallback string-based matching for other node types
  if (unwrappedPattern.toString().replace(/\s+/g, '') === unwrappedTarget.toString().replace(/\s+/g, '')) {
    return bindings;
  }

  return null;
}

/**
 * Replaces wildcard symbols in a pattern AST with their bound nodes from match bindings.
 */
export function instantiatePattern(
  pattern: math.MathNode,
  bindings: WildcardBindings
): math.MathNode {
  if (isWildcard(pattern)) {
    const name = (pattern as math.SymbolNode).name;
    const bound = bindings[name];
    if (bound) {
      return bound.clone();
    }
    return pattern;
  }

  if ('args' in pattern && Array.isArray((pattern as any).args)) {
    const cloned = pattern.clone() as any;
    cloned.args = (pattern as any).args.map((arg: math.MathNode) =>
      instantiatePattern(arg, bindings)
    );
    return cloned;
  }

  if ('content' in pattern && (pattern as any).content) {
    const cloned = pattern.clone() as any;
    cloned.content = instantiatePattern((pattern as any).content, bindings);
    return cloned;
  }

  return pattern;
}

/**
 * If a node is a ConstantNode representing a perfect square or cube (e.g. 9 or 8),
 * returns an OperatorNode representing the power form (e.g. 3^2 or 2^3).
 * Otherwise returns null.
 */
export function tryExpressAsPower(node: math.MathNode): math.MathNode | null {
  if (node.type !== 'ConstantNode') return null;
  const val = (node as math.ConstantNode).value;
  if (typeof val !== 'number' || !Number.isInteger(val) || val <= 1) return null;

  // Check squares first (most common)
  const root2 = Math.sqrt(val);
  const rounded2 = Math.round(root2);
  if (Math.abs(root2 - rounded2) < 1e-9) {
    return new math.OperatorNode('^', 'pow', [
      new math.ConstantNode(rounded2),
      new math.ConstantNode(2)
    ]);
  }

  // Check cubes next
  const root3 = Math.cbrt(val);
  const rounded3 = Math.round(root3);
  if (Math.abs(root3 - rounded3) < 1e-9) {
    return new math.OperatorNode('^', 'pow', [
      new math.ConstantNode(rounded3),
      new math.ConstantNode(3)
    ]);
  }

  return null;
}
