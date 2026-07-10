// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// A domain restriction (#63) is a property of the whole solution *branch*, not a
// single transition: once a step divides by `x` assuming `x ≠ 0`, every descendant
// equation inherits that caveat and the answer is only valid under it (#486).
// `getActiveRestrictions` walks the root → node `parentId` chain and returns the
// accumulated, deduplicated set (first-seen order) so the UI can surface a standing
// "given x ≠ 0, y ≠ 0" caveat on the current node / final answer. These tests pin
// propagation, stacking, dedup, and the ordering.
import { describe, it, expect } from 'vitest';
import { getActiveRestrictions, type HistoryNode } from '@/store/equation';
import { parseEquation } from 'math-engine-client';
import type { StepChange } from 'math-engine';

/** A linear tree from [equation, change?] rows, mirroring the live store. */
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

describe('getActiveRestrictions', () => {
  it('returns nothing when no step on the path introduced a restriction', () => {
    const { tree, leafId } = linearTree([
      ['2*x = 4'],
      ['x = 2', divideChange('2')],
    ]);
    expect(getActiveRestrictions(tree, leafId)).toEqual([]);
  });

  it('propagates a restriction to descendants below the introducing step', () => {
    const { tree, leafId } = linearTree([
      ['a*x = b'],
      ['x = b/a', divideChange('a', ['a ≠ 0'])],
      ['x + 1 = b/a + 1', divideChange('1')], // later, restriction-free step
    ]);
    // The restriction born two steps up is still active at the leaf.
    expect(getActiveRestrictions(tree, leafId)).toEqual(['a ≠ 0']);
  });

  it('stacks independent restrictions in first-seen (path) order', () => {
    const { tree, leafId } = linearTree([
      ['x*y = 1'],
      ['y = 1/x', divideChange('x', ['x ≠ 0'])],
      ['1 = 1/(x*y)', divideChange('y', ['y ≠ 0'])],
    ]);
    expect(getActiveRestrictions(tree, leafId)).toEqual(['x ≠ 0', 'y ≠ 0']);
  });

  it('deduplicates a restriction reintroduced by a later step', () => {
    const { tree, leafId } = linearTree([
      ['x*x = x'],
      ['x = 1', divideChange('x', ['x ≠ 0'])],
      ['x + x = 2', divideChange('x', ['x ≠ 0'])],
    ]);
    expect(getActiveRestrictions(tree, leafId)).toEqual(['x ≠ 0']);
  });

  it('reflects only the restrictions above the queried node, not below it', () => {
    const { tree } = linearTree([
      ['a*x = b'],
      ['x = b/a', divideChange('a', ['a ≠ 0'])],
      ['x*c = (b/a)*c', divideChange('c', ['c ≠ 0'])],
    ]);
    // Querying the middle node must not see the restriction its child introduced.
    expect(getActiveRestrictions(tree, '1')).toEqual(['a ≠ 0']);
  });
});
