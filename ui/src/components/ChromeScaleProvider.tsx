// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { settingsAtom, clampChromeScale } from '../store/equation';

/**
 * Drives the accessibility text-size knob (#239). Writes the persisted
 * `chromeScale` setting to the `--chrome-scale` CSS variable on the document
 * root; `globals.css` multiplies the root rem by it, so every rem-based piece of
 * chrome (menus, tooltips, labels, badges) grows or shrinks together.
 *
 * This deliberately decouples from the equation canvas: `useMathScale`
 * auto-fits the math to its container, so the canvas stays visually stable while
 * the surrounding chrome scales. We apply via an effect (not SSR) because the
 * setting only exists after client hydration from localStorage.
 */
export function ChromeScaleProvider({ children }: { children: React.ReactNode }) {
  const settings = useAtomValue(settingsAtom);
  const scale = clampChromeScale(settings.chromeScale);

  useEffect(() => {
    document.documentElement.style.setProperty('--chrome-scale', String(scale));
  }, [scale]);

  return <>{children}</>;
}
