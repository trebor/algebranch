// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import {
  parseEquation,
  computeMathSync,
  generateValidMoves,
  getReducibleOptions,
  getAllPaths,
  getNodeByPath,
  serializeEquation,
  deserializeEquation,
  equationToString,
  areEquationsEquivalent,
} from '../src';
import { isCommutativeChainLink } from '../src/explore';
import type { Equation } from '../src';

// Resolve a path's node and its immediate parent (the node one segment up, null
// for a side root) so a test can ask whether a path is an arbitrary chain link.
const chainLinkAt = (eq: Equation, path: string): boolean => {
  const slash = path.lastIndexOf('/');
  const parent = slash < 0 ? null : getNodeByPath(eq, path.slice(0, slash));
  return isCommutativeChainLink(getNodeByPath(eq, path), parent);
};

describe('computeMathSync — client-side sync-state assembly', () => {
  test('activePaths matches the set of paths with valid moves (minus arbitrary chain links)', () => {
    const eq = parseEquation('x + 3 = 7');
    const result = computeMathSync(eq, null);

    const expected = getAllPaths(eq).filter((path) => {
      try {
        // An arbitrary same-operator chain link is never selectable, even when it
        // has a valid move — see the #353 suppression block below.
        if (chainLinkAt(eq, path)) return false;
        return Object.keys(generateValidMoves(eq, path)).length > 0;
      } catch {
        return false;
      }
    });

    expect(result.activePaths.slice().sort()).toEqual(expected.slice().sort());
    expect(result.activePaths.length).toBeGreaterThan(0);
  });

  test('reduciblePaths mirrors getReducibleOptions, serialized', () => {
    const eq = parseEquation('x = 2 + 3');
    const result = computeMathSync(eq, null);
    const reductions = getReducibleOptions(eq);

    expect(Object.keys(result.reduciblePaths).sort()).toEqual(Object.keys(reductions).sort());
    for (const path of Object.keys(reductions)) {
      expect(result.reduciblePaths[path]).toHaveLength(reductions[path].length);
      reductions[path].forEach((red, i) => {
        const entry = result.reduciblePaths[path][i];
        expect(entry.type).toBe(red.type);
        expect(entry.label).toBe(red.label);
        expect(equationToString(deserializeEquation(entry.equation))).toBe(
          equationToString(red.simplified),
        );
      });
    }
  });

  test('targetPaths reflects valid drop targets for a selected source, excluding the source itself', () => {
    const eq = parseEquation('x + 3 = 7');
    // '3' on the LHS is transposable to the RHS.
    const sourcePath = 'lhs/1';
    const result = computeMathSync(eq, sourcePath);

    const moves = generateValidMoves(eq, sourcePath);
    delete moves[sourcePath];

    expect(Object.keys(result.targetPaths).sort()).toEqual(Object.keys(moves).sort());
    expect(result.targetPaths[sourcePath]).toBeUndefined();
    for (const k of Object.keys(moves)) {
      expect(equationToString(deserializeEquation(result.targetPaths[k]))).toBe(
        equationToString(moves[k]),
      );
    }
    expect(Object.keys(result.targetPaths).length).toBeGreaterThan(0);
  });

  test('targetPaths is empty when no source is selected', () => {
    const eq = parseEquation('x + 3 = 7');
    const result = computeMathSync(eq, null);
    expect(result.targetPaths).toEqual({});
  });

  test('outputs are JSON-serializable (no live mathjs nodes leak into the payload)', () => {
    const eq = parseEquation('2*x + 3 = 7');
    const result = computeMathSync(eq, 'lhs/1');
    expect(() => JSON.stringify(result)).not.toThrow();
    const round = JSON.parse(JSON.stringify(result));
    expect(round.activePaths).toEqual(result.activePaths);
  });
});

