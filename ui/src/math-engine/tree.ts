import * as math from 'mathjs';

export interface Equation {
  readonly lhs: math.MathNode;
  readonly rhs: math.MathNode;
}

interface NodeWithArgs extends math.MathNode {
  args: math.MathNode[];
}

interface NodeWithContent extends math.MathNode {
  content: math.MathNode;
}

/**
 * Returns all child nodes of a mathjs node.
 * Treats ParenthesisNode content as its single child.
 */
export const getChildren = (node: math.MathNode): math.MathNode[] => {
  if ('args' in node && Array.isArray((node as unknown as NodeWithArgs).args)) {
    return (node as unknown as NodeWithArgs).args;
  }
  if ('content' in node && (node as unknown as NodeWithContent).content) {
    return [(node as unknown as NodeWithContent).content];
  }
  return [];
};

/**
 * Clones a mathjs node with new children.
 * Standardizes args or content properties.
 */
export const cloneWithChildren = (node: math.MathNode, newChildren: math.MathNode[]): math.MathNode => {
  let cloned: math.MathNode;
  if ('args' in node && Array.isArray((node as unknown as NodeWithArgs).args)) {
    const tempCloned = node.clone() as unknown as NodeWithArgs;
    tempCloned.args = newChildren;
    cloned = tempCloned;
  } else if ('content' in node && (node as unknown as NodeWithContent).content) {
    const tempCloned = node.clone() as unknown as NodeWithContent;
    tempCloned.content = newChildren[0];
    cloned = tempCloned;
  } else {
    cloned = node;
  }

  // Explicitly preserve stable IDs across clones
  const nodeId = (node as unknown as { id?: string }).id;
  if (nodeId) {
    (cloned as unknown as Record<string, string>).id = nodeId;
  }
  return cloned;
};

/**
 * Traverses an Equation by a path (e.g. 'lhs/0/1') and returns the node.
 */
export const getNodeByPath = (eq: Equation, path: string): math.MathNode => {
  const parts = path.split('/');
  const side = parts[0];
  let current: math.MathNode = side === 'lhs' ? eq.lhs : eq.rhs;

  const startDepth = 1;
  for (let i = startDepth; i < parts.length; i++) {
    const idx = parseInt(parts[i], 10);
    const children = getChildren(current);
    if (idx >= 0 && idx < children.length) {
      current = children[idx];
    } else {
      throw new Error(`Invalid path index: ${idx} at node ${current.toString()}`);
    }
  }
  return current;
};

/**
 * Replaces a node at a path with a new node.
 */
export const replaceNodeAtPath = (eq: Equation, path: string, newNode: math.MathNode): Equation => {
  const parts = path.split('/');
  const side = parts[0];
  const root = side === 'lhs' ? eq.lhs : eq.rhs;

  const replaceRecursive = (node: math.MathNode, indexDepth: number): math.MathNode => {
    if (indexDepth === parts.length) {
      return newNode;
    }
    const idx = parseInt(parts[indexDepth], 10);
    const children = [...getChildren(node)];
    if (idx >= 0 && idx < children.length) {
      children[idx] = replaceRecursive(children[idx], indexDepth + 1);
      return cloneWithChildren(node, children);
    }
    throw new Error(`Invalid replace path index: ${idx} at depth ${indexDepth}`);
  };

  const nextDepth = 1;
  const newRoot = replaceRecursive(root, nextDepth);
  return {
    lhs: side === 'lhs' ? newRoot : eq.lhs,
    rhs: side === 'rhs' ? newRoot : eq.rhs,
  };
};

/**
 * Removes a node at a path and restructures parents.
 * For binary operators, removing one child returns the other.
 */
