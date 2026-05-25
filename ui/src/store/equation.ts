import { atom } from 'jotai';
import { Equation, parseEquation, generateValidMoves, getAllPaths, getSimplificationForPath, ensureNodeIds } from 'math-engine';

// Global Initial Value Constants
const INITIAL_EQUATION_STRING = '3 * x + 5 = x + 13';
const DEFAULT_ZERO = 0;

// Base Atoms
export const historyAtom = atom<Equation[]>([
  parseEquation(INITIAL_EQUATION_STRING),
]);

export const currentIndexAtom = atom<number>(DEFAULT_ZERO);

export const sourcePathAtom = atom<string | null>(null);

export const hoverPathAtom = atom<string | null>(null);

export const hoverReducePathAtom = atom<string | null>(null);

// New base atom to track the node path that is currently animating its exit
export const animatingExitPathAtom = atom<string | null>(null);

// New base atom to track the stable ID of the node currently animating its entry
export const animatingEntryIdAtom = atom<string | null>(null);

// Derived Atoms (Step 3: Transformations)

/**
 * Returns the current active Equation based on step history pointer.
 */
export const currentEquationAtom = atom<Equation>((get) => {
  const history = get(historyAtom);
  const index = get(currentIndexAtom);
  return history[index];
});

/**
 * Computes all valid drop targets reactively when a node is selected.
 * Maps destination paths to the resulting mathematical Equation.
 */
export const targetPathsAtom = atom<Record<string, Equation>>((get) => {
  const currentEq = get(currentEquationAtom);
  if (!currentEq) {
    return {};
  }

  const sourcePath = get(sourcePathAtom);
  if (sourcePath) {
    const moves = generateValidMoves(currentEq, sourcePath);
    Object.keys(moves).forEach((k) => {
      moves[k] = ensureNodeIds(moves[k]);
    });
    return moves;
  }

  const hoverPath = get(hoverPathAtom);
  if (hoverPath) {
    const moves = generateValidMoves(currentEq, hoverPath);
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
 * If the user hovers over a reduction point or a valid drop target, it shows the speculative equation.
 * Otherwise, it shows the current active equation.
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
 * Push a new equation state to the step history, dropping any redo steps.
 */
export const pushEquationAtom = atom(
  null,
  (get, set, newEq: Equation) => {
    const history = get(historyAtom);
    const index = get(currentIndexAtom);
    const nextHistory = [...history.slice(DEFAULT_ZERO, index + 1), ensureNodeIds(newEq)];

    set(historyAtom, nextHistory);
    set(currentIndexAtom, nextHistory.length - 1);
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
      set(historyAtom, [newEq]);
      set(currentIndexAtom, DEFAULT_ZERO);
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
    } catch (err) {
      console.error('Failed to reset equation:', err);
      throw err;
    }
  }
);
