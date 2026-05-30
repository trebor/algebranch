import { atom } from 'jotai';
import { Equation, parseEquation, generateValidMoves, getAllPaths, getSimplificationForPath, ensureNodeIds, getNodeByPath, replaceNodeAtPath } from 'math-engine';
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
 * Computes all valid drop targets reactively when a node is selected.
 */
export const targetPathsAtom = atom<Record<string, Equation>>((get) => {
  const currentEq = get(currentEquationAtom);
  if (!currentEq) {
    return {};
  }

  const sourcePath = get(sourcePathAtom);
  if (sourcePath) {
    const moves = generateValidMoves(currentEq, sourcePath);
    delete moves[sourcePath];
    Object.keys(moves).forEach((k) => {
      moves[k] = ensureNodeIds(moves[k]);
    });
    return moves;
  }

  const hoverPath = get(hoverPathAtom);
  if (hoverPath) {
    const moves = generateValidMoves(currentEq, hoverPath);
    delete moves[hoverPath];
    Object.keys(moves).forEach((k) => {
      moves[k] = ensureNodeIds(moves[k]);
    });
    return moves;
  }

  return {};
});

/**
 * Computes the set of all paths in the current equation that are active (have valid transformations).
 */
export const activePathsAtom = atom<Set<string>>((get) => {
  const currentEq = get(currentEquationAtom);
  const activePaths = new Set<string>();

  if (!currentEq) {
    return activePaths;
  }

  const allPaths = getAllPaths(currentEq);

  allPaths.forEach((path) => {
    try {
      const moves = generateValidMoves(currentEq, path);
      if (Object.keys(moves).length > 0) {
        activePaths.add(path);
      }
    } catch {
      // Graceful fallback
    }
  });

  return activePaths;
});

/**
 * Computes all paths that have reduction opportunities, mapping paths to the reduced equation.
 */
export const reduciblePathsAtom = atom<Record<string, Equation>>((get) => {
  const currentEq = get(currentEquationAtom);
  const reducible: Record<string, Equation> = {};

  if (!currentEq) {
    return reducible;
  }

  const allPaths = getAllPaths(currentEq);

  allPaths.forEach((path) => {
    try {
      const simplified = getSimplificationForPath(currentEq, path);
      if (simplified) {
        reducible[path] = ensureNodeIds(simplified);
      }
    } catch {
      // Graceful fallback
    }
  });

  return reducible;
});

/**
 * Computes the preview equation reactively.
 */
export const previewEquationAtom = atom<Equation>((get) => {
  const hoverReducePath = get(hoverReducePathAtom);
  const reducible = get(reduciblePathsAtom);

  if (hoverReducePath && hoverReducePath in reducible) {
    return reducible[hoverReducePath];
  }

  const hoverPath = get(hoverPathAtom);
  const targetPaths = get(targetPathsAtom);

  if (hoverPath && hoverPath in targetPaths) {
    return targetPaths[hoverPath];
  }
  return get(currentEquationAtom);
});

// Write-only Actions

/**
 * Push a new equation state to the step history tree.
 */
export const pushEquationAtom = atom(
  null,
  (get, set, newEq: Equation, stepLabel?: string) => {
    const tree = get(historyTreeAtom);
    const currentNodeId = get(currentNodeIdAtom);
    
    // Automatically determine label based on active interactions
    let label = stepLabel || "Move";
    if (!stepLabel) {
      if (get(hoverReducePathAtom)) {
        label = "Reduce";
      } else if (get(sourcePathAtom)) {
        label = "Transpose";
      }
    }

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
    set(currentNodeIdAtom, newId);
    set(sourcePathAtom, null);
    set(hoverPathAtom, null);
    set(hoverReducePathAtom, null);
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
