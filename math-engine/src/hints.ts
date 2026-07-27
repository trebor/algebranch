// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { Equation, getNodeByPath } from './tree';
import { equationToString } from './index';
import { isEquationSolved, getReducibleOptions, getSimplificationForPath } from './simplify';
import { applyGlobalOp } from './globalOps';
import { getActivePaths } from './sync';
import { generateValidMoves, getFunctionName } from './validator';
import { mjs } from './mathjs';

export interface HintOptions {
  readonly progressiveMode?: boolean;
  readonly allowedReduciblePaths?: Record<string, any>;
}

export interface HintStep {
  readonly strategicGoal: string;
  readonly focusPath: string | null;
  readonly destinationPath?: string | null;
  readonly focusDescription: string;
  readonly actionableMove: string;
  readonly targetNodeId?: string;
  readonly actionType?: 'reduce' | 'simplify' | 'expand' | 'factor' | 'identity' | 'substitute' | 'equals';
  readonly nextEq: Equation;
}

export interface HintLadder {
  readonly strategicGoal: string;
  readonly focusPath: string | null;
  readonly destinationPath?: string | null;
  readonly focusDescription: string;
  readonly actionableMove: string;
  readonly targetNodeId?: string;
  readonly actionType?: 'reduce' | 'simplify' | 'expand' | 'factor' | 'identity' | 'substitute' | 'equals';
}

interface StateNode {
  readonly eq: Equation;
  readonly pathFromStart: HintStep[];
  readonly depth: number;
  readonly score: number;
}

const KNOWN_CONSTANTS = new Set(['e', 'pi', 'tau', 'i', 'ⅈ', 'E', 'PI']);
const KNOWN_FUNCTIONS = new Set([
  'sqrt',
  'nthRoot',
  'cbrt',
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'asin',
  'acos',
  'atan',
  'asec',
  'acsc',
  'acot',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'log10',
  'log2',
  'ln',
  'exp',
  'abs',
  'sign',
  'floor',
  'ceil',
  'round',
  'min',
  'max',
  'sum',
  'factorial',
  'gamma',
]);

/**
 * Strips parentheses from user-facing copy to comply with strict design rules.
 */
const sanitizeCopy = (str: string): string => {
  return str.replace(/[()]/g, '').trim();
};

/**
 * Normalizes equation string representation for duplicate state detection in graph search.
 */
const canonicalEqKey = (eq: Equation): string => {
  try {
    return equationToString(eq).replace(/\s+/g, '');
  } catch {
    return `${eq.lhs.toString()}=${eq.rhs.toString()}`.replace(/\s+/g, '');
  }
};

/**
 * Counts occurrences of targetVar in an AST node tree.
 */
export const countVariableOccurrences = (node: math.MathNode, targetVar: string): number => {
  let count = 0;
  node.traverse((n) => {
    if (n.type === 'SymbolNode' && (n as math.SymbolNode).name === targetVar) {
      count++;
    }
  });
  return count;
};

/**
 * Checks whether an AST node contains the target variable.
 */
export const hasVariableInTree = (node: math.MathNode, targetVar: string): boolean => {
  return countVariableOccurrences(node, targetVar) > 0;
};

/**
 * Returns all unique variable symbols in an equation (excluding mathematical constants and function names).
 */
export const getUniqueVariables = (eq: Equation): string[] => {
  const symbols = new Set<string>();
  const collect = (root: math.MathNode) => {
    root.traverse((n, _path, parent) => {
      if (n.type === 'SymbolNode') {
        if (parent && parent.type === 'FunctionNode' && (parent as any).fn === n) {
          return;
        }
        const name = (n as math.SymbolNode).name;
        if (!KNOWN_CONSTANTS.has(name) && !KNOWN_FUNCTIONS.has(name)) {
          symbols.add(name);
        }
      }
    });
  };
  collect(eq.lhs);
  collect(eq.rhs);
  return Array.from(symbols);
};

/**
 * Checks whether an equation is eligible for automated step-by-step hinting (1 variable or 0 variables).
 */
