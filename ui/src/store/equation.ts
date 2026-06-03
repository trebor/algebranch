import { atom } from 'jotai';
import { Equation, parseEquation, ensureNodeIds, getNodeByPath, replaceNodeAtPath, equationToString, serializeEquation, deserializeEquation, SerializedEquation, getFunctionName } from 'math-engine-client';
import * as math from 'mathjs';
import { Preset, PRESET_LIST } from '../constants/presets';

// Global Initial Value Constants
export const INITIAL_EQUATION_STRING = '2 * (x + 3) = 10';

// Tree Interface Definition
export interface HistoryNode {
  id: string;
  equation: Equation;
  parentId: string | null;
  childrenIds: string[];
  label: string;
  timestamp: number;
}

export interface SerializedHistoryNode {
  id: string;
  equation: SerializedEquation;
  parentId: string | null;
  childrenIds: string[];
  label: string;
  timestamp: number;
}

export interface SavedSession {
  id: string;
  name: string;
  timestamp: number;
  tree: Record<string, SerializedHistoryNode>;
  currentNodeId: string;
}

export const serializeTree = (tree: Record<string, HistoryNode>): Record<string, SerializedHistoryNode> => {
  const serialized: Record<string, SerializedHistoryNode> = {};
  Object.keys(tree).forEach(id => {
    serialized[id] = {
      ...tree[id],
      equation: serializeEquation(tree[id].equation)
    };
  });
  return serialized;
};

export const deserializeTree = (serialized: Record<string, SerializedHistoryNode>): Record<string, HistoryNode> => {
  const tree: Record<string, HistoryNode> = {};
  Object.keys(serialized).forEach(id => {
    tree[id] = {
      ...serialized[id],
      equation: deserializeEquation(serialized[id].equation)
    };
  });
  return tree;
};

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

// Saved sessions state
export const savedSessionsAtom = atom<SavedSession[]>([]);
export const currentSessionIdAtom = atom<string>("session_initial");

// Presets state atoms
export const presetsAtom = atom<Preset[]>(PRESET_LIST);

export interface PresetCategoryGroup {
  category: string;
  presets: Preset[];
}

export const presetCategoriesAtom = atom<PresetCategoryGroup[]>((get) => {
  const presets = get(presetsAtom);
  const groups: Record<string, Preset[]> = {};
  
  presets.forEach((p) => {
    if (!groups[p.category]) {
      groups[p.category] = [];
    }
    groups[p.category].push(p);
  });

  return Object.entries(groups).map(([category, items]) => ({
    category,
    presets: items,
  }));
});

export const sourcePathAtom = atom<string | null>(null);
export const hoverPathAtom = atom<string | null>(null);
export const hoverReducePathAtom = atom<string | null>(null);
export const hoverReduceIndexAtom = atom<number | null>(null);
export const hoveredLoopTargetIdAtom = atom<string | null>(null);
export const leftSidebarOpenAtom = atom(true);
export const rightSidebarOpenAtom = atom(true);
export const feedbackModalOpenAtom = atom(false);

export interface ReducibleActionInfo {
  equation: Equation;
  type: 'reduce' | 'distribute' | 'identity';
  label?: string;
}

