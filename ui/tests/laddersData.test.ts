// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, test, expect } from 'vitest';
import {
  PRACTICE_SETS,
  MIN_PRACTICE_SET_LENGTH,
  MAX_PRACTICE_SET_LENGTH,
  getPracticeSetForChapter,
} from '../src/constants/ladders';
import { PRESET_LIST } from '../src/constants/presets';

describe('Practice Sets Data Curation (ladders.ts)', () => {
  test('contains at least 5 practice sets', () => {
    expect(PRACTICE_SETS.length).toBeGreaterThanOrEqual(5);
  });

  test('each practice set satisfies size bounds (5 to 8 problems)', () => {
    for (const set of PRACTICE_SETS) {
      expect(set.presetIds.length).toBeGreaterThanOrEqual(MIN_PRACTICE_SET_LENGTH);
      expect(set.presetIds.length).toBeLessThanOrEqual(MAX_PRACTICE_SET_LENGTH);
    }
  });

  test('every presetId exists in PRESET_LIST and belongs to Practice Problems category', () => {
    const validPresetMap = new Map(PRESET_LIST.map((p) => [p.id, p]));

    for (const set of PRACTICE_SETS) {
      for (const presetId of set.presetIds) {
        const preset = validPresetMap.get(presetId);
        expect(preset).toBeDefined();
        expect(preset?.category).toBe('Practice Problems');
      }
    }
  });

  test('no practice set contains duplicate presetIds internally', () => {
    for (const set of PRACTICE_SETS) {
      const uniqueIds = new Set(set.presetIds);
      expect(uniqueIds.size).toBe(set.presetIds.length);
    }
  });

  test('getPracticeSetForChapter maps tutorial chapters to valid Practice Sets', () => {
    const chapters = ['linear', 'complex', 'identities', 'global', 'substitution', 'unknown_chapter'];
    for (const chapterId of chapters) {
      const set = getPracticeSetForChapter(chapterId);
      expect(set).toBeDefined();
      expect(PRACTICE_SETS.some((s) => s.id === set.id)).toBe(true);
    }
  });
});
