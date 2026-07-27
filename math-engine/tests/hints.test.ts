// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { parseEquation } from '../src/index';
import { getHintLadder, scoreEquationState } from '../src/hints';

describe('Hint Ladder Engine', () => {
  describe('Parentheses Compliance Guardrail', () => {
    const testEquations = [
      '2*x + 5 = 15',
      '3*x = 12',
      'x + 2 + 3 = 10',
      '2*x + 3 = x + 7',
      '2*(x + 3) = 14',
      'x^2 - 9 = 0',
      'x = 5',
    ];

    testEquations.forEach((rawEq) => {
      it(`produces hints without parentheses for equation: ${rawEq}`, () => {
        const eq = parseEquation(rawEq);
        const ladder = getHintLadder(eq);
        if (ladder) {
          expect(ladder.strategicGoal).not.toContain('(');
          expect(ladder.strategicGoal).not.toContain(')');
          expect(ladder.focusDescription).not.toContain('(');
          expect(ladder.focusDescription).not.toContain(')');
          expect(ladder.actionableMove).not.toContain('(');
          expect(ladder.actionableMove).not.toContain(')');
        }
      });
    });
  });

  describe('Human-Centric Pedagogy Compliance Guardrail', () => {
    const testEquations = [
      '2*x + 5 = 15',
      '3*x = 12',
      'x + 2 + 3 = 10',
      '2*x + 3 = x + 7',
      '2*(x + 3) = 14',
      'x^2 - 9 = 0',
      'sin(x) = 1',
    ];

    testEquations.forEach((rawEq) => {
      it(`never exposes developer internal jargon for equation: ${rawEq}`, () => {
        const eq = parseEquation(rawEq);
        const ladder = getHintLadder(eq);
        if (ladder) {
          expect(ladder.focusDescription).not.toMatch(/\bSubtree\b/i);
          expect(ladder.focusDescription).not.toMatch(/\blhs\b/);
          expect(ladder.focusDescription).not.toMatch(/\brhs\b/);
          expect(ladder.strategicGoal).not.toMatch(/\bSubtree\b/i);
          expect(ladder.actionableMove).not.toMatch(/\bSubtree\b/i);
        }
      });
    });
  });

  describe('Multi-Variable Formula Guardrail', () => {
    it('returns null (disabling hints) for multi-variable formula: a^2 + b^2 = c^2', () => {
      const eq = parseEquation('a^2 + b^2 = c^2');
      const ladder = getHintLadder(eq);
      expect(ladder).toBeNull();
    });
  });

  describe('Standard Form Linear Equations', () => {
    it('provides progressive hints for isolating constant on RHS: 2*x + 5 = 15', () => {
      const eq = parseEquation('2*x + 5 = 15');
      const ladder = getHintLadder(eq);
      expect(ladder).not.toBeNull();
      expect(ladder?.strategicGoal).toBe('Move numbers to the right side');
      expect(ladder?.focusPath).toBeDefined();
      expect(ladder?.actionableMove).toContain('5');
    });

    it('provides progressive hints for coefficient division: 3*x = 12', () => {
      const eq = parseEquation('3*x = 12');
      const ladder = getHintLadder(eq);
      expect(ladder).not.toBeNull();
      expect(ladder?.strategicGoal).toContain('isolate x');
      expect(ladder?.actionableMove).toContain('3');
    });

    it('provides progressive hints for combining constants: x + 2 + 3 = 10', () => {
      const eq = parseEquation('x + 2 + 3 = 10');
      const ladder = getHintLadder(eq);
      expect(ladder).not.toBeNull();
      expect(ladder?.actionableMove).toBe('Simplify 2 + 3 to 5');
    });

    it('provides progressive hints for collecting variable terms: 2*x + 3 = x + 7', () => {
      const eq = parseEquation('2*x + 3 = x + 7');
      const ladder = getHintLadder(eq);
      expect(ladder).not.toBeNull();
      expect(ladder?.strategicGoal).toContain('Move terms with x');
      expect(ladder?.actionableMove).toContain('x');
    });
  });

  describe('Solved Equations', () => {
    it('returns solved hint for x = 5', () => {
      const eq = parseEquation('x = 5');
      const ladder = getHintLadder(eq);
      expect(ladder).not.toBeNull();
      expect(ladder?.strategicGoal).toBe('The equation is already solved for x');
      expect(ladder?.focusPath).toBeNull();
      expect(ladder?.actionableMove).toBe('No further moves needed');
    });
  });

  describe('Leaf Evaluation Heuristic Scoring', () => {
    it('scores isolated variable states higher than mixed states', () => {
      const mixedEq = parseEquation('2*x + 5 = x + 10');
      const isolatedEq = parseEquation('x = 5');
      const scoreMixed = scoreEquationState(mixedEq, 'x');
      const scoreIsolated = scoreEquationState(isolatedEq, 'x');
      expect(scoreIsolated).toBeGreaterThan(scoreMixed);
    });
  });
});
