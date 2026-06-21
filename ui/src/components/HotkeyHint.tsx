// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { THEME_GLASS } from '../constants/theme';

interface HotkeyHintProps {
  /** The action description shown before the key(s). */
  label: string;
  /** One hotkey, or several alternatives each rendered as its own keycap. */
  keys: string | string[];
}

/**
 * Tooltip content node pairing a label with its keyboard shortcut(s) rendered
 * as compact keycap chips (#239). Replaces the old "(C)" / "(⌘Z)" parentheticals
 * jammed into tooltip text, so the key reads as a key, consistently everywhere.
 * Pass an array for actions bound to more than one key (e.g. ['W', 'L']).
 */
export const HotkeyHint: React.FC<HotkeyHintProps> = ({ label, keys }) => {
  const keyList = Array.isArray(keys) ? keys : [keys];
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {keyList.map((k, i) => (
        <kbd key={`${k}-${i}`} className={THEME_GLASS.SHORTCUT_KEYCAP_SM}>
          {k}
        </kbd>
      ))}
    </span>
  );
};
