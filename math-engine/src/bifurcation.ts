// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { mjs } from './mathjs';
import { Equation } from './tree';
import { GlobalOpParams } from './globalOps';
import { getFunctionName, getQuadraticFormulaSolutions } from './validator';

export interface BifurcationCase {
  equation: Equation;
  label: string;
}

const unwrapParens = (n: math.MathNode): math.MathNode => {
  let curr = n;
  while (curr.type === 'ParenthesisNode') {
    curr = (curr as math.ParenthesisNode).content;
  }
  return curr;
};

const isZeroNode = (n: math.MathNode): boolean => {
  const unwrapped = unwrapParens(n);
  if (unwrapped.type === 'ConstantNode') {
    return Number((unwrapped as math.ConstantNode).value) === 0;
  }
  return unwrapped.toString() === '0';
};

const collectProductFactors = (n: math.MathNode): math.MathNode[] => {
  const unwrapped = unwrapParens(n);
  if (unwrapped.type === 'OperatorNode') {
    const opNode = unwrapped as math.OperatorNode;
    if (opNode.op === '*' || opNode.fn === 'multiply') {
      return opNode.args.flatMap(collectProductFactors);
    }
  }
  return [unwrapped];
};

const createRootNode = (arg: math.MathNode, power: number): math.MathNode => {
  if (power === 2) {
    return new mjs.FunctionNode('sqrt', [arg]);
  }
  return new mjs.FunctionNode('nthRoot', [arg, new mjs.ConstantNode(power)]);
};

const unaryMinusNode = (arg: math.MathNode): math.MathNode => {
  return new mjs.OperatorNode('-', 'unaryMinus', [arg]);
};

export const getBifurcatingGlobalOpCases = (
  eq: Equation,
  params: GlobalOpParams
): BifurcationCase[] | null => {
  const { type, power } = params;
  const effectivePower = power ?? 2;

  const isEvenRoot = (type === 'sqrt' || type === 'root') && effectivePower % 2 === 0;
  if (!isEvenRoot) return null;

  const labelPrefix = effectivePower === 2 ? 'Global Sqrt' : `Global ${effectivePower}-Root`;

  const posLhs = createRootNode(eq.lhs, effectivePower);
  const posRhs = createRootNode(eq.rhs, effectivePower);
  const negRhs = unaryMinusNode(posRhs.clone());

  const case1: Equation = { lhs: posLhs, rhs: posRhs, relation: eq.relation };
  const case2: Equation = { lhs: posLhs.clone(), rhs: negRhs, relation: eq.relation };

  return [
    { equation: case1, label: `${labelPrefix} (+)` },
    { equation: case2, label: `${labelPrefix} (-)` },
  ];
};

export const getAbsoluteValueBifurcationCases = (
  eq: Equation
): BifurcationCase[] | null => {
  const lhsUnwrapped = unwrapParens(eq.lhs);
  const rhsUnwrapped = unwrapParens(eq.rhs);

  if (lhsUnwrapped.type === 'FunctionNode' && getFunctionName(lhsUnwrapped as math.FunctionNode) === 'abs') {
    const fn = lhsUnwrapped as math.FunctionNode;
    if (fn.args.length === 1) {
      const inner = fn.args[0];
      const case1: Equation = { lhs: inner.clone(), rhs: eq.rhs, relation: eq.relation };
      const case2: Equation = { lhs: inner.clone(), rhs: unaryMinusNode(eq.rhs), relation: eq.relation };
      return [
        { equation: case1, label: 'Split Abs (+)' },
        { equation: case2, label: 'Split Abs (-)' },
      ];
    }
  }

  if (rhsUnwrapped.type === 'FunctionNode' && getFunctionName(rhsUnwrapped as math.FunctionNode) === 'abs') {
    const fn = rhsUnwrapped as math.FunctionNode;
    if (fn.args.length === 1) {
      const inner = fn.args[0];
      const case1: Equation = { lhs: eq.lhs, rhs: inner.clone(), relation: eq.relation };
      const case2: Equation = { lhs: unaryMinusNode(eq.lhs), rhs: inner.clone(), relation: eq.relation };
      return [
        { equation: case1, label: 'Split Abs (+)' },
        { equation: case2, label: 'Split Abs (-)' },
      ];
    }
  }

  return null;
};

export const getZeroProductBifurcationCases = (
  eq: Equation
): BifurcationCase[] | null => {
  if (isZeroNode(eq.rhs)) {
    const factors = collectProductFactors(eq.lhs);
    if (factors.length >= 2) {
      return factors.map((factor, idx) => ({
        equation: { lhs: factor.clone(), rhs: new mjs.ConstantNode(0), relation: eq.relation },
        label: `Zero-Product: Case ${idx + 1}`,
      }));
    }
  }

  if (isZeroNode(eq.lhs)) {
    const factors = collectProductFactors(eq.rhs);
    if (factors.length >= 2) {
      return factors.map((factor, idx) => ({
        equation: { lhs: factor.clone(), rhs: new mjs.ConstantNode(0), relation: eq.relation },
        label: `Zero-Product: Case ${idx + 1}`,
      }));
    }
  }

  return null;
};

export const getQuadraticFormulaBifurcationCases = (
  eq: Equation
): BifurcationCase[] | null => {
  try {
    const quadSolutions = getQuadraticFormulaSolutions(eq);
    if (quadSolutions && quadSolutions.length > 0) {
      const sol = quadSolutions[0];
      return [
        { equation: sol.pos, label: 'Apply Quadratic Formula (+)' },
        { equation: sol.neg, label: 'Apply Quadratic Formula (-)' },
      ];
    }
  } catch {
    /* ignore */
  }
  return null;
};

import { analyzeRootOfPower } from './simplify';
import { getChildren, getNodeByPath, replaceNodeAtPath } from './tree';

export const getRootOfPowerBifurcationCases = (
  eq: Equation
): BifurcationCase[] | null => {
  try {
    const allPaths: string[] = [];
    const collectPaths = (node: math.MathNode, currentPath: string) => {
      allPaths.push(currentPath);
      const children = getChildren(node);
      children.forEach((child, idx) => {
        collectPaths(child, currentPath ? `${currentPath}/${idx}` : `${idx}`);
      });
    };
    collectPaths(eq.lhs, 'lhs');
    collectPaths(eq.rhs, 'rhs');

    for (const path of allPaths) {
      const node = getNodeByPath(eq, path);
      const analysis = analyzeRootOfPower(node);
      if (analysis && analysis.even) {
        const posEq = replaceNodeAtPath(eq, path, analysis.base.clone());
        const negEq = replaceNodeAtPath(
          eq,
          path,
          unaryMinusNode(analysis.base.clone())
        );
        return [
          { equation: posEq, label: 'Take Root (+)' },
          { equation: negEq, label: 'Take Root (-)' },
        ];
      }
    }
  } catch {
    /* skip */
  }
  return null;
};

export const getBifurcationCases = (
  eq: Equation,
  opParams?: GlobalOpParams
): BifurcationCase[] | null => {
  if (opParams) {
    const globalCases = getBifurcatingGlobalOpCases(eq, opParams);
    if (globalCases) return globalCases;
  }

  const rootPowerCases = getRootOfPowerBifurcationCases(eq);
  if (rootPowerCases) return rootPowerCases;

  const absCases = getAbsoluteValueBifurcationCases(eq);
  if (absCases) return absCases;

  const zeroProductCases = getZeroProductBifurcationCases(eq);
  if (zeroProductCases) return zeroProductCases;

  const quadCases = getQuadraticFormulaBifurcationCases(eq);
  if (quadCases) return quadCases;

  return null;
};