export const isHintableEquation = (eq: Equation): boolean => {
  const vars = getUniqueVariables(eq);
  return vars.length <= 1;
};

/**
 * Finds target variable in equation (defaults to 'x', or first symbol found).
 */
export const getTargetVariable = (eq: Equation): string => {
  const vars = getUniqueVariables(eq);
  if (vars.includes('x')) return 'x';
  if (vars.length > 0) return vars[0];
  return 'x';
};

const isReductionType = (type?: string): boolean => {
  return type === 'reduce' || type === 'simplify';
};

/**
 * Calculates heuristic score bonus for a candidate derivation transition.
 * Rewards pure local arithmetic simplification ('reduce' / 'simplify') and innermost AST depth (inside-out ordering).
 * Penalizes structural rewrites ('identity' / 'expand') when direct numerical evaluation is available.
 */
export const calculateTransitionBonus = (step: HintStep): number => {
  let bonus = 0;

  // 1. Pure local reductions get top priority over transpositions or structural rewrites
  if (step.destinationPath === undefined && isReductionType(step.actionType)) {
    bonus += 200;
  } else if (step.destinationPath !== undefined) {
    bonus += 50; // Term transposition
  } else if (step.actionType === 'identity' || step.actionType === 'expand') {
    bonus -= 50; // Structural rewrite penalty
  }

  // 2. Innermost AST Depth Bonus (inside-out evaluation order preference)
  if (step.focusPath && step.focusPath !== 'equals') {
    const pathDepth = step.focusPath.split(/[/|#]/).length;
    bonus += Math.min(30, (pathDepth - 1) * 10);
  }

  return bonus;
};

/**
 * Leaf node / state evaluation score heuristic.
 * Scores an equation state based on distance to solved state for target variable.
 */
export const scoreEquationState = (eq: Equation, targetVar: string): number => {
  if (isEquationSolved(eq)) {
    return 1000;
  }

  let lhsVarCount = countVariableOccurrences(eq.lhs, targetVar);
  let rhsVarCount = countVariableOccurrences(eq.rhs, targetVar);
  let lhsNodeCount = 0;
  let rhsNodeCount = 0;

  eq.lhs.traverse(() => lhsNodeCount++);
  eq.rhs.traverse(() => rhsNodeCount++);

  let score = 0;

  // 1. Variable Isolation Score: bonus if variable appears on one side only
  if ((lhsVarCount > 0 && rhsVarCount === 0) || (rhsVarCount > 0 && lhsVarCount === 0)) {
    score += 250;
  }

  // 2. Variable Count Score: penalty for total occurrences of target variable
  const totalVars = lhsVarCount + rhsVarCount;
  score += Math.max(0, 150 - totalVars * 40);

  // 3. AST Complexity Score: penalty for total AST node count
  const totalNodes = lhsNodeCount + rhsNodeCount;
  score += Math.max(0, 100 - totalNodes * 3);

  // 4. Target variable isolated on LHS preference (x = constant)
  if (eq.lhs.type === 'SymbolNode' && (eq.lhs as math.SymbolNode).name === targetVar && rhsVarCount === 0) {
    score += 200;
  }

  return score;
};

/**
 * Generates human-friendly, educational focus guidance for targeted math nodes.
 */
export const describeNodePath = (eq: Equation, path: string): string => {
  if (path === 'equals' || path === '=') return 'Focus on the equals sign = to balance both sides';
  if (path === 'lhs') return 'Focus on the left side of the equation';
  if (path === 'rhs') return 'Focus on the right side of the equation';

  try {
    const node = getNodeByPath(eq, path);
    const rawStr = node.toString().replace(/[()]/g, '').trim();

    if (node.type === 'ConstantNode') {
      return `Focus on number ${rawStr}`;
    }
    if (node.type === 'SymbolNode') {
      return `Focus on variable ${rawStr}`;
    }
    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;
      if (opNode.op === '*') {
        return `Focus on term ${rawStr}`;
      }
      return `Focus on expression ${rawStr}`;
    }
    if (node.type === 'FunctionNode') {
      return `Focus on function ${rawStr}`;
    }
    return `Focus on expression ${rawStr}`;
  } catch {
    if (path.startsWith('lhs')) return 'Focus on the left side of the equation';
    if (path.startsWith('rhs')) return 'Focus on the right side of the equation';
    return 'Focus on target expression';
  }
};

/**
 * State Transition Generator: Given an equation state E, computes all valid successor equation states E'
 * strictly derived from the Math Engine's three canonical entrypoints:
 * 1. Local Reductions: getReducibleOptions & getSimplificationForPath (filtered by options.allowedReduciblePaths / progressiveMode)
 * 2. Term Transpositions: getActivePaths & generateValidMoves
 * 3. Global Operations: applyGlobalOp
 */
export const getSuccessorStates = (eq: Equation, targetVar: string, options?: HintOptions): HintStep[] => {
  const steps: HintStep[] = [];
  const startKey = canonicalEqKey(eq);

  // 1. Local Simplification / Reduction Transitions (from Math Engine's getReducibleOptions)
  const rawReducibleOptions = getReducibleOptions(eq);
  const rawPaths = Object.keys(rawReducibleOptions);

  const filteredOptionsMap: Record<string, any[]> = {};
  rawPaths.forEach((p) => {
    filteredOptionsMap[p] = [...(rawReducibleOptions[p] || [])];
  });

  // Apply Progressive Mode inside-out reduction filtering
  if (options?.progressiveMode) {
    const reducePaths = new Set(
      rawPaths.filter((p) => rawReducibleOptions[p]?.some((opt) => isReductionType(opt.type)))
    );

    rawPaths.forEach((path) => {
      const hasReduceDescendant = Array.from(reducePaths).some((q) => q !== path && q.startsWith(path + '/'));
      if (hasReduceDescendant) {
        filteredOptionsMap[path] = filteredOptionsMap[path].filter((opt) => !isReductionType(opt.type));
      }
    });
  }

  let reduciblePaths = Object.keys(filteredOptionsMap).filter((p) => filteredOptionsMap[p].length > 0);

  for (const path of reduciblePaths) {
    const optionsList = filteredOptionsMap[path] || [];
    for (const opt of optionsList) {
      if (opt.type === 'expand' && path.includes('lhs')) continue; // Skip de-simplifying expansions

      // Precise action-level capability filtering against UI's allowedReduciblePaths
      if (options?.allowedReduciblePaths) {
        const allowedForPath = options.allowedReduciblePaths[path];
        if (
          !allowedForPath ||
          !Array.isArray(allowedForPath) ||
          !allowedForPath.some((a: any) => a.type === opt.type || (isReductionType(a.type) && isReductionType(opt.type)))
        ) {
          continue;
        }
      }

      try {
        const nextEq = (opt as any).simplified || getSimplificationForPath(eq, path);
        if (!nextEq || canonicalEqKey(nextEq) === startKey) continue;

        let node: math.MathNode | null = null;
        try {
          node = getNodeByPath(eq, path);
        } catch {
          node = null;
        }

        const origStr = node ? node.toString().replace(/[()]/g, '') : '';
        let moveText = opt.label ? `${opt.label} on ${origStr}` : `Simplify ${origStr}`;

        if (node && node.type === 'OperatorNode') {
          const opNode = node as math.OperatorNode;
          if (opNode.op === '+') {
            const constants: number[] = [];
            const collectAdditionConstants = (n: math.MathNode) => {
              if (n.type === 'ConstantNode') {
                constants.push(Number((n as math.ConstantNode).value));
              } else if (n.type === 'OperatorNode' && (n as math.OperatorNode).op === '+') {
                (n as math.OperatorNode).args.forEach(collectAdditionConstants);
              }
            };
            collectAdditionConstants(opNode);

            if (constants.length >= 2) {
              const sum = constants.reduce((acc, v) => acc + v, 0);
              moveText = `Simplify ${constants.join(' + ')} to ${sum}`;
            }
          } else {
            try {
              const evaluated = mjs.evaluate(node.toString());
              if (typeof evaluated === 'number' && !isNaN(evaluated)) {
                moveText = `Simplify ${origStr} to ${evaluated}`;
              }
            } catch {}
          }
        }

        const isLhs = path.startsWith('lhs');
        const sideText = isLhs ? 'on the left side' : 'on the right side';
        const isVarCombine = countVariableOccurrences(node || eq.lhs, targetVar) > 1;

        steps.push({
          strategicGoal: sanitizeCopy(isVarCombine ? `Combine terms with ${targetVar} ${sideText}` : `Simplify terms ${sideText}`),
          focusPath: path,
          destinationPath: undefined,
          focusDescription: sanitizeCopy(describeNodePath(eq, path)),
          actionableMove: sanitizeCopy(moveText),
          targetNodeId: node ? (node as any).id : undefined,
          actionType: (opt.type as any) || 'reduce',
          nextEq,
        });
      } catch {
        /* ignore invalid simplification */
      }
    }
  }

  // 2. Term Transposition Transitions (strictly derived from Math Engine's getActivePaths & generateValidMoves)
  const activePaths = getActivePaths(eq);
  for (const sourcePath of activePaths) {
    try {
      let sourceNode: math.MathNode | null = null;
      try {
        sourceNode = getNodeByPath(eq, sourcePath);
      } catch {
        sourceNode = null;
      }

      // Skip transposing terms on a side that contains no target variables (purely numerical side)
      const rootSide = sourcePath.split('/')[0];
      const sideNode = rootSide === 'lhs' ? eq.lhs : eq.rhs;
      if (!hasVariableInTree(sideNode, targetVar)) {
        continue;
      }


      const validMoves = generateValidMoves(eq, sourcePath);
      for (const targetPath of Object.keys(validMoves)) {
        if (targetPath === sourcePath) continue;
        const nextEq = validMoves[targetPath];
        if (!nextEq || canonicalEqKey(nextEq) === startKey) continue;

        const node = sourceNode;


        const termStr = node ? node.toString().replace(/[()]/g, '') : '';
        const isRhsSource = sourcePath.startsWith('rhs');
        const hasVar = hasVariableInTree(node || eq.lhs, targetVar);

        let isCoefficient = false;
        if (sourcePath.includes('/')) {
          const parentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
          try {
            const parentNode = getNodeByPath(eq, parentPath);
            if (parentNode.type === 'OperatorNode' && (parentNode as math.OperatorNode).op === '*') {
              isCoefficient = true;
            }
          } catch {}
        }

        const strategicGoalText = hasVar
          ? `Move terms with ${targetVar} to one side`
          : isCoefficient
          ? `Divide both sides by ${termStr} to isolate ${targetVar}`
          : 'Move numbers to the right side';

        const actionText = isRhsSource
          ? `Click or drag ${termStr} to move it to the left side`
          : `Click or drag ${termStr} to move it to the right side`;

        steps.push({
          strategicGoal: sanitizeCopy(strategicGoalText),
          focusPath: sourcePath,
          destinationPath: targetPath,
          focusDescription: sanitizeCopy(describeNodePath(eq, sourcePath)),
          actionableMove: sanitizeCopy(actionText),
          targetNodeId: node ? (node as any).id : undefined,
          actionType: 'reduce',
          nextEq,
        });
      }
    } catch {
      /* ignore invalid move generation */
    }
  }

  // 3. Global Balance Operations Transitions (from Math Engine's applyGlobalOp)
  const isolateSide = (side: 'lhs' | 'rhs') => {
    const root = side === 'lhs' ? eq.lhs : eq.rhs;

    if (root.type === 'OperatorNode') {
      const opNode = root as math.OperatorNode;
      const { op, args } = opNode;

      const varArgIdx = args.findIndex((arg) => hasVariableInTree(arg, targetVar));
      if (varArgIdx !== -1) {
        const constArgIdx = args.findIndex((_, idx) => idx !== varArgIdx);
        if (constArgIdx !== -1) {
          const constNode = args[constArgIdx];
          const constVal = constNode.toString().replace(/[()]/g, '');
          const constPath = `${side}/${constArgIdx}`;

          if (op === '*') {
            try {
              const nextEq = applyGlobalOp(eq, { type: 'div', term: constVal });
              if (canonicalEqKey(nextEq) !== startKey) {
                steps.push({
                  strategicGoal: sanitizeCopy(`Divide both sides by ${constVal} to isolate ${targetVar}`),
                  focusPath: constPath,
                  destinationPath: undefined,
                  focusDescription: sanitizeCopy(describeNodePath(eq, constPath)),
                  actionableMove: sanitizeCopy(`Click ${constVal} to divide both sides by ${constVal}`),
                  targetNodeId: (constNode as any).id,
                  actionType: 'reduce',
                  nextEq,
                });
              }
            } catch {}
          } else if (op === '/') {
            if (varArgIdx === 0) {
              try {
                const nextEq = applyGlobalOp(eq, { type: 'mul', term: constVal });
                if (canonicalEqKey(nextEq) !== startKey) {
                  steps.push({
                    strategicGoal: sanitizeCopy(`Multiply both sides by ${constVal} to isolate ${targetVar}`),
                    focusPath: constPath,
                    destinationPath: undefined,
                    focusDescription: sanitizeCopy(describeNodePath(eq, constPath)),
                    actionableMove: sanitizeCopy(`Click ${constVal} to multiply both sides by ${constVal}`),
                    targetNodeId: (constNode as any).id,
                    actionType: 'reduce',
                    nextEq,
                  });
                }
              } catch {}
            }
          } else if (op === '^') {
            if (varArgIdx === 0) {
              const powerVal = Number(constVal) || 2;
              const isSquare = constVal === '2';
              try {
                const nextEq = applyGlobalOp(eq, { type: 'sqrt', power: powerVal });
                if (canonicalEqKey(nextEq) !== startKey) {
                  steps.push({
                    strategicGoal: sanitizeCopy(
                      isSquare
                        ? `Take the square root of both sides to isolate ${targetVar}`
                        : `Take the ${constVal}-th root of both sides to isolate ${targetVar}`
                    ),
                    focusPath: 'equals',
                    destinationPath: undefined,
                    focusDescription: sanitizeCopy(`Focus on the equals sign = to balance both sides`),
                    actionableMove: sanitizeCopy(
                      isSquare
                        ? `Click the equals sign = to take the square root of both sides`
                        : `Click the equals sign = to take the ${constVal}-th root of both sides`
                    ),
                    targetNodeId: undefined,
                    actionType: 'equals',
                    nextEq,
                  });
                }
              } catch {}
            }
          }
        }
      }
    } else if (root.type === 'FunctionNode') {
      const funcNode = root as math.FunctionNode;
      const fnName = getFunctionName(funcNode);
      if (fnName === 'sqrt' || fnName === 'nthRoot') {
        try {
          const nextEq = applyGlobalOp(eq, { type: 'square' });
          if (canonicalEqKey(nextEq) !== startKey) {
            steps.push({
              strategicGoal: sanitizeCopy(`Square both sides to isolate ${targetVar}`),
              focusPath: 'equals',
              destinationPath: undefined,
              focusDescription: sanitizeCopy(`Focus on the equals sign = to balance both sides`),
              actionableMove: sanitizeCopy(`Click the equals sign = to square both sides`),
              targetNodeId: undefined,
              actionType: 'equals',
              nextEq,
            });
          }
        } catch {}
      }
    }
  };

  const lhsVarCount = countVariableOccurrences(eq.lhs, targetVar);
  const rhsVarCount = countVariableOccurrences(eq.rhs, targetVar);
  if (lhsVarCount > 0 && rhsVarCount === 0) {
    isolateSide('lhs');
  } else if (rhsVarCount > 0 && lhsVarCount === 0) {
    isolateSide('rhs');
  }

  return steps;
};

/**
 * Pure A* / Best-First State-Space Graph Search Engine.
 * Evaluates future derivation paths from startEq to find the optimal shortest path
 * to a solved equation state (score = 1000).
 */
export const findOptimalDerivationPath = (startEq: Equation, targetVar: string, options?: HintOptions): HintStep[] => {
  const visited = new Set<string>();
  const frontier: StateNode[] = [];

  const startKey = canonicalEqKey(startEq);
  visited.add(startKey);

  const initialScore = scoreEquationState(startEq, targetVar);
  frontier.push({
    eq: startEq,
    pathFromStart: [],
    depth: 0,
    score: initialScore,
  });

  let bestNodeSoFar = frontier[0];
  let searchBudget = 30;

  while (frontier.length > 0 && searchBudget-- > 0) {
    frontier.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aStep = a.pathFromStart.length > 0 ? a.pathFromStart[0] : null;
      const bStep = b.pathFromStart.length > 0 ? b.pathFromStart[0] : null;
      const aBonus = aStep ? calculateTransitionBonus(aStep) : 0;
      const bBonus = bStep ? calculateTransitionBonus(bStep) : 0;
      if (bBonus !== aBonus) return bBonus - aBonus;
      return a.depth - b.depth;
    });

    const current = frontier.shift()!;

    if (current.score > bestNodeSoFar.score) {
      bestNodeSoFar = current;
    }

    // Goal State Reached!
    if (isEquationSolved(current.eq)) {
      return current.pathFromStart;
    }

    if (current.depth >= 3) continue; // 3-level lookahead bound

    const successors = getSuccessorStates(current.eq, targetVar, options);
    for (const succ of successors) {
      const key = canonicalEqKey(succ.nextEq);
      if (visited.has(key)) continue;
      visited.add(key);

      const stepBonus = calculateTransitionBonus(succ);
      const nextScore = scoreEquationState(succ.nextEq, targetVar) + stepBonus;
      frontier.push({
        eq: succ.nextEq,
        pathFromStart: [...current.pathFromStart, succ],
        depth: current.depth + 1,
        score: nextScore,
      });
    }
  }

  return bestNodeSoFar.pathFromStart;
};

