// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'jotai';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  sourcePathAtom,
  liveAnnouncementAtom,
  onboardingChapterIdAtom,
  dragNudgeDismissedAtom,
  dragNudgeAtom,
  triggerDragNudgeAtom,
  dismissDragNudgeAtom,
  safeLocalStorage,
  DRAG_NUDGE_DISMISSED_KEY,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function makeStore(eqText: string) {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation(eqText), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

beforeEach(() => {
  safeLocalStorage.removeItem(DRAG_NUDGE_DISMISSED_KEY);
});

describe('triggerDragNudgeAtom — select-on-drag hand-off', () => {
  it('selects the dragged term as the source and shows the nudge anchored to it', () => {
    const store = makeStore('x + 3 = 7');
    store.set(triggerDragNudgeAtom, 'lhs/1');

    expect(store.get(sourcePathAtom)).toBe('lhs/1');
    expect(store.get(dragNudgeAtom)).toEqual({ path: 'lhs/1' });
    // Announced for screen-reader users, not purely visual — names the selected
    // term (mirroring the card's preview) and the two-tap model.
    const announced = store.get(liveAnnouncementAtom).toLowerCase();
    expect(announced).toContain('selected');
    expect(announced).toContain('two taps');
    expect(announced).toContain('green glowing target');
  });

  it('is suppressed once the user has dismissed it forever', () => {
    const store = makeStore('x + 3 = 7');
    store.set(dragNudgeDismissedAtom, true);
    store.set(triggerDragNudgeAtom, 'lhs/1');
    expect(store.get(dragNudgeAtom)).toBeNull();
  });

  it('is suppressed while the onboarding tour is active', () => {
    const store = makeStore('x + 3 = 7');
    store.set(onboardingChapterIdAtom, 'chapter_intro');
    store.set(triggerDragNudgeAtom, 'lhs/1');
    expect(store.get(dragNudgeAtom)).toBeNull();
  });

  it('does not re-show while a nudge is already visible', () => {
    const store = makeStore('x + 3 = 7');
    store.set(triggerDragNudgeAtom, 'lhs/1');
    // A second drag on a different term must not steal the anchor while one is up.
    store.set(triggerDragNudgeAtom, 'lhs/0');
    expect(store.get(dragNudgeAtom)).toEqual({ path: 'lhs/1' });
  });

  it('returns on the very next drag after a dismiss (no cooldown lockout)', () => {
    const store = makeStore('x + 3 = 7');
    store.set(triggerDragNudgeAtom, 'lhs/1');
    store.set(dismissDragNudgeAtom, { dontShowAgain: false });
    expect(store.get(dragNudgeAtom)).toBeNull();

    // Immediately dragging again re-shows it — the dismissal was not permanent.
    store.set(triggerDragNudgeAtom, 'lhs/1');
    expect(store.get(dragNudgeAtom)).toEqual({ path: 'lhs/1' });
  });
});

describe('dismissDragNudgeAtom — checkbox vs. plain dismiss', () => {
  it('a plain dismiss hides the hint but does NOT persist "dismissed"', () => {
    const store = makeStore('x + 3 = 7');
    store.set(triggerDragNudgeAtom, 'lhs/1');
    store.set(dismissDragNudgeAtom, { dontShowAgain: false });

    expect(store.get(dragNudgeAtom)).toBeNull();
    expect(store.get(dragNudgeDismissedAtom)).toBe(false);
    expect(safeLocalStorage.getItem(DRAG_NUDGE_DISMISSED_KEY)).toBeNull();
  });

  it('checking "Don\'t show this again" persists the dismissal permanently', () => {
    const store = makeStore('x + 3 = 7');
    store.set(triggerDragNudgeAtom, 'lhs/1');
    store.set(dismissDragNudgeAtom, { dontShowAgain: true });

    expect(store.get(dragNudgeAtom)).toBeNull();
    expect(store.get(dragNudgeDismissedAtom)).toBe(true);
    expect(safeLocalStorage.getItem(DRAG_NUDGE_DISMISSED_KEY)).toBe('true');
  });
});
