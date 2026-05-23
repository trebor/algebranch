import { atom } from 'jotai';
import { Equation, parseEquation, generateValidMoves, getAllPaths } from 'math-engine';

// Global Initial Value Constants
const INITIAL_EQUATION_STRING = '3 * x + 5 = x + 13';
const DEFAULT_ZERO = 0;

// Base Atoms
export const historyAtom = atom<Equation[]>([
  parseEquation(INITIAL_EQUATION_STRING),
]);

export const currentIndexAtom = atom<number>(DEFAULT_ZERO);

export const selectedPathAtom = atom<string | null>(null);

export const hoverPathAtom = atom<string | null>(null);

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
 * Computes all valid drop target paths reactively when a node is selected.
 * Maps destination paths to the resulting mathematical Equation.
 */
export const validDropPathsAtom = atom<Record<string, Equation>>((get) => {
  const selectedPath = get(selectedPathAtom);
  const currentEq = get(currentEquationAtom);

  if (!selectedPath || !currentEq) {
    return {};
  }

  return generateValidMoves(currentEq, selectedPath);
});

/**
 * Computes the set of all paths in the current equation that have at least one valid drop destination.
 */
export const pathsWithValidMovesAtom = atom<Set<string>>((get) => {
  const currentEq = get(currentEquationAtom);
  const validPaths = new Set<string>();

  if (!currentEq) {
    return validPaths;
  }

  const allPaths = getAllPaths(currentEq);

  allPaths.forEach((path) => {
    try {
      const moves = generateValidMoves(currentEq, path);
      if (Object.keys(moves).length > 0) {
        validPaths.add(path);
      }
    } catch {
      // Graceful fallback
    }
  });

  return validPaths;
});

/**
 * Computes the preview equation reactively.
 * If the user hovers over a valid drop target, it shows the speculative equation.
 * Otherwise, it shows the current active equation.
 */
export const previewEquationAtom = atom<Equation>((get) => {
  const hoverPath = get(hoverPathAtom);
  const validDrops = get(validDropPathsAtom);

  if (hoverPath && hoverPath in validDrops) {
    return validDrops[hoverPath];
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
    const nextHistory = [...history.slice(DEFAULT_ZERO, index + 1), newEq];

    set(historyAtom, nextHistory);
    set(currentIndexAtom, nextHistory.length - 1);
    set(selectedPathAtom, null);
    set(hoverPathAtom, null);
  }
);

/**
 * Resets the entire store to a new starting equation string.
 */
export const resetToEquationStringAtom = atom(
  null,
  (_get, set, eqStr: string) => {
    try {
      const newEq = parseEquation(eqStr);
      set(historyAtom, [newEq]);
      set(currentIndexAtom, DEFAULT_ZERO);
      set(selectedPathAtom, null);
      set(hoverPathAtom, null);
    } catch (err) {
      console.error('Failed to reset equation:', err);
      throw err;
    }
  }
);
