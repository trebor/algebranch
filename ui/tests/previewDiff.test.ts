// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { parseEquation, ensureNodeIds, getNodeByPath } from 'math-engine-client';
import type { Equation } from 'math-engine-client';
import { collectNodeIds, computePreviewDiff } from '@/utils/previewDiff';

describe('collectNodeIds', () => {
  it('gathers every node id across both sides', () => {
    const eq = ensureNodeIds(parseEquation('x + 3 = 10'));
    const ids = collectNodeIds(eq);
    // lhs root (+), x, 3, rhs (10) => four ids
    expect(ids.size).toBe(4);
    expect(ids.has((getNodeByPath(eq, 'lhs') as unknown as { id: string }).id)).toBe(true);
    expect(ids.has((getNodeByPath(eq, 'rhs') as unknown as { id: string }).id)).toBe(true);
  });
});

describe('computePreviewDiff', () => {
  it('returns null when the preview is identical to the current equation (nothing changed)', () => {
    const eq = ensureNodeIds(parseEquation('x + 3 = 10'));
    expect(computePreviewDiff(eq, eq)).toBeNull();
  });

  it('returns null when the preview shares no ids (a full rebuild degrades to today’s look)', () => {
    const cur = ensureNodeIds(parseEquation('x + 3 = 10'));
    const preview = ensureNodeIds(parseEquation('y = 5'));
    expect(computePreviewDiff(cur, preview)).toBeNull();
  });

  it('marks carried nodes and excludes freshly-minted ones on a partial change', () => {
    const cur = ensureNodeIds(parseEquation('x + 3 = 10'));
    // Preview keeps the whole lhs (carried ids) but swaps the rhs for a fresh node.
    const freshRhs = parseEquation('7 = 0').lhs; // a bare ConstantNode with no id
    const preview: Equation = ensureNodeIds({ lhs: cur.lhs, rhs: freshRhs, relation: cur.relation });

    const carried = computePreviewDiff(cur, preview);
    expect(carried).not.toBeNull();
    // The carried set only contains ids that survive from the current equation.
    const lhsId = (getNodeByPath(preview, 'lhs') as unknown as { id: string }).id;
    const rhsId = (getNodeByPath(preview, 'rhs') as unknown as { id: string }).id;
    expect(carried!.has(lhsId)).toBe(true); // x + 3 carried over
    expect(carried!.has(rhsId)).toBe(false); // the new 7 is a change
    // Every id in the carried set is present in the current equation.
    const currentIds = collectNodeIds(cur);
    for (const id of carried!) expect(currentIds.has(id)).toBe(true);
  });
});