describe('activePaths — commutative chain-link suppression (#353)', () => {
  const activeSet = (eqStr: string): Set<string> =>
    new Set(computeMathSync(parseEquation(eqStr), null).activePaths);

  // Guard proving a suppressed path WOULD otherwise be active on move-availability
  // alone — so a failing membership assertion means the predicate removed it, not
  // that the node simply had no move.
  const wouldMove = (eqStr: string, path: string): boolean =>
    Object.keys(generateValidMoves(parseEquation(eqStr), path)).length > 0;

  test('a+b+c: the arbitrary (a+b) link is dropped; its terms stay selectable', () => {
    // `a+b+c` = `+[+[a,b],c]`; lhs/0 is the arbitrary inner `+`.
    expect(wouldMove('a + b + c = 0', 'lhs/0')).toBe(true);
    const active = activeSet('a + b + c = 0');
    expect(active.has('lhs/0')).toBe(false); // (a+b) link — suppressed
    expect(active.has('lhs/0/0')).toBe(true); // a
    expect(active.has('lhs/0/1')).toBe(true); // b
    expect(active.has('lhs/1')).toBe(true); // c
  });

  test('a+b+c+d: every inner + link is dropped; leaves stay', () => {
    // `+[+[+[a,b],c],d]` — lhs/0 and lhs/0/0 are both arbitrary links.
    expect(wouldMove('a + b + c + d = 0', 'lhs/0')).toBe(true);
    expect(wouldMove('a + b + c + d = 0', 'lhs/0/0')).toBe(true);
    const active = activeSet('a + b + c + d = 0');
    expect(active.has('lhs/0')).toBe(false); // ((a+b)+c)
    expect(active.has('lhs/0/0')).toBe(false); // (a+b)
    expect(active.has('lhs/0/0/0')).toBe(true); // a
    expect(active.has('lhs/0/0/1')).toBe(true); // b
    expect(active.has('lhs/0/1')).toBe(true); // c
    expect(active.has('lhs/1')).toBe(true); // d
  });

  test('x*y*z: the inner * link is dropped', () => {
    expect(wouldMove('x * y * z = w', 'lhs/0')).toBe(true);
    expect(activeSet('x * y * z = w').has('lhs/0')).toBe(false);
  });

  // Null cases — non-associative and precedence-boundary nodes are NOT links and
  // must stay selectable (mirrors the matrix in explore.test.ts).
  test('a-b-c: the non-associative (a-b) stays selectable', () => {
    // `-` is not associative — `a-b-c` = `-[-[a,b],c]`, order matters, no flatten.
    expect(activeSet('a - b - c = 0').has('lhs/0')).toBe(true);
  });

  test('a+b*c: the product under a sum stays selectable (precedence boundary)', () => {
    // `+[a,*[b,c]]` — the product's parent is `+`, a different op, so lhs/1 is no link.
    expect(activeSet('a + b * c = 0').has('lhs/1')).toBe(true);
  });

  test('2+3+x: suppressing the link leaves its reduce handle intact', () => {
    // The arbitrary link is gone from activePaths, but the legitimate 2+3 -> 5
    // reduction still rides on reduciblePaths (an independent channel).
    const result = computeMathSync(parseEquation('2 + 3 + x = 10'), null);
    expect(result.activePaths).not.toContain('lhs/0');
    expect(Object.keys(result.reduciblePaths)).toContain('lhs/0');
  });

  // #354 — the head (leftmost) term of a subtraction chain is transposable, the
  // same way a sum's head is. The asymmetry was that move generation synthesized
  // the head-term move for `+` chains but dropped it for `-` chains.
  test('a-b-c: the head term `a` is offered, like a sum head', () => {
    // `a-b-c=d` = `-[-[a,b],c]`; lhs/0/0 is the head term `a`.
    expect(wouldMove('a - b - c = d', 'lhs/0/0')).toBe(true);
    expect(activeSet('a - b - c = d').has('lhs/0/0')).toBe(true);
    // Symmetric with the sum, whose head was already offered.
    expect(activeSet('a + b + c = d').has('lhs/0/0')).toBe(true);
  });

  test('a-b+c: the head term of a mixed -/+ chain is offered', () => {
    expect(activeSet('a - b + c = d').has('lhs/0/0')).toBe(true);
  });

  test('the head move subtracts the term from both sides (-b - c = d - a)', () => {
    const src = parseEquation('a - b - c = d');
    const moves = generateValidMoves(src, 'lhs/0/0'); // source = head `a`
    const across = moves['rhs']; // cross-equals move lands on the RHS root
    expect(across).toBeDefined();
    expect(areEquationsEquivalent(src, across)).toBe(true);
    expect(areEquationsEquivalent(parseEquation('-b - c = d - a'), across)).toBe(true);
  });

  test('inequality: moving the head keeps the relation direction (subtraction never flips)', () => {
    const src = parseEquation('a - b - c < d');
    const moves = generateValidMoves(src, 'lhs/0/0');
    const across = moves['rhs'];
    expect(across).toBeDefined();
    expect(across.relation).toBe('<');
    expect(areEquationsEquivalent(src, across)).toBe(true);
  });

  test('an arbitrary chain link is not offered as a drop target either', () => {
    // Symmetry with selectability: dropping `c` onto the `(a+b)` group at lhs/0
    // would recreate the same arbitrary grouping (and draw an isTarget box around
    // a+b), so a chain link must not be a valid drop target. Real targets (the RHS)
    // survive.
    const eq = parseEquation('a + b + c = d');
    const targets = computeMathSync(eq, 'lhs/1').targetPaths; // source = c
    expect(chainLinkAt(eq, 'lhs/0')).toBe(true); // (a+b) is the arbitrary link
    expect(Object.keys(targets)).not.toContain('lhs/0');
    expect(Object.keys(targets)).toContain('rhs'); // moving c across still offered
  });
});
