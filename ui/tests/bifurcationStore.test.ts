// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { createStore } from 'jotai';
import { parseEquation } from 'math-engine';
import {
  historyTreeAtom,
  currentNodeIdAtom,
  pushEquationAtom,
  pushBifurcationAtom,
  isBranchResolved,
  bifurcationStateAtom,
  HistoryNode,
} from '../src/store/equation';
import { rawPracticeSetProgressAtom } from '../src/store/ladders';

describe('Bifurcation Store & Resolution State', () => {
  it('pushBifurcationAtom inserts atomic sibling child nodes with bifurcation metadata', () => {
    const store = createStore();
    const rootEq = parseEquation('x^2 = 9');
    const rootNodeId = 'step_root';

    const rootNode: HistoryNode = {
      id: rootNodeId,
      equation: rootEq,
      parentId: null,
      childrenIds: [],
      label: 'Initial Equation',
      timestamp: 1000,
      focusedInSession: true,
    };

    store.set(historyTreeAtom, { [rootNodeId]: rootNode });
    store.set(currentNodeIdAtom, rootNodeId);

    const posEq = parseEquation('sqrt(x^2) = sqrt(9)');
    const negEq = parseEquation('sqrt(x^2) = -sqrt(9)');

    store.set(pushBifurcationAtom, [
      { equation: posEq, label: 'Global Sqrt (+)' },
      { equation: negEq, label: 'Global Sqrt (-)' },
    ]);

    const tree = store.get(historyTreeAtom);
    const rootAfter = tree[rootNodeId];
    expect(rootAfter.childrenIds).toHaveLength(2);

    const child1 = tree[rootAfter.childrenIds[0]];
    const child2 = tree[rootAfter.childrenIds[1]];

    expect(child1.bifurcation).toBeDefined();
    expect(child1.bifurcation?.totalBranches).toBe(2);
    expect(child1.bifurcation?.branchIndex).toBe(1);
    expect(child1.bifurcation?.groupId).toBe(child2.bifurcation?.groupId);

    expect(child2.bifurcation?.branchIndex).toBe(2);

    // Default active node is child 1
    expect(store.get(currentNodeIdAtom)).toBe(child1.id);
  });

  it('pushBifurcationAtom inserts bifurcation cases on root equation', () => {
    const store = createStore();
    const rootEq = parseEquation('sqrt(x^2) = sqrt(9)');
    const rootNodeId = 'step_root';

    const rootNode: HistoryNode = {
      id: rootNodeId,
      equation: rootEq,
      parentId: null,
      childrenIds: [],
      label: 'Initial Equation',
      timestamp: 1000,
      focusedInSession: true,
    };

    store.set(historyTreeAtom, { [rootNodeId]: rootNode });
    store.set(currentNodeIdAtom, rootNodeId);

    const cases = [
      { equation: parseEquation('x = sqrt(9)'), label: 'Take Root (+)' },
      { equation: parseEquation('x = -sqrt(9)'), label: 'Take Root (-)' },
    ];
    store.set(pushBifurcationAtom, cases);

    const tree = store.get(historyTreeAtom);
    const rootAfter = tree[rootNodeId];
    expect(rootAfter.childrenIds).toHaveLength(2);

    const child1 = tree[rootAfter.childrenIds[0]];
    const child2 = tree[rootAfter.childrenIds[1]];

    expect(child1.bifurcation?.branchLabel).toBe('Take Root (+)');
    expect(child2.bifurcation?.branchLabel).toBe('Take Root (-)');
  });

  describe('isBranchResolved', () => {
    it('returns true if node is extended (childrenIds.length > 0)', () => {
      const node: HistoryNode = {
        id: 'c1',
        equation: parseEquation('x = 3'),
        parentId: 'root',
        childrenIds: ['c1_child'],
        label: 'Branch 1',
        timestamp: 1000,
        bifurcation: { groupId: 'g1', totalBranches: 2, branchIndex: 1, branchLabel: 'Branch 1' },
      };
      expect(isBranchResolved(node)).toBe(true);
    });

    it('returns false for an unextended, non-terminal equation even when focused', () => {
      const node: HistoryNode = {
        id: 'c1',
        equation: parseEquation('x + 1 = 4'),
        parentId: 'root',
        childrenIds: [],
        label: 'Branch 1',
        timestamp: 1000,
        bifurcation: { groupId: 'g1', totalBranches: 2, branchIndex: 1, branchLabel: 'Branch 1' },
        focusedInSession: true,
      };
      expect(isBranchResolved(node)).toBe(false);
    });

    it('returns true when terminal / solved equation (e.g. x = 3)', () => {
      const node: HistoryNode = {
        id: 'c1',
        equation: parseEquation('x = 3'),
        parentId: 'root',
        childrenIds: [],
        label: 'Branch 1',
        timestamp: 1000,
        bifurcation: { groupId: 'g1', totalBranches: 2, branchIndex: 1, branchLabel: 'Branch 1' },
        focusedInSession: true,
      };
      expect(isBranchResolved(node)).toBe(true);
    });
  });

  describe('bifurcationStateAtom', () => {
    it('computes open branch count and next unresolved branch correctly', () => {
      const store = createStore();
      const rootNodeId = 'step_root';

      const rootNode: HistoryNode = {
        id: rootNodeId,
        equation: parseEquation('x^2 = 9'),
        parentId: null,
        childrenIds: ['c1', 'c2'],
        label: 'Root',
        timestamp: 1000,
      };

      const c1: HistoryNode = {
        id: 'c1',
        equation: parseEquation('x + 2 = 5'),
        parentId: rootNodeId,
        childrenIds: [],
        label: 'Branch 1',
        timestamp: 1001,
        bifurcation: { groupId: 'g1', totalBranches: 2, branchIndex: 1, branchLabel: 'Branch 1' },
        focusedInSession: true,
      };

      const c2: HistoryNode = {
        id: 'c2',
        equation: parseEquation('x + 1 = -3'),
        parentId: rootNodeId,
        childrenIds: [],
        label: 'Branch 2',
        timestamp: 1002,
        bifurcation: { groupId: 'g1', totalBranches: 2, branchIndex: 2, branchLabel: 'Branch 2' },
        focusedInSession: false,
      };

      store.set(historyTreeAtom, { [rootNodeId]: rootNode, c1, c2 });
      store.set(currentNodeIdAtom, 'c1');
      // Practice mode active
      store.set(rawPracticeSetProgressAtom, {
        activeSetId: 'set_1',
        position: 0,
        completedSetIds: [],
        setPositions: {},
      });

      const state = store.get(bifurcationStateAtom);
      expect(state).not.toBeNull();
      expect(state?.totalBranches).toBe(2);
      expect(state?.activeBranchIndex).toBe(1);
      expect(state?.activeBranchLabel).toBe('Branch 1');
      expect(state?.openBranchCount).toBe(1);
      expect(state?.nextUnresolvedBranch?.nodeId).toBe('c2');
      expect(state?.allComplete).toBe(false);
    });
  });
});
