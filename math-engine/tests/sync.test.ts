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
  getChildren,
} from '../src';
import { isCommutativeChainLink } from '../src/explore';
import type { Equation } from '../src';
import type * as math from 'mathjs';

/** All node ids of an equation in preorder (lhs then rhs). */
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

  // #400: a reduction transform can leave two tree slots holding the same node id
  // (or a null id). computeMathSync serializes these option trees straight into the
  // UI's reducible-preview stack, which renders each as an EquationNode. React then
  // sees two children with the same key (`getChildId` returns the node id) and warns
  // — the "Encountered two children with the same key" console error on, e.g., the
  // quadratic result below. Every option preview must therefore carry unique,
  // non-null node ids before it crosses to the UI.
  describe('reducible option previews have unique node ids (#400)', () => {
    const eqStrings = [
      'x = (-(-4) - sqrt((-4)^2 - 4*1*0))/(2*1)', // quadratic-formula result (the repro)
      'x^2 - 4*x = 0',
      '2*(x + 3) = 10', // Distribute — aliases nodes in the original repro
    ];

    for (const s of eqStrings) {
      test(`no duplicate/null ids across any option of ${s}`, () => {
        const result = computeMathSync(parseEquation(s), null);
        for (const [path, arr] of Object.entries(result.reduciblePaths)) {
          arr.forEach((opt, idx) => {
            const eq = deserializeEquation(opt.equation);
            const ids = collectIds(eq);
            // Surface which option failed via the asserted value itself.
            const where = `path=${path} idx=${idx} label=${opt.label ?? opt.type}`;
            const nullIds = ids.filter((id) => id == null);
            expect([where, nullIds]).toEqual([where, []]);
            const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
            expect([where, dupIds]).toEqual([where, []]);
          });
        }
      });
    }
  });
});

describe('computeMathSync — no-op offer suppression (#367)', () => {
  // A transform that lands the equation in a state that renders identically to the
  // current one is a no-op: it looks like a real move but changes nothing. Detect it
  // generically by comparing the rendered result against the current render, and
  // suppress the offer across BOTH channels — reductions and drop targets. The render
  // (equationToString) is order- and paren-sensitive, so a genuine commutative reorder
  // (a·b → b·a, a different string) is NOT collapsed; only a true byte-for-byte no-op is.

  const sig = (eqStr: string): string => equationToString(parseEquation(eqStr));

  // No offered result — reduction option or drop target — may render identically to
  // the current equation, for any source selection. This is the generic invariant.
  const noOfferedNoOp = (eqStr: string): void => {
    const eq = parseEquation(eqStr);
    const current = equationToString(eq);
    for (const source of [null, ...getAllPaths(eq)]) {
      const result = computeMathSync(eq, source);
      for (const [path, arr] of Object.entries(result.reduciblePaths)) {
        arr.forEach((opt, i) => {
          const rendered = equationToString(deserializeEquation(opt.equation));
          expect(`${eqStr} reduce@${path}[${i}] -> ${rendered}`).not.toBe(
            `${eqStr} reduce@${path}[${i}] -> ${current}`,
          );
        });
      }
      for (const [path, se] of Object.entries(result.targetPaths)) {
        const rendered = equationToString(deserializeEquation(se));
        expect(`${eqStr} ${source} target@${path} -> ${rendered}`).not.toBe(
          `${eqStr} ${source} target@${path} -> ${current}`,
        );
      }
    }
  };

  test('the (x+2)·3=0 drop-onto-sibling no-op target is suppressed; the real cross-equals move survives', () => {
    // Selecting `3` (lhs/1) and dropping it onto `(x+2)` (lhs/0) reproduces
    // `(x + 2) * 3 = 0` byte-for-byte — a no-op move (the repro from #367).
    const eq = parseEquation('(x + 2) * 3 = 0');
    const targets = computeMathSync(eq, 'lhs/1').targetPaths; // source = the 3
    // Guard: the move engine DOES still generate the no-op as a candidate target, so a
    // missing key means suppression removed it, not that no move existed.
    const rawMoves = generateValidMoves(eq, 'lhs/1');
    expect(sig('(x + 2) * 3 = 0')).toBe(equationToString(rawMoves['lhs/0']));
    expect(Object.keys(targets)).not.toContain('lhs/0'); // no-op target suppressed
    expect(Object.keys(targets)).toContain('rhs'); // moving 3 across the equals survives
  });

  test('no offered transform is a byte-for-byte no-op, across a battery (generic filter)', () => {
    for (const s of [
      '(x + 2) * 3 = 0',
      'x*(x-1)*(x+1)*(x+2) = 3',
      'x + 3 = 7',
      '2*x + 3 = 7',
      'x = 2 + 3',
      'a + b + c = d',
    ]) {
      noOfferedNoOp(s);
    }
  });

  test('genuine offers are untouched — a real move and a real reduction still surface (null case)', () => {
    // The filter must remove ONLY no-ops. `x + 3 = 7` transposes 3 across the equals
    // (a real, distinct state), and `x = 2 + 3` still folds 2+3 -> 5.
    const move = computeMathSync(parseEquation('x + 3 = 7'), 'lhs/1');
    expect(Object.keys(move.targetPaths)).toContain('rhs');
    const reduce = computeMathSync(parseEquation('x = 2 + 3'), null);
    expect(Object.keys(reduce.reduciblePaths).length).toBeGreaterThan(0);
  });
});

describe('computeMathSync — undefined (÷0) equations are a true dead end (#419)', () => {
  // Once any subtree is undefined, the whole equation is undefined: no algebraic
  // manipulation yields a defined equivalent, so NO move is offered anywhere. The
  // freeze is equation-global (a property of the whole state), not per-subtree —
  // even a term that doesn't itself touch the /0 cannot be legally moved. The
  // undefinedPaths diagnostic still points at the offending subtree.

  test('x/0 = 5 offers no active paths, no reductions, but still flags the /0 subtree', () => {
    const eq = parseEquation('x/0 = 5');
    const result = computeMathSync(eq, null);
    expect(result.activePaths).toEqual([]);
    expect(result.reduciblePaths).toEqual({});
    expect(result.undefinedPaths).toEqual([{ path: 'lhs', reason: 'division-by-zero' }]);
  });

  test('x/0 = 5 offers no drop targets for any source (incl. the numerator that would drop the /0)', () => {
    const eq = parseEquation('x/0 = 5');
    // Selecting the numerator `x` previously fabricated `0 = x/5`, silently
    // dropping the /0 and inventing a defined result — the regression this guards.
    for (const source of getAllPaths(eq)) {
      const result = computeMathSync(eq, source);
      expect(result.targetPaths).toEqual({});
    }
  });

  test('x/0 + x/5 = 0 freezes every term, still flags only the x/0 subtree', () => {
    const eq = parseEquation('x/0 + x/5 = 0');
    for (const source of [null, ...getAllPaths(eq)]) {
      const result = computeMathSync(eq, source);
      expect(result.activePaths).toEqual([]);
      expect(result.reduciblePaths).toEqual({});
      expect(result.targetPaths).toEqual({});
    }
    const flagged = computeMathSync(eq, null).undefinedPaths;
    expect(flagged).toHaveLength(1);
    expect(flagged[0].reason).toBe('division-by-zero');
  });

  test('a defined equation is unaffected — moves still offered (null/no-op case)', () => {
    for (const s of ['x + 3 = 7', 'x/5 = 2']) {
      const eq = parseEquation(s);
      const result = computeMathSync(eq, null);
      expect(result.undefinedPaths).toEqual([]);
      expect(result.activePaths.length).toBeGreaterThan(0);
    }
  });
});