// Dynamic Server-Synchronized Atoms
export const candidatePathsAtom = atom<Set<string>>(new Set<string>());
export const targetPathsAtom = atom<Record<string, Equation>>({});
export const reduciblePathsAtom = atom<Record<string, ReducibleActionInfo[]>>({});

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
  const hoverReduceIndex = get(hoverReduceIndexAtom);
  const reducible = get(reduciblePathsAtom);

  if (hoverReducePath && hoverReducePath in reducible) {
    const actions = reducible[hoverReducePath];
    const index = hoverReduceIndex !== null ? hoverReduceIndex : 0;
    const action = actions[index];
    if (action) {
      return action.equation;
    }
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
    
    const newCanonical = getCanonicalKey(newEq);

    // 1. Find the earliest node in the entire history tree that is canonically equivalent to newEq (Loop Detection)
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

    // 2. Check if a child matching this canonical key already exists
    let existingChildId: string | undefined;
    if (activeNode) {
      existingChildId = activeNode.childrenIds.find(childId => {
        const childNode = tree[childId];
        return childNode && getCanonicalKey(childNode.equation) === newCanonical;
      });
    }

    if (loopAncestorId) {
      // Loop Detected!
      if (existingChildId) {
        // If the loop node child already exists, jump selection directly to the loop ancestor node
        set(currentNodeIdAtom, loopAncestorId);
        set(sourcePathAtom, null);
        set(hoverPathAtom, null);
        set(hoverReducePathAtom, null);
        set(hoverReduceIndexAtom, null);
        set(hoveredLoopTargetIdAtom, null);
        return;
      }
      
      // Otherwise, we need to create the loop node under the parent, but redirect active selection to the loop ancestor node
    } else {
      // Normal state progression (No Loop)
      if (existingChildId) {
        // Transition down the existing progress branch node
        set(currentNodeIdAtom, existingChildId);
        set(sourcePathAtom, null);
        set(hoverPathAtom, null);
        set(hoverReducePathAtom, null);
        set(hoverReduceIndexAtom, null);
        set(hoveredLoopTargetIdAtom, null);
        return;
      }
    }

    // Node creation path (either a new loop bubble or a new progress node)
    let label = stepLabel || "Move";
    if (!stepLabel) {
      const hoverReducePath = get(hoverReducePathAtom);
      const hoverReduceIndex = get(hoverReduceIndexAtom);
      if (hoverReducePath) {
        const reducible = get(reduciblePathsAtom);
        const actions = reducible[hoverReducePath];
        const index = hoverReduceIndex !== null ? hoverReduceIndex : 0;
        const action = actions?.[index];
        if (action) {
          const actionType = action.type;
          if (actionType === 'identity') {
            label = action.label || 'Apply Identity';
          } else {
            label = actionType === 'distribute' ? 'Distribute' : 'Reduce';
          }
        }
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
    
    if (loopAncestorId) {
      // Loop detected: select the loop ancestor node directly
      set(currentNodeIdAtom, loopAncestorId);
    } else {
      // Normal state progression: select the newly created progress node
      set(currentNodeIdAtom, newId);
    }

    set(sourcePathAtom, null);
    set(hoverPathAtom, null);
    set(hoverReducePathAtom, null);
    set(hoverReduceIndexAtom, null);
    set(hoveredLoopTargetIdAtom, null);
  }
);

/**
 * Action: Create a new blank session.
 */
export const createNewSessionAtom = atom(
  null,
  (get, set, initialEqStr?: string) => {
    const eqStr = initialEqStr || INITIAL_EQUATION_STRING;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const newEq = ensureNodeIds(parseEquation(eqStr));
      const newTree: Record<string, HistoryNode> = {
        "0": {
          id: "0",
          equation: newEq,
          parentId: null,
          childrenIds: [],
          label: "Initial",
          timestamp: Date.now(),
        }
      };

      set(historyTreeAtom, newTree);
      set(currentNodeIdAtom, "0");
      set(currentSessionIdAtom, newId);
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoverReduceIndexAtom, null);
      set(hoveredLoopTargetIdAtom, null);

      // Add to saved sessions list immediately
      const sessions = get(savedSessionsAtom);
      const newSession: SavedSession = {
        id: newId,
        name: eqStr,
        timestamp: Date.now(),
        tree: serializeTree(newTree),
        currentNodeId: "0",
      };
      const updatedSessions = [newSession, ...sessions];
      set(savedSessionsAtom, updatedSessions);

      try {
        localStorage.setItem('algebranch_saved_sessions', JSON.stringify(updatedSessions));
        localStorage.setItem('algebranch_current_session_id', newId);
      } catch (err) {
        console.error('Failed to save sessions to localStorage:', err);
      }
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  }
);

/**
 * Action: Load a specific session by ID.
 */
