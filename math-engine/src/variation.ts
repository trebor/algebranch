// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { parseEquation, equationToString } from './index';
import { mjs } from './mathjs';
import { Equation } from './tree';
import { fnName } from './serialize';

export interface VariationOptions {
  seed?: number;
  targetVariable?: string;
  varyVariables?: boolean;
  varyConstants?: boolean;
  varyStructure?: boolean;
}

export const CLEAN_VARIABLES = ['x', 'y', 'z', 'a', 'b', 'n', 't'] as const;
export const PERFECT_SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100] as const;

class PRNG {
  private state: number;

  constructor(seed?: number) {
    this.state = seed !== undefined ? Math.abs(seed) : Math.floor(Math.random() * 2147483647);
    if (this.state === 0) this.state = 1;
  }

  nextFloat(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  pick<T>(arr: readonly T[] | T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

const BUILTIN_SYMBOLS = new Set([
  'i', 'e', 'pi', 'true', 'false', 'null', 'undefined',
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'sqrt', 'nthRoot', 'abs',
]);

/**
 * Extracts variable names present in a math node tree.
 */
const extractVariables = (node: math.MathNode): string[] => {
  const vars = new Set<string>();
  node.traverse((n) => {
    if (n.type === 'SymbolNode') {
      const name = (n as math.SymbolNode).name;
      if (!BUILTIN_SYMBOLS.has(name)) {
        vars.add(name);
      }
    }
  });
  return Array.from(vars);
};

/**
 * Generates a structural clone/variation of an equation.
 */
export const generateEquationVariation = (
  rawEquationStr: string,
  options: VariationOptions = {}
): string => {
  const prng = new PRNG(options.seed);
  const varyVars = options.varyVariables ?? true;
  const varyConsts = options.varyConstants ?? true;
  const varyStruct = options.varyStructure ?? true;

  const parsed = parseEquation(rawEquationStr);
  const lhsVars = extractVariables(parsed.lhs);
  const rhsVars = extractVariables(parsed.rhs);
  const allVars = Array.from(new Set([...lhsVars, ...rhsVars]));

  const primaryVar = allVars[0] ?? 'x';
  const targetVar = options.targetVariable ?? (varyVars ? prng.pick(CLEAN_VARIABLES) : primaryVar);

  const varMap: Record<string, string> = {};
  if (varyVars && primaryVar) {
    varMap[primaryVar] = targetVar;
    // Map secondary variables cleanly if any
    let secondaryIndex = 0;
    for (const v of allVars) {
      if (v !== primaryVar) {
        const remaining = CLEAN_VARIABLES.filter((c) => c !== targetVar);
        varMap[v] = remaining[secondaryIndex % remaining.length];
        secondaryIndex++;
      }
    }
  }

  // AST Variable and Constant Substituter
  const transformSubtree = (node: math.MathNode, isExponent = false): math.MathNode => {
    if (node.type === 'SymbolNode') {
      const sym = node as math.SymbolNode;
      if (varMap[sym.name]) {
        return new mjs.SymbolNode(varMap[sym.name]);
      }
      return sym.clone();
    }

    if (node.type === 'ConstantNode') {
      const constNode = node as math.ConstantNode;
      const val = constNode.value;
      if (typeof val === 'number' && varyConsts && !isExponent && val !== 0 && val !== 1) {
        const offset = prng.pick([-3, -2, -1, 1, 2, 3]);
        const newVal = val + offset;
        if (newVal !== 0 && Math.sign(newVal) === Math.sign(val)) {
          return new mjs.ConstantNode(newVal);
        }
      }
      return constNode.clone();
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;
      const isPow = opNode.op === '^';
      const newArgs = opNode.args.map((arg, idx) => transformSubtree(arg, isPow && idx === 1));
      return new mjs.OperatorNode(opNode.op, opNode.fn, newArgs);
    }

    if (node.type === 'ParenthesisNode') {
      const paren = node as math.ParenthesisNode;
      return new mjs.ParenthesisNode(transformSubtree(paren.content, isExponent));
    }

    if (node.type === 'FunctionNode') {
      const fnNode = node as math.FunctionNode;
      const newArgs = fnNode.args.map((arg) => transformSubtree(arg, false));
      return new mjs.FunctionNode(fnName(fnNode), newArgs);
    }

    return node.clone();
  };

  let newLhs = transformSubtree(parsed.lhs);
  let newRhs = transformSubtree(parsed.rhs);

  // Optional side swapping (A = B -> B = A)
  if (varyStruct && prng.nextFloat() < 0.25) {
    const temp = newLhs;
    newLhs = newRhs;
    newRhs = temp;
  }

  const resultEq: Equation = {
    lhs: newLhs,
    rhs: newRhs,
    relation: parsed.relation,
  };

  try {
    const serialized = equationToString(resultEq);
    parseEquation(serialized); // validate
    return serialized;
  } catch {
    // Fallback if AST mutation rendered an invalid node combo
    return rawEquationStr.replaceAll(primaryVar, targetVar);
  }
};
