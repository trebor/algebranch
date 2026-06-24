// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { Maximize2 } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS } from '../constants/theme';

/**
 * Header entry point into immersive hide-chrome mode (#252). A Maximize-style
 * button shown only on short/landscape viewports while the chrome is visible
 * (page.tsx owns that gating); activating it retreats the header + BottomNav so
 * nearly the full height goes to the expression. The PeekHandle brings it back.
 */
export function ImmersiveToggle({ onEnter }: { onEnter: () => void }) {
  return (
    <Tooltip content="Hide toolbars" position="bottom" autoAlign={false}>
      <button
        onClick={onEnter}
        className={THEME_GLASS.HEADER_BUTTON}
        aria-label="Hide toolbars"
      >
        <Maximize2 size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
      </button>
    </Tooltip>
  );
}
