// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { THEME_GLASS } from '@/constants/theme';

describe('Recessed card semantic styling tokens for panel containers', () => {
  it('defines RECESSED_CARD with near-black (bg-neutral-950) ground matching history tree & library items', () => {
    expect(THEME_GLASS.RECESSED_CARD).toBeDefined();
    expect(THEME_GLASS.RECESSED_CARD).toMatch(/bg-neutral-950/);
    expect(THEME_GLASS.RECESSED_CARD).not.toMatch(/16142a/);
  });

  it('defines RECESSED_CARD_ACTIVE with near-black ground and indigo border/accent', () => {
    expect(THEME_GLASS.RECESSED_CARD_ACTIVE).toBeDefined();
    expect(THEME_GLASS.RECESSED_CARD_ACTIVE).toMatch(/bg-neutral-950/);
    expect(THEME_GLASS.RECESSED_CARD_ACTIVE).toMatch(/border-indigo/);
  });

  it('aligns CATEGORY_ITEM with near-black ground for equation library items', () => {
    expect(THEME_GLASS.CATEGORY_ITEM).toMatch(/bg-neutral-950/);
  });
});
