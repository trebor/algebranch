// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { THEME_GLASS } from '../constants/theme';

interface HotkeyHintProps {
  /** The action description shown before the key(s). */
  label: string;
  /** One hotkey, or several alternatives each rendered as its own keycap. */
  keys?: string | string[];
  /**
   * A two-step leader sequence (e.g. ['C', 'D']) rendered as chips joined by
   * "then". Mutually exclusive with {@link keys}.
   */
  sequence?: string[];
}

/**
 * Tooltip content node pairing a label with its keyboard shortcut(s) rendered
 * as compact keycap chips (#239). Replaces the old "(C)" / "(⌘Z)" parentheticals
 * jammed into tooltip text, so the key reads as a key, consistently everywhere.
 * Pass `keys` (array = alternatives, e.g. ['W', 'L']) or `sequence` for a
 * leader chord rendered as "C then D".
 */
export const HotkeyHint: React.FC<HotkeyHintProps> = ({ label, keys, sequence }) => {
  if (sequence && sequence.length > 0) {
    return (
      <div className="flex items-start justify-between gap-3 text-left">
        <span className="text-xs leading-snug font-medium text-indigo-100">{label}</span>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {sequence.map((k, i) => (
            <React.Fragment key={`${k}-${i}`}>
              {i > 0 && <span className="text-[10px] text-white/40">then</span>}
              <kbd className={THEME_GLASS.SHORTCUT_KEYCAP_SM}>{k}</kbd>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  const keyList = keys === undefined ? [] : Array.isArray(keys) ? keys : [keys];
  return (
    <div className="flex items-start justify-between gap-3 text-left">
      <span className="text-xs leading-snug font-medium text-indigo-100">{label}</span>
      {keyList.length > 0 && (
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {keyList.map((k, i) => (
            <kbd key={`${k}-${i}`} className={THEME_GLASS.SHORTCUT_KEYCAP_SM}>
              {k}
            </kbd>
          ))}
        </div>
      )}
    </div>
  );
};
