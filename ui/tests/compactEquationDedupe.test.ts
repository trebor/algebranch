// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// A workspace saved *before* the #400 alias fix baked a duplicate math-node id
// into the compact `k` array (the old `ensureNodeIds` handed two tree positions
// the same `node_<hash>_<n>`). `fromCompactEquation` re-attaches those stored ids
// verbatim onto freshly parsed nodes, so a legacy/corrupt `k` would recreate the
// duplicate id on reload → duplicate React keys (`getChildId`) → the console
// error and glitched FLIP. Reload must heal this: keep the first occurrence of an
// id (FLIP continuity) and mint a fresh unique id for any collision.
import { describe, it, expect } from 'vitest';
import { fromCompactEquation, type CompactEquation } from '@/store/equation';
import { getChildren, type Equation } from 'math-engine-client';
import type * as math from 'mathjs';

const collectIds = (eq: Equation): string[] => {
  const ids: string[] = [];
  const walk = (n: math.MathNode) => {
    if (!n) return;
    ids.push((n as unknown as { id: string }).id);
    getChildren(n).forEach(walk);
  };
  walk(eq.lhs);
  walk(eq.rhs);
  return ids;
};

describe('fromCompactEquation — heals duplicate ids in a legacy k array (#400)', () => {
  it('mints unique ids when the stored k repeats an id', () => {
    // Preorder of `a + b = 0` is [+, a, b, 0] (lhs) then... rhs `0` → 4 nodes.
    // The stored k repeats `dup` across the first two positions (legacy corruption).
    const c: CompactEquation = { s: 'a + b = 0', k: ['dup', 'dup', 'other', 'zero'] };
    const eq = fromCompactEquation(c);
    const ids = collectIds(eq);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4); // no duplicate id survives reload
    expect(ids[0]).toBe('dup'); // first occurrence preserved for FLIP continuity
  });

  it('leaves an already-unique k untouched', () => {
    const c: CompactEquation = { s: 'a + b = 0', k: ['w', 'x', 'y', 'z'] };
    const eq = fromCompactEquation(c);
    expect(collectIds(eq)).toEqual(['w', 'x', 'y', 'z']);
  });
});
