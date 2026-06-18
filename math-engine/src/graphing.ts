// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { Equation, getChildren } from './tree';
import { evaluatePoint, solveForVariable } from './validator';

// #50 graphing — pure math for plotting an equation's two sides and locating
// their intersections (the solutions). Rendering lives in the UI; this module
// is fully TDD-able and imported client-side via the unified engine (#44).

export interface GraphSample {
  readonly x: number;
  /** null ⇒ undefined / complex / non-finite at this x ⇒ the renderer must
   *  break the polyline here (e.g. sqrt(x) for x < 0). */
  readonly y: number | null;
}

export interface GraphWindow {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface GraphData {
  /** The single variable plotted, or null when the equation isn't graphable. */
  readonly variable: string | null;
  readonly reason?: 'no-variables' | 'multi-variable';
  /** Every real variable found (for a future variable picker). */
  readonly variables: string[];
  readonly lhs: GraphSample[];
  readonly rhs: GraphSample[];
  /** Solution x-positions, ascending. */
  readonly intersections: number[];
  readonly window: GraphWindow;
}

const PROBE_MIN = -10;
const PROBE_MAX = 10;
const PROBE_COUNT = 241;

/**
 * Real variables in an equation. Crucially this skips FunctionNode function
 * names: `getVariables` (validator) returns e.g. 'sqrt' for `sqrt(x^2)` because
 * the function reference is a SymbolNode, which would then crash evaluatePoint.
 * Here we walk only the argument subtrees of function nodes.
 */
export const getGraphVariables = (eq: Equation): string[] => {
  const seen = new Set<string>();
  const visit = (node: math.MathNode) => {
    if (!node) return;
    if (node.type === 'SymbolNode') {
      const name = (node as math.SymbolNode).name;
      if (name !== 'pi' && name !== 'e') seen.add(name);
      return;
    }
    if (node.type === 'FunctionNode') {
      // Visit the arguments, NOT the function-name symbol.
      (node as math.FunctionNode).args.forEach(visit);
      return;
    }
    getChildren(node).forEach(visit);
  };
  visit(eq.lhs);
  visit(eq.rhs);
  return Array.from(seen);
};

/** Evaluate a node at `variable = x`, mapping complex/NaN/±Inf/errors to null. */
const evalReal = (node: math.MathNode, variable: string, x: number): number | null => {
  try {
    const v = evaluatePoint(node, { [variable]: x });
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    // mathjs Complex / BigNumber / Fraction
    if (v && typeof v === 'object') {
      if ('im' in v) return Math.abs((v as { im: number }).im) < 1e-9 && Number.isFinite((v as { re: number }).re) ? (v as { re: number }).re : null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

export const sampleCurve = (
  node: math.MathNode,
  variable: string,
  xMin: number,
  xMax: number,
  count: number,
): GraphSample[] => {
  const samples: GraphSample[] = [];
  const step = count > 1 ? (xMax - xMin) / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const x = xMin + i * step;
    samples.push({ x, y: evalReal(node, variable, x) });
  }
  return samples;
};

/**
 * Solutions of `LHS = RHS` in [xMin, xMax]: scan f(x) = LHS − RHS for sign
 * changes (refined with the engine's solveForVariable, bisection fallback), plus
 * a local-minimum pass to catch tangency roots (e.g. x^2 = 0) that never change
 * sign. Deduped to 1e-4, ascending.
 */
export const findIntersections = (
  eq: Equation,
  variable: string,
  xMin: number,
  xMax: number,
): number[] => {
  const N = PROBE_COUNT;
  const step = (xMax - xMin) / (N - 1);
  const f = (x: number): number | null => {
    const l = evalReal(eq.lhs, variable, x);
    const r = evalReal(eq.rhs, variable, x);
    return l === null || r === null ? null : l - r;
  };

  const roots: number[] = [];
  const add = (x: number) => {
    if (x < xMin - 1e-9 || x > xMax + 1e-9) return;
    const rounded = Math.round(x * 1e6) / 1e6;
    if (!roots.some((r) => Math.abs(r - rounded) < 1e-4)) roots.push(rounded);
  };

  const refine = (a: number, b: number): number => {
    const guess = (a + b) / 2;
    const solved = solveForVariable(eq.lhs, eq.rhs, variable, {}, guess);
    const sNum = typeof solved === 'number' ? solved : Number(solved);
    if (solved !== null && Number.isFinite(sNum) && sNum >= a - 1e-6 && sNum <= b + 1e-6) {
      return sNum;
    }
    // Bisection fallback on the bracket.
    let lo = a;
    let hi = b;
    const fa = f(lo);
    if (fa === null) return guess;
    let sLo = Math.sign(fa);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const fm = f(mid);
      if (fm === null) break;
      if (Math.sign(fm) === sLo) {
        lo = mid;
      } else {
        hi = mid;
      }
      sLo = Math.sign(f(lo) ?? sLo);
    }
    return (lo + hi) / 2;
  };

  // 1. Sign-change scan.
  let prevX = xMin;
  let prevF = f(prevX);
  for (let i = 1; i < N; i++) {
    const x = xMin + i * step;
    const fx = f(x);
    if (prevF !== null && fx !== null) {
      if (prevF === 0) add(prevX);
      if (fx === 0) add(x);
      if (prevF * fx < 0) add(refine(prevX, x));
    }
    prevX = x;
    prevF = fx;
  }

  // 2. Tangency pass: a local |f| minimum that is ~0 but never crossed zero.
  for (let i = 1; i < N - 1; i++) {
    const xL = xMin + (i - 1) * step;
    const xM = xMin + i * step;
    const xR = xMin + (i + 1) * step;
    const fL = f(xL);
    const fM = f(xM);
    const fR = f(xR);
    if (fL === null || fM === null || fR === null) continue;
    const aM = Math.abs(fM);
    if (aM < 1e-7 && aM <= Math.abs(fL) && aM <= Math.abs(fR)) add(xM);
  }

  return roots.sort((a, b) => a - b);
};

const percentile = (sortedVals: number[], p: number): number => {
  if (sortedVals.length === 0) return 0;
  const idx = Math.min(sortedVals.length - 1, Math.max(0, Math.round(p * (sortedVals.length - 1))));
  return sortedVals[idx];
};

export const computeGraphData = (eq: Equation): GraphData => {
  const variables = getGraphVariables(eq);
  const emptyWindow: GraphWindow = { xMin: PROBE_MIN, xMax: PROBE_MAX, yMin: -10, yMax: 10 };

  if (variables.length === 0) {
    return { variable: null, reason: 'no-variables', variables, lhs: [], rhs: [], intersections: [], window: emptyWindow };
  }
  if (variables.length > 1) {
    return { variable: null, reason: 'multi-variable', variables, lhs: [], rhs: [], intersections: [], window: emptyWindow };
  }

  const variable = variables[0];
  const intersections = findIntersections(eq, variable, PROBE_MIN, PROBE_MAX);

  // Horizontal window: contain all intersections with ≥25% padding (min span 4),
  // else fall back to a default centered range.
  let xMin = PROBE_MIN / 2;
  let xMax = PROBE_MAX / 2;
  if (intersections.length > 0) {
    const lo = Math.min(...intersections);
    const hi = Math.max(...intersections);
    const span = Math.max(hi - lo, 4);
    const pad = span * 0.25;
    xMin = lo - pad;
    xMax = hi + pad;
  }

  const count = PROBE_COUNT;
  const lhs = sampleCurve(eq.lhs, variable, xMin, xMax, count);
  const rhs = sampleCurve(eq.rhs, variable, xMin, xMax, count);

  // Vertical window: 5th–95th percentile of finite y across both curves so a
  // single asymptote can't blow out the scale; always include y = 0.
  const ys = [...lhs, ...rhs]
    .map((s) => s.y)
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);
  let yMin = 0;
  let yMax = 0;
  if (ys.length > 0) {
    yMin = Math.min(0, percentile(ys, 0.05));
    yMax = Math.max(0, percentile(ys, 0.95));
    if (yMax - yMin < 1e-6) {
      yMin -= 1;
      yMax += 1;
    }
    const ypad = (yMax - yMin) * 0.1;
    yMin -= ypad;
    yMax += ypad;
  } else {
    yMin = -10;
    yMax = 10;
  }

  return { variable, variables, lhs, rhs, intersections, window: { xMin, xMax, yMin, yMax } };
};
