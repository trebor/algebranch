// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Provider } from 'jotai';
import { SHORTCUT_CATALOG } from '@/constants/shortcutCatalog';
import { LearnPracticeContent, Sidebar } from '@/components/Sidebar';
import { BottomSheetType } from '@/store/equation';

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

    // Collapsed initially, so Linear Equations item is not shown yet
    expect(screen.queryByText('Linear Equations')).not.toBeInTheDocument();

    // Click Practice Sets button to expand
    const practiceSetsBtn = screen.getByText('Practice Sets').closest('button');
    expect(practiceSetsBtn).not.toBeNull();
    if (practiceSetsBtn) {
      fireEvent.click(practiceSetsBtn);
    }

    // Now Linear Equations item is revealed
    expect(screen.getByText('Linear Equations')).toBeInTheDocument();
  });

  it('renders Sidebar containing Learn & Practice section between Workspace and Library', () => {
    render(
      <Provider>
        <Sidebar />
      </Provider>
    );

    const sidebar = screen.getByRole('complementary', { name: /workspace and library/i });
    expect(sidebar).toBeInTheDocument();
    expect(screen.getByText('Learn & Practice')).toBeInTheDocument();
    expect(screen.getByText('Equation Library')).toBeInTheDocument();
  });
});
