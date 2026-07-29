// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider, createStore } from 'jotai';
import { SHORTCUT_CATALOG } from '@/constants/shortcutCatalog';
import { LearnPracticeContent, Sidebar } from '@/components/Sidebar';
import { BottomSheetType } from '@/store/equation';
import { startPracticeSetAtom } from '@/store/ladders';

describe('Learn & Practice Section (#550)', () => {
  it('registers toggle-practice-sets in shortcutCatalog', () => {
    const entry = SHORTCUT_CATALOG.find((s) => s.id === 'toggle-practice-sets');
    expect(entry).toBeDefined();
    expect(entry?.key).toBe('p');
    expect(entry?.shift).toBe(true);
    expect(entry?.keyLabel).toBe('Shift+P');
    expect(entry?.category).toBe('Panels');
  });

  it('allows practice as a valid BottomSheetType', () => {
    const sheetType: BottomSheetType = 'practice';
    expect(sheetType).toBe('practice');
  });

  it('renders LearnPracticeContent with Interactive Tutorials and Practice Sets', () => {
    render(
      <Provider>
        <LearnPracticeContent showHeader={true} />
      </Provider>
    );

    expect(screen.getByText('Learn & Practice')).toBeInTheDocument();
    expect(screen.getByText('Interactive Tutorials')).toBeInTheDocument();
    expect(screen.getByText('Practice Sets')).toBeInTheDocument();

    // Practice Sets are displayed directly in the scrollable list
    expect(screen.getByText('Linear Equations')).toBeInTheDocument();
  });

  it('renders Sidebar containing Learn and Library tabs', () => {
    render(
      <Provider>
        <Sidebar />
      </Provider>
    );

    const sidebar = screen.getByRole('complementary', { name: /workspace and library/i });
    expect(sidebar).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /learn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /library/i })).toBeInTheDocument();
  });

  it('automatically expands practice sets when an active practice set is set', () => {
    const customStore = createStore();
    customStore.set(startPracticeSetAtom, { setId: 'radical_equations', position: 0 });

    render(
      <Provider store={customStore}>
        <LearnPracticeContent showHeader={true} />
      </Provider>
    );

    // Should be automatically expanded when activePracticeSet is non-null
    expect(screen.getByText('Radical Equations')).toBeInTheDocument();
  });
});