/**
 * Generates progressive hint ladder for an equation state.
 * Evaluates the optimal shortest derivation path using A* state-space graph search.
 * Returns null if the equation is multi-variable without an explicit target.
 */
export const getHintLadder = (eq: Equation, customTargetVar?: string, options?: HintOptions): HintLadder | null => {
  if (!isHintableEquation(eq) && !customTargetVar) {
    return null;
  }

  const targetVar = customTargetVar || getTargetVariable(eq);

  // 1. Solved state check
  if (isEquationSolved(eq)) {
    return {
      strategicGoal: sanitizeCopy(`The equation is already solved for ${targetVar}`),
      focusPath: null,
      destinationPath: undefined,
      focusDescription: sanitizeCopy(`The equation is fully solved`),
      actionableMove: sanitizeCopy(`No further moves needed`),
      actionType: undefined,
    };
  }

  // 2. Execute A* State-Space Graph Search to find shortest path to solved state
  const optimalPath = findOptimalDerivationPath(eq, targetVar, options);

  if (optimalPath.length > 0) {
    const firstStep = optimalPath[0];
    return {
      strategicGoal: firstStep.strategicGoal,
      focusPath: firstStep.focusPath,
      destinationPath: firstStep.destinationPath,
      focusDescription: firstStep.focusDescription,
      actionableMove: firstStep.actionableMove,
      targetNodeId: firstStep.targetNodeId,
      actionType: firstStep.actionType,
    };
  }

  // General Bounded Search Fallback
  return {
    strategicGoal: sanitizeCopy(`Isolate ${targetVar} on one side of the equation`),
    focusPath: 'equals',
    destinationPath: undefined,
    focusDescription: sanitizeCopy(`Focus on the equals sign = to apply balance operation to both sides`),
    actionableMove: sanitizeCopy(`Click the equals sign = to apply balance operations`),
    targetNodeId: undefined,
    actionType: 'equals',
  };
};
