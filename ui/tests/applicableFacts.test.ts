// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import { parseEquation } from 'math-engine';
import {
  applicableFactsAtom,
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';

const makeTabWithEq = (id: string, name: string, eqStr: string): WorkspaceTab => {
  const eq = parseEquation(eqStr);
  return {
    id,
    name,
    historyTree: {
      '0': { id: '0', equation: eq, parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
};

describe('applicableFactsAtom', () => {
  it('filters available facts to only those relevant to the current equation', () => {
    const store = createStore();
    
    // Tab 'a' has equation: x + y = 10
    // Tab 'b' has equation: y = 2 * x (defines y)
    // Tab 'c' has equation: z = 4 (defines z)
    const tabA = makeTabWithEq('a', 'Tab A', 'x + y = 10');
    const tabB = makeTabWithEq('b', 'Tab B', 'y = 2 * x');
    const tabC = makeTabWithEq('c', 'Tab C', 'z = 4');

    store.set(rawTabsAtom, [tabA, tabB, tabC]);
    store.set(rawActiveTabIdAtom, 'a');

    // On tab A, variable 'y' is in the equation, but 'z' is not.
    // So only the fact from Tab B (y = 2 * x) should be applicable.
    const facts = store.get(applicableFactsAtom);
    expect(facts).toHaveLength(1);
    expect(facts[0].variable).toBe('y');
  });
});
