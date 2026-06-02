import { atom } from 'jotai';
import { Equation, parseEquation, ensureNodeIds, getNodeByPath, replaceNodeAtPath, equationToString, deserializeEquation, SerializedEquation, getFunctionName } from 'math-engine-client';
import * as math from 'mathjs';

// Global Initial Value Constants
const INITIAL_EQUATION_STRING = '3 * x + 5 = x + 13';

// Tree Interface Definition
export interface HistoryNode {
  id: string;
  equation: Equation;
  parentId: string | null;
  childrenIds: string[];
  label: string;
  timestamp: number;
}

export interface VisualTreeNode extends HistoryNode {
  depth: number;
  column: number;
  x: number;
  y: number;
}

// Tree Coordinates Constants
const ROW_HEIGHT = 72;
const COL_WIDTH = 75;
const BUBBLE_SIZE = 40;
const PADDING_LEFT = 40;
const PADDING_TOP = 32;

// Base Atoms
export const historyTreeAtom = atom<Record<string, HistoryNode>>({
  "0": {
    id: "0",
    equation: parseEquation(INITIAL_EQUATION_STRING),
    parentId: null,
    childrenIds: [],
    label: "Initial",
    timestamp: Date.now(),
  }
});

export const currentNodeIdAtom = atom<string>("0");

export const sourcePathAtom = atom<string | null>(null);
export const hoverPathAtom = atom<string | null>(null);
export const hoverReducePathAtom = atom<string | null>(null);
export const hoveredLoopTargetIdAtom = atom<string | null>(null);

export interface ReduciblePathInfo {
  equation: Equation;
  type: 'reduce' | 'distribute';
}

// Dynamic Server-Synchronized Atoms
export const candidatePathsAtom = atom<Set<string>>(new Set<string>());
export const targetPathsAtom = atom<Record<string, Equation>>({});
export const reduciblePathsAtom = atom<Record<string, ReduciblePathInfo>>({});

// Derived Atoms

/**
 * Returns the current active Equation based on step history tree pointer.
 */
export const currentEquationAtom = atom<Equation>((get) => {
  const tree = get(historyTreeAtom);
  const nodeId = get(currentNodeIdAtom);
  return tree[nodeId]?.equation;
});

/**
 * Computes the absolute layout coordinates of the tree using DFS.
 */
export const treeLayoutAtom = atom<Record<string, VisualTreeNode>>((get) => {
  const tree = get(historyTreeAtom);
  const result: Record<string, VisualTreeNode> = {};
  let nextColumn = 0;

  const traverse = (id: string, depth: number, parentColumn: number | null) => {
    const node = tree[id];
    if (!node) return;

    // First child continues parent's column straight down, others branch right
    const col = parentColumn === null ? 0 : parentColumn;

    result[id] = {
      ...node,
      depth,
      column: col,
      x: PADDING_LEFT + col * COL_WIDTH,
      y: PADDING_TOP + depth * ROW_HEIGHT,
    };

    node.childrenIds.forEach((childId, idx) => {
      let childCol = col;
      if (idx > 0) {
        nextColumn++;
        childCol = nextColumn;
      }
      traverse(childId, depth + 1, childCol);
    });
  };

  traverse("0", 0, null);
  return result;
});

/**
 * Computes the preview equation reactively.
 */
export const previewEquationAtom = atom<Equation>((get) => {
  const hoverReducePath = get(hoverReducePathAtom);
  const reducible = get(reduciblePathsAtom);

  if (hoverReducePath && hoverReducePath in reducible) {
    return reducible[hoverReducePath].equation;
  }

  const hoverPath = get(hoverPathAtom);
  const targetPaths = get(targetPathsAtom);

  if (hoverPath && hoverPath in targetPaths) {
    return targetPaths[hoverPath];
  }
  return get(currentEquationAtom);
});

const normalizeAST = (node: math.MathNode): math.MathNode => {
  if (!node) return node;

  if (node.type === 'OperatorNode') {
    const opNode = node as math.OperatorNode;
    const normalizedArgs = opNode.args.map(arg => normalizeAST(arg));
    if (opNode.op === '+' || opNode.op === '*') {
      // Commutative sorting of arguments based on their string representation
      normalizedArgs.sort((a, b) => a.toString().localeCompare(b.toString()));
    }
    return new math.OperatorNode(opNode.op, opNode.fn, normalizedArgs);
  }

  if (node.type === 'ParenthesisNode') {
    const parenNode = node as math.ParenthesisNode;
    return new math.ParenthesisNode(normalizeAST(parenNode.content));
  }

  if (node.type === 'FunctionNode') {
    const fnNode = node as math.FunctionNode;
    const normalizedArgs = fnNode.args.map(arg => normalizeAST(arg));
    return new math.FunctionNode(getFunctionName(fnNode), normalizedArgs);
  }

  return node;
};