export const removeNodeAtPath = (
  eq: Equation,
  path: string
): { readonly newEquation: Equation; readonly removedNode: math.MathNode } => {
  const parts = path.split('/');
  const side = parts[0];
  const root = side === 'lhs' ? eq.lhs : eq.rhs;
  let removedNode: math.MathNode | null = null;

  const removeRecursive = (node: math.MathNode, indexDepth: number): math.MathNode => {
    const nextDepth = indexDepth + 1;
    if (indexDepth === parts.length - 1) {
      const idxToRemove = parseInt(parts[indexDepth], 10);
      const children = getChildren(node);
      removedNode = children[idxToRemove];

      const binaryCount = 2;
      const unaryCount = 1;

      if (children.length === binaryCount) {
        const remainingIdx = idxToRemove === 0 ? 1 : 0;
        return children[remainingIdx];
      } else if (children.length === unaryCount) {
        const defaultZero = 0;
        return new math.ConstantNode(defaultZero);
      } else {
        const newChildren = children.filter((_, i) => i !== idxToRemove);
        return cloneWithChildren(node, newChildren);
      }
    }

    const idx = parseInt(parts[indexDepth], 10);
    const children = [...getChildren(node)];
    if (idx >= 0 && idx < children.length) {
      children[idx] = removeRecursive(children[idx], nextDepth);
      return cloneWithChildren(node, children);
    }
    throw new Error(`Invalid remove path index: ${idx} at depth ${indexDepth}`);
  };

  if (parts.length === 1) {
    const defaultZero = 0;
    return {
      newEquation: {
        lhs: side === 'lhs' ? new math.ConstantNode(defaultZero) : eq.lhs,
        rhs: side === 'rhs' ? new math.ConstantNode(defaultZero) : eq.rhs,
      },
      removedNode: root,
    };
  }

  const startDepth = 1;
  const newRoot = removeRecursive(root, startDepth);
  if (!removedNode) {
    throw new Error(`Node not found at path ${path}`);
  }
  return {
    newEquation: {
      lhs: side === 'lhs' ? newRoot : eq.lhs,
      rhs: side === 'rhs' ? newRoot : eq.rhs,
    },
    removedNode: removedNode as math.MathNode,
  };
};

/**
 * Returns all valid node paths in an equation tree recursively.
 */
export const getAllPathsInTree = (node: math.MathNode, prefix: string): string[] => {
  const paths: string[] = [prefix];
  const children = getChildren(node);
  children.forEach((child, index) => {
    paths.push(...getAllPathsInTree(child, `${prefix}/${index}`));
  });
  return paths;
};

/**
 * Returns all valid node paths for an entire Equation.
 */
export const getAllPaths = (eq: Equation): string[] => {
  return [
    ...getAllPathsInTree(eq.lhs, 'lhs'),
    ...getAllPathsInTree(eq.rhs, 'rhs'),
  ];
};

/**
 * Helper to determine operator precedence for redundant parenthesis detection.
 */
const getPrecedence = (node: math.MathNode): number => {
  if (node.type === 'OperatorNode') {
    const op = (node as math.OperatorNode).op;
    if (op === '^') return 4;
    if (op === '*' || op === '/') return 3;
    if (op === '+' || op === '-') return 2;
  }
  if (node.type === 'ParenthesisNode') {
    return 1;
  }
  return 100; // Atoms (Symbol, Constant, Function, etc.) have highest precedence
};

/**
 * Recursively strips redundant parenthesis from a mathematical node structure.
 */
