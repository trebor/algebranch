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
  if ('args' in node && Array.isArray((node as unknown as NodeWithArgs).args)) {
    const cloned = node.clone() as unknown as NodeWithArgs;
    cloned.args = newChildren;
    return cloned;
  }
  if ('content' in node && (node as unknown as NodeWithContent).content) {
    const cloned = node.clone() as unknown as NodeWithContent;
    cloned.content = newChildren[0];
    return cloned;
  }
  return node;
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
 * Recursively ensures every node in the equation tree has a stable unique ID.
 * Preserves existing IDs if they are already present.
 */
export const ensureNodeIds = (eq: Equation): Equation => {
  let counter = 0;
  const generateId = () => `node_${Math.random().toString(36).substring(2, 9)}_${counter++}`;

  const traverseAndAssign = (node: math.MathNode) => {
    if (!node) return;
    if (!(node as any).id) {
      (node as any).id = generateId();
    }
    const children = getChildren(node);
    children.forEach(traverseAndAssign);
  };

  traverseAndAssign(eq.lhs);
  traverseAndAssign(eq.rhs);
  return eq;
};
