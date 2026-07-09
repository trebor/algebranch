// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import {
  clampAnimationSpeed,
  ANIMATION_SPEED_DEFAULT,
  ANIMATION_SPEED_OPTIONS,
  DEFAULT_SETTINGS,
} from '@/store/equation';

const JUNK_NAN = Number.NaN;
const JUNK_INFINITY = Infinity;
const JUNK_STRING = '1.5';
const JUNK_UNDEFINED = undefined;
const CLAMP_LOW = 0.05;
const CLAMP_HIGH = 10;
const EXPECTED_OPTIONS_COUNT = 4;

describe('clampAnimationSpeed', () => {
  it('returns the default for non-finite or junk input', () => {
    expect(clampAnimationSpeed(JUNK_NAN)).toBe(ANIMATION_SPEED_DEFAULT);
    expect(clampAnimationSpeed(JUNK_INFINITY)).toBe(ANIMATION_SPEED_DEFAULT);
    // @ts-expect-error — guarding against persisted junk from older builds
    expect(clampAnimationSpeed(JUNK_STRING)).toBe(ANIMATION_SPEED_DEFAULT);
    // @ts-expect-error — undefined can arrive from settings missing the key
    expect(clampAnimationSpeed(JUNK_UNDEFINED)).toBe(ANIMATION_SPEED_DEFAULT);
  });

  it('clamps to the supported range', () => {
    const min = ANIMATION_SPEED_OPTIONS[0].speed;
    const max = ANIMATION_SPEED_OPTIONS[ANIMATION_SPEED_OPTIONS.length - 1].speed;
    expect(clampAnimationSpeed(CLAMP_LOW)).toBe(min);
    expect(clampAnimationSpeed(CLAMP_HIGH)).toBe(max);
  });

  it('passes valid in-range values through untouched', () => {
    for (const opt of ANIMATION_SPEED_OPTIONS) {
      expect(clampAnimationSpeed(opt.speed)).toBe(opt.speed);
    }
  });
});

describe('animation speed settings defaults', () => {
  it('defaults animationSpeed to the default speed multiplier', () => {
    expect(DEFAULT_SETTINGS.animationSpeed).toBe(ANIMATION_SPEED_DEFAULT);
    expect(ANIMATION_SPEED_DEFAULT).toBe(1);
  });

  it('includes a Default option pinned to the normal speed', () => {
    const def = ANIMATION_SPEED_OPTIONS.find((o) => o.speed === ANIMATION_SPEED_DEFAULT);
    expect(def).toBeDefined();
    expect(def?.label).toBe('1×');
  });

  it('has the expected number of options', () => {
    expect(ANIMATION_SPEED_OPTIONS.length).toBe(EXPECTED_OPTIONS_COUNT);
  });
});