export const loadSessionAtom = atom(
  null,
  (get, set, sessionId: string) => {
    const sessions = get(savedSessionsAtom);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    try {
      const deserialized = deserializeTree(session.tree);
      set(historyTreeAtom, deserialized);
      set(currentNodeIdAtom, session.currentNodeId);
      set(currentSessionIdAtom, sessionId);
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoverReduceIndexAtom, null);
      set(hoveredLoopTargetIdAtom, null);

      try {
        localStorage.setItem('algebranch_current_session_id', sessionId);
      } catch (err) {
        console.error('Failed to save active session ID:', err);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }
);

/**
 * Action: Delete a specific session by ID.
 */
export const deleteSessionAtom = atom(
  null,
  (get, set, sessionId: string) => {
    const sessions = get(savedSessionsAtom);
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    set(savedSessionsAtom, updatedSessions);

    // Save updated sessions to localStorage immediately
    try {
      localStorage.setItem('algebranch_saved_sessions', JSON.stringify(updatedSessions));
    } catch (err) {
      console.error('Failed to save sessions after deletion:', err);
    }

    const currentSessionId = get(currentSessionIdAtom);
    if (currentSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        // Load the most recent session
        const nextSession = updatedSessions[0];
        set(loadSessionAtom, nextSession.id);
      } else {
        // Create a new blank session
        set(createNewSessionAtom);
      }
    }
  }
);

/**
 * Resets the entire store to a new starting equation string.
 */
export const resetToEquationStringAtom = atom(
  null,
  (_get, set, eqStr: string) => {
    set(createNewSessionAtom, eqStr);
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
  (get, set, { type, term, power }: { type: 'square' | 'sqrt' | 'add' | 'sub' | 'mul' | 'div' | 'power' | 'root'; term?: string; power?: number }) => {
    const currentEq = get(currentEquationAtom);
    if (!currentEq) return;

    let nextLhs: math.MathNode;
    let nextRhs: math.MathNode;
    let label = '';

    const effectivePower = power ?? 2;

    if (type === 'square' || type === 'power') {
      const exponentNode = new math.ConstantNode(effectivePower);
      nextLhs = new math.OperatorNode('^', 'pow', [currentEq.lhs, exponentNode]);
      nextRhs = new math.OperatorNode('^', 'pow', [currentEq.rhs, exponentNode]);
      label = effectivePower === 2 ? 'Global Sq' : `Global Power ${effectivePower}`;
    } else if (type === 'sqrt' || type === 'root') {
      if (effectivePower === 2) {
        nextLhs = new math.FunctionNode('sqrt', [currentEq.lhs]);
        nextRhs = new math.FunctionNode('sqrt', [currentEq.rhs]);
        label = 'Global Sqrt';
      } else {
        const rootIndexNode = new math.ConstantNode(effectivePower);
        nextLhs = new math.FunctionNode('nthRoot', [currentEq.lhs, rootIndexNode]);
        nextRhs = new math.FunctionNode('nthRoot', [currentEq.rhs, rootIndexNode]);
        label = `Global ${effectivePower}-Root`;
      }
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
    reduciblePaths: Record<string, { equation: SerializedEquation; type: 'reduce' | 'distribute' | 'identity'; label?: string }[]>; 
    targetPaths: Record<string, SerializedEquation> 
  }) => {
    set(candidatePathsAtom, new Set<string>(activePaths));

    const parsedReducible: Record<string, ReducibleActionInfo[]> = {};
    Object.keys(reduciblePaths).forEach((k) => {
      parsedReducible[k] = reduciblePaths[k].map(item => ({
        equation: deserializeEquation(item.equation),
        type: item.type,
        label: item.label
      }));
    });
    set(reduciblePathsAtom, parsedReducible);

    const parsedTargets: Record<string, Equation> = {};
    Object.keys(targetPaths).forEach((k) => {
      parsedTargets[k] = deserializeEquation(targetPaths[k]);
    });
    set(targetPathsAtom, parsedTargets);
  }
);

/**
 * Action: Clears the server-side math state to avoid stale highlights/actions rendering during transitions.
 */
export const clearMathStateAtom = atom(
  null,
  (_get, set) => {
    set(candidatePathsAtom, new Set<string>());
    set(reduciblePathsAtom, {});
    set(targetPathsAtom, {});
  }
);


