// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { PRESET_LIST, CATEGORY_EXAMPLES } from '@/constants/presets';
import { parseEquation } from 'math-engine-client';

describe('CATEGORY_EXAMPLES (#245)', () => {
  const categories = [...new Set(PRESET_LIST.map((p) => p.category))];

  it('provides an example for every preset category', () => {
    for (const category of categories) {
      expect(CATEGORY_EXAMPLES[category], `missing example for "${category}"`).toBeTruthy();
    }
  });

  it('every example is a parseable equation (so the shown syntax actually works)', () => {
    for (const [category, example] of Object.entries(CATEGORY_EXAMPLES)) {
      expect(() => parseEquation(example), `unparseable example for "${category}": ${example}`).not.toThrow();
    }
  });
});
