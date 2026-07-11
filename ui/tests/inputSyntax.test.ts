// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The equation-input-format reference (#507) documents what a user can type into
// Algebranch. Like the /link-format worked examples (which render from the real
// URL encoder), this reference must never claim syntax the parser rejects. So the
// data is validated against the real `parseEquation` — normalizer included — here:
// every documented function, constant, and alias is exercised end to end.
import { describe, it, expect } from 'vitest';
import { parseEquation, equationToString } from 'math-engine-client';
import {
  INPUT_FUNCTIONS,
  INPUT_CONSTANTS,
  INPUT_ALIASES,
} from '@/constants/inputSyntax';

// A documented `call` cell may list several forms — space-separated
// ("sin(x) cos(x) tan(x)") or comma-separated ("log(x), log(x, b)"). Pull out
// each `name(args)` call and make it a concrete equation the parser can chew on.
const asEquations = (call: string): string[] =>
  (call.match(/[a-zA-Z]+\([^)]*\)/g) ?? []).map((f) => `${f}=0`);

describe('input-format reference (#507)', () => {
  it('every documented function form parses', () => {
    for (const { call } of INPUT_FUNCTIONS) {
      for (const eq of asEquations(call)) {
        expect(() => parseEquation(eq), eq).not.toThrow();
      }
    }
  });

  it('every documented constant parses', () => {
    for (const { call } of INPUT_CONSTANTS) {
      const eq = `${call}=0`;
      expect(() => parseEquation(eq), eq).not.toThrow();
    }
  });

  it('every alias normalizes to its documented canonical equation', () => {
    for (const { input, canonical } of INPUT_ALIASES) {
      // Both forms are full equations; after the normalizer + parser they must
      // render identically. If the normalizer stops handling an alias, this
      // asserts the reference is now lying and fails loudly.
      const fromAlias = equationToString(parseEquation(input));
      const fromCanonical = equationToString(parseEquation(canonical));
      expect(fromAlias, `${input}  vs  ${canonical}`).toBe(fromCanonical);
    }
  });
});
