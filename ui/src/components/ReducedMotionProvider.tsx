// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { MotionConfig } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Drives framer-motion's reduced-motion config from our own reactive
 * `useReducedMotion` (#145). We deliberately do NOT use `MotionConfig
 * reducedMotion="user"`: that resolves through framer's own `useReducedMotion`,
 * which reads the setting once at mount and never updates, so flipping the OS
 * preference back off would not restore motion until a reload. Passing an
 * explicit "always" / "never" that we recompute reactively keeps every
 * framer-motion animation honest in both directions.
 */
export function ReducedMotionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>;
}