export const stripRedundantParentheses = (
  node: math.MathNode,
  parent: math.MathNode | null = null,
  isRightChild: boolean = false
): math.MathNode => {
  if (!node) return node;

  if (node.type === 'ParenthesisNode') {
    const paren = node as math.ParenthesisNode;
    const content = paren.content;

    let redundant = false;

    if (!parent) {
      // 1. Root level nodes (LHS or RHS roots) never need outer parenthesis
      redundant = true;
    } else if (content.type === 'SymbolNode' || content.type === 'ConstantNode') {
      // 2. Atoms inside parenthesis (e.g. (x) -> x, (5) -> 5)
      redundant = true;
    } else if (parent.type === 'ParenthesisNode') {
      // 3. Double/nested parenthesis (e.g. ((x)) -> (x))
      redundant = true;
    } else if (parent.type === 'FunctionNode') {
      // 4. Function arguments (e.g. sqrt((x + 2)) -> sqrt(x + 2))
      redundant = true;
    } else if (parent.type === 'OperatorNode') {
      // 5. Operator precedence check
      const parentOp = parent as math.OperatorNode;
      const parentPrec = getPrecedence(parentOp);
      const childPrec = getPrecedence(content);

      if (childPrec > parentPrec) {
        // Child has higher precedence, e.g. (a * b) + c -> a * b + c
        redundant = true;
      } else if (childPrec === parentPrec) {
        // Same precedence (e.g. addition left-associativity)
        if (!isRightChild) {
          // Left child is always safe to strip for standard left-associative operators
          redundant = true;
        } else {
          // Right child is associative (e.g. a + (b + c) -> a + b + c, a * (b * c) -> a * b * c)
          const op = parentOp.op;
          if (op === '+' || op === '*') {
            redundant = true;
          }
        }
      }
    }

    if (redundant) {
      const stripped = stripRedundantParentheses(content, parent, isRightChild);
      // Preserve stable unique ID if it was already assigned to the ParenthesisNode
      const originalId = (node as unknown as { id?: string }).id;
      if (originalId) {
        (stripped as unknown as Record<string, string>).id = originalId;
      }
      return stripped;
    }
  }

  // Recurse children
  if ('args' in node && Array.isArray((node as unknown as NodeWithArgs).args)) {
    const args = (node as unknown as NodeWithArgs).args;
    const parentOp = node as math.OperatorNode;
    const newArgs = args.map((child, idx) => {
      const isRight = parentOp.type === 'OperatorNode' && idx > 0;
      return stripRedundantParentheses(child, node, isRight);
    });
    return cloneWithChildren(node, newArgs);
  }

  if ('content' in node && (node as unknown as NodeWithContent).content) {
    const content = (node as unknown as NodeWithContent).content;
    const newContent = stripRedundantParentheses(content, node, false);
    return cloneWithChildren(node, [newContent]);
  }

  return node;
};

/**
 * Recursively ensures every node in the equation tree has a stable unique ID.
 * Automatically strips redundant parenthesis before generating stable IDs.
 */
export const ensureNodeIds = (eq: Equation): Equation => {
  // Strip redundant parenthesis across LHS and RHS trees
  const cleanedLhs = stripRedundantParentheses(eq.lhs, null, false);
  const cleanedRhs = stripRedundantParentheses(eq.rhs, null, false);
  const cleanedEq: Equation = { lhs: cleanedLhs, rhs: cleanedRhs };

  let counter = 0;
  // A simple deterministic hash of the equation's text representation to seed prefixes
  const eqStr = `${cleanedEq.lhs ? cleanedEq.lhs.toString() : ''} = ${cleanedEq.rhs ? cleanedEq.rhs.toString() : ''}`;
  let hash = 0;
  for (let i = 0; i < eqStr.length; i++) {
    hash = (hash << 5) - hash + eqStr.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Convert hash to positive base-36 string for a clean alphanumeric prefix
  const hashPrefix = Math.abs(hash).toString(36);

  const generateId = () => `node_${hashPrefix}_${counter++}`;

  const traverseAndAssign = (node: math.MathNode) => {
    if (!node) return;
    const nodeObj = node as unknown as Record<string, string>;
    if (!nodeObj.id) {
      nodeObj.id = generateId();
    }
    const children = getChildren(node);
    children.forEach(traverseAndAssign);
  };

  traverseAndAssign(cleanedEq.lhs);
  traverseAndAssign(cleanedEq.rhs);
  return cleanedEq;
};
