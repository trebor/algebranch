// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The worked-solution export (#130) renders the active derivation as a document
// rather than a string. Both the string transcript (`formatDerivation`, #46) and
// the document share ONE source of truth: `getDerivationSteps`, which walks the
// root → currentNodeId chain and returns structured steps. These tests pin the
// step shape — numbering, the first-step-has-no-justification rule, the
// descriptor → label fallback, and assumptions surfaced as their own field — so a
// future document renderer and the existing transcript can't drift.
import { describe, it, expect } from 'vitest';
import { getDerivationSteps, formatDerivation, type HistoryNode } from '@/store/equation';
import { parseEquation } from 'math-engine-client';
import type { StepChange } from 'math-engine';

/**
 * A linear derivation tree from an ordered list of [equation, change?] rows. The
 * first row is the starting equation (no change); each later row carries the
 * `StepChange` that produced it, mirroring the live store.
 */
const linearTree = (
  rows: readonly [string, StepChange?][],
): { tree: Record<string, HistoryNode>; leafId: string } => {
  const tree: Record<string, HistoryNode> = {};
  rows.forEach(([eqStr, change], i) => {
    const id = String(i);
    tree[id] = {
      id,
      equation: parseEquation(eqStr),
      parentId: i === 0 ? null : String(i - 1),
      childrenIds: i === rows.length - 1 ? [] : [String(i + 1)],
      label: change?.text ? 'FallbackLabel' : 'Initial',
      timestamp: i + 1,
      ...(change ? { change } : {}),
    };
  });
  return { tree, leafId: String(rows.length - 1) };
};

const divideChange = (operand: string, assumptions?: readonly string[]): StepChange => ({
  kind: 'bothSides',
  op: 'divide',
  operand,
  text: `divide both sides by ${operand}`,
  ...(assumptions?.length ? { assumptions } : {}),
});

describe('getDerivationSteps', () => {
  it('numbers steps 1..n along the root → current path', () => {
    const { tree, leafId } = linearTree([
      ['2*x = 4'],
      ['x = 2', divideChange('2')],
    ]);
    const steps = getDerivationSteps(tree, leafId);
    expect(steps.map((s) => s.index)).toEqual([1, 2]);
  });

  it('gives the first (starting) step no justification', () => {
    const { tree, leafId } = linearTree([
      ['2*x = 4'],
      ['x = 2', divideChange('2')],
    ]);
    const steps = getDerivationSteps(tree, leafId);
    expect(steps[0].justification).toBeUndefined();
    expect(steps[0].assumptions).toBeUndefined();
  });

  it('sentence-cases the change descriptor as the justification', () => {
    const { tree, leafId } = linearTree([
      ['2*x = 4'],
      ['x = 2', divideChange('2')],
    ]);
    const steps = getDerivationSteps(tree, leafId);
    expect(steps[1].justification).toBe('Divide both sides by 2');
  });

  it('falls back to the coarse label when a step has no structured descriptor', () => {
    const { tree, leafId } = linearTree([['2*x = 4'], ['x = 2']]);
    // No `change`: label is used. Second node's label is 'Initial' here only
    // because the helper keys off change; assert the fallback path explicitly.
    tree[leafId] = { ...tree[leafId], label: 'Move' };
    const steps = getDerivationSteps(tree, leafId);
    expect(steps[1].justification).toBe('Move');
  });

  it('surfaces domain assumptions as their own field, not folded into the text', () => {
    const { tree, leafId } = linearTree([
      ['a*x = b'],
      ['x = b/a', divideChange('a', ['a ≠ 0'])],
    ]);
    const steps = getDerivationSteps(tree, leafId);
    expect(steps[1].justification).toBe('Divide both sides by a');
    expect(steps[1].assumptions).toEqual(['a ≠ 0']);
  });
});

describe('formatDerivation (unchanged transcript, now built on getDerivationSteps)', () => {
  it('folds assumptions back into the reason column', () => {
    const { tree, leafId } = linearTree([
      ['a*x = b'],
      ['x = b/a', divideChange('a', ['a ≠ 0'])],
    ]);
    const text = formatDerivation(tree, leafId, 'plain');
    expect(text).toContain('Divide both sides by a, assuming a ≠ 0');
  });

  it('numbers the plain transcript from 1', () => {
    const { tree, leafId } = linearTree([
      ['2*x = 4'],
      ['x = 2', divideChange('2')],
    ]);
    const text = formatDerivation(tree, leafId, 'plain');
    expect(text.split('\n')[0]).toMatch(/^1\. /);
    expect(text.split('\n')[1]).toMatch(/^2\. /);
  });
});