// Canonicalization Helper to detect structurally & commutatively identical equations in history
export const getCanonicalKey = (eqVal: Equation): string => {
  try {
    const normLhs = normalizeAST(eqVal.lhs);
    const normRhs = normalizeAST(eqVal.rhs);
    return `${normLhs.toString()} = ${normRhs.toString()}`;
  } catch {
    return equationToString(eqVal);
  }
};

// Write-only Actions

/**
 * Push a new equation state to the step history tree.
 */
export const pushEquationAtom = atom(
  null,
  (get, set, newEq: Equation, stepLabel?: string) => {
    const tree = get(historyTreeAtom);
    const currentNodeId = get(currentNodeIdAtom);
    const activeNode = tree[currentNodeId];
    
    // Check if any existing child of the active node is canonically equivalent to newEq
    const newCanonical = getCanonicalKey(newEq);
    if (activeNode) {
      const existingChildId = activeNode.childrenIds.find(childId => {
        const childNode = tree[childId];
        return childNode && getCanonicalKey(childNode.equation) === newCanonical;
      });
      
      if (existingChildId) {
        // Canonical match found! Select the existing branch node instead of duplicating it
        set(currentNodeIdAtom, existingChildId);
        set(sourcePathAtom, null);
        set(hoverPathAtom, null);
        set(hoverReducePathAtom, null);
        set(hoveredLoopTargetIdAtom, null);
        return;
      }
    }

    let label = stepLabel || "Move";
    if (!stepLabel) {
      const hoverReducePath = get(hoverReducePathAtom);
      if (hoverReducePath) {
        const reducible = get(reduciblePathsAtom);
        const actionType = hoverReducePath && reducible[hoverReducePath]?.type;
        label = actionType === 'distribute' ? 'Distribute' : 'Reduce';
      } else if (get(sourcePathAtom)) {
        label = "Transpose";
      }
    }

    // Find the earliest node in the entire history tree that is canonically equivalent to newEq (Loop Detection)
    let loopAncestorId: string | null = null;
    let earliestTimestamp = Infinity;
    
    Object.values(tree).forEach(node => {
      if (getCanonicalKey(node.equation) === newCanonical) {
        if (node.timestamp < earliestTimestamp) {
          earliestTimestamp = node.timestamp;
          loopAncestorId = node.id;
        }
      }
    });

    const newId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: HistoryNode = {
      id: newId,
      equation: ensureNodeIds(newEq),
      parentId: currentNodeId,
      childrenIds: [],
      label,
      timestamp: Date.now(),
    };

    const updatedTree = {
      ...tree,
      [newId]: newNode,
      [currentNodeId]: {
        ...tree[currentNodeId],
        childrenIds: [...tree[currentNodeId].childrenIds, newId],
      },
    };

    set(historyTreeAtom, updatedTree);
    
    if (loopAncestorId) {
      // Loop detected! Go back one step just before the loop (select the parent node) to let the user explore a different path
      set(currentNodeIdAtom, currentNodeId);
    } else {
      // Normal state progression: select the newly created node
      set(currentNodeIdAtom, newId);
    }

    set(sourcePathAtom, null);
    set(hoverPathAtom, null);
    set(hoverReducePathAtom, null);
    set(hoveredLoopTargetIdAtom, null);
  }
);

/**
 * Resets the entire store to a new starting equation string.
 */
export const resetToEquationStringAtom = atom(
  null,
  (_get, set, eqStr: string) => {
    try {
      const newEq = ensureNodeIds(parseEquation(eqStr));
      set(historyTreeAtom, {
        "0": {
          id: "0",
          equation: newEq,
          parentId: null,
          childrenIds: [],
          label: "Initial",
          timestamp: Date.now(),
        }
      });
      set(currentNodeIdAtom, "0");
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoveredLoopTargetIdAtom, null);
    } catch (err) {
      console.error('Failed to reset equation:', err);
      throw err;
    }
  }
);

/**
 * Action: Toggles the sign of a square root at the specified path (+/-).
 */
