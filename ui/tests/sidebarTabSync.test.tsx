// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import { sidebarTabAtom, startOnboardingChapterAtom } from '@/store/equation';
import { startPracticeSetAtom } from '@/store/ladders';

describe('Sidebar tab synchronization with learning activities', () => {
  it('automatically sets sidebar tab to learn when starting a practice set', () => {
    const store = createStore();
    expect(store.get(sidebarTabAtom)).toBe('workspace');

    store.set(startPracticeSetAtom, { setId: 'linear_basics', position: 0 });

    expect(store.get(sidebarTabAtom)).toBe('learn');
  });

  it('automatically sets sidebar tab to learn when starting an onboarding tutorial chapter', () => {
    const store = createStore();
    expect(store.get(sidebarTabAtom)).toBe('workspace');

    store.set(startOnboardingChapterAtom, 'intro');

    expect(store.get(sidebarTabAtom)).toBe('learn');
  });
});
