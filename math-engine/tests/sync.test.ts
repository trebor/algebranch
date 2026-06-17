// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import {
  parseEquation,
  computeMathSync,
  generateValidMoves,
  getReducibleOptions,
  getAllPaths,
  serializeEquation,
  deserializeEquation,
  equationToString,
} from '../src';

describe('computeMathSync — client-side sync-state assembly', () => {
  test('activePaths matches the set of paths with valid moves', () => {
    const eq = parseEquation('x + 3 = 7');
    const result = computeMathSync(eq, null);

    const expected = getAllPaths(eq).filter((path) => {
      try {
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