export const toggleRootSignAtom = atom(
  null,
  (get, set, path: string) => {
    const currentEq = get(currentEquationAtom);
    if (!currentEq) return;

    try {
      const targetNode = getNodeByPath(currentEq, path);
      let nextNode: math.MathNode;

      if (
        targetNode.type === 'OperatorNode' &&
        (targetNode as math.OperatorNode).op === '-' &&
        (targetNode as math.OperatorNode).isUnary()
      ) {
        nextNode = (targetNode as math.OperatorNode).args[0];
      } else {
        nextNode = new math.OperatorNode('-', 'subtract', [targetNode]);
      }

      const nextEq = replaceNodeAtPath(currentEq, path, nextNode);
      set(pushEquationAtom, nextEq, "Root ±");
    } catch (err) {
      console.error('Failed to toggle root sign in store action:', err);
    }
  }
);

/**
 * Action: Applies an algebraic operation to both sides of the active equation simultaneously.
 */
export const applyGlobalOpAtom = atom(
  null,
  (get, set, { type, term }: { type: 'square' | 'sqrt' | 'add' | 'sub' | 'mul' | 'div'; term?: string }) => {
    const currentEq = get(currentEquationAtom);
    if (!currentEq) return;

    let nextLhs: math.MathNode;
    let nextRhs: math.MathNode;
    let label = `Global ${type === 'square' ? 'Sq' : type === 'sqrt' ? 'Sqrt' : type.toUpperCase()}`;

    if (type === 'square') {
      const exponentNode = new math.ConstantNode(2);
      nextLhs = new math.OperatorNode('^', 'pow', [currentEq.lhs, exponentNode]);
      nextRhs = new math.OperatorNode('^', 'pow', [currentEq.rhs, exponentNode]);
    } else if (type === 'sqrt') {
      nextLhs = new math.FunctionNode('sqrt', [currentEq.lhs]);
      nextRhs = new math.FunctionNode('sqrt', [currentEq.rhs]);
    } else {
      if (!term || !term.trim()) {
        throw new Error('Please specify a term to apply to both sides (e.g. 5x).');
      }

      const parsedTerm = math.parse(term.trim());
      label = `Global ${type === 'add' ? '+' : type === 'sub' ? '-' : type === 'mul' ? '×' : '÷'} ${term.trim()}`;

      if (type === 'add') {
        nextLhs = new math.OperatorNode('+', 'add', [currentEq.lhs, parsedTerm]);
        nextRhs = new math.OperatorNode('+', 'add', [currentEq.rhs, parsedTerm]);
      } else if (type === 'sub') {
        nextLhs = new math.OperatorNode('-', 'subtract', [currentEq.lhs, parsedTerm]);
        nextRhs = new math.OperatorNode('-', 'subtract', [currentEq.rhs, parsedTerm]);
      } else if (type === 'mul') {
        nextLhs = new math.OperatorNode('*', 'multiply', [currentEq.lhs, parsedTerm]);
        nextRhs = new math.OperatorNode('*', 'multiply', [currentEq.rhs, parsedTerm]);
      } else {
        nextLhs = new math.OperatorNode('/', 'divide', [currentEq.lhs, parsedTerm]);
        nextRhs = new math.OperatorNode('/', 'divide', [currentEq.rhs, parsedTerm]);
      }
    }

    const nextEq: Equation = { lhs: nextLhs, rhs: nextRhs };
    set(pushEquationAtom, nextEq, label);
  }
);

/**
 * Action: Atomically synchronizes the server-side math state (candidate, reducible, and target paths)
 * by deserializing their serialized AST objects back into mathjs Equation trees.
 */
export const syncMathStateAtom = atom(
  null,
  (_get, set, { activePaths, reduciblePaths, targetPaths }: { 
    activePaths: string[]; 
    reduciblePaths: Record<string, { equation: SerializedEquation; type: 'reduce' | 'distribute' }>; 
    targetPaths: Record<string, SerializedEquation> 
  }) => {
    set(candidatePathsAtom, new Set<string>(activePaths));

    const parsedReducible: Record<string, ReduciblePathInfo> = {};
    Object.keys(reduciblePaths).forEach((k) => {
      parsedReducible[k] = {
        equation: deserializeEquation(reduciblePaths[k].equation),
        type: reduciblePaths[k].type
      };
    });
    set(reduciblePathsAtom, parsedReducible);

    const parsedTargets: Record<string, Equation> = {};
    Object.keys(targetPaths).forEach((k) => {
      parsedTargets[k] = deserializeEquation(targetPaths[k]);
    });
    set(targetPathsAtom, parsedTargets);
  }
);

