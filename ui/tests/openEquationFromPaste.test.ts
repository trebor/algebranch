// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  equationInputModalOpenAtom,
  equationEditSeedAtom,
  openEquationFromPasteAtom,
} from '@/store/equation';

// ⌘V paste-to-open (#440): a raw clipboard string seeds the New Equation modal,
// reusing the same relation-splitting the query-param prefill uses.
describe('openEquationFromPasteAtom', () => {
  it('splits the pasted text into LHS / relation / RHS and opens the modal', () => {
    const store = createStore();
    store.set(openEquationFromPasteAtom, '2x + 1 = 7');

    expect(store.get(equationInputModalOpenAtom)).toBe(true);
    expect(store.get(equationEditSeedAtom)).toEqual({
      lhs: '2x + 1',
      relation: '=',
      rhs: '7',
    });
  });

  it('seeds a relation-less expression as the LHS with a default =', () => {
    const store = createStore();
    store.set(openEquationFromPasteAtom, 'x^2 - 9');

    expect(store.get(equationInputModalOpenAtom)).toBe(true);
    expect(store.get(equationEditSeedAtom)).toEqual({
      lhs: 'x^2 - 9',
      relation: '=',
      rhs: '',
    });
  });

  it('is a no-op for blank clipboard text (never opens an empty modal)', () => {
    const store = createStore();
    store.set(openEquationFromPasteAtom, '   ');

    expect(store.get(equationInputModalOpenAtom)).toBe(false);
    expect(store.get(equationEditSeedAtom)).toBeNull();
  });
});
