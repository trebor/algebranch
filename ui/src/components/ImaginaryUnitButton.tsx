// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { IMAGINARY_UNIT, IMAGINARY_UNIT_HINT } from '../constants/mathSymbols';
import { THEME_GLASS } from '../constants/theme';
import { insertAtCaret } from '../utils/insertAtCaret';
import { Tooltip } from './Tooltip';

/**
 * Palette button that inserts the imaginary unit ⅈ (U+2148) into an expression
 * field at the caret (#105). The glyph is a distinct codepoint that can't be
 * typed from a bare keyboard by design, so every place that accepts a typed
 * expression — the equation-input modal and the global-op operand input — hosts
 * one of these. Rendered as an upright roman i, matching how ⅈ is drawn in the
 * equation, so it reads as "insert the imaginary unit" rather than a variable.
 *
 * Callers gate the button's presence on the `allowComplex` setting: a
 * real-numbers-only class shouldn't be able to type ⅈ either.
 */
export const ImaginaryUnitButton: React.FC<{
  /** The expression field the glyph is spliced into. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Receives the field's new value (typically the field's onChange handler). */
  onInsert: (next: string) => void;
  disabled?: boolean;
  className?: string;
}> = ({ inputRef, onInsert, disabled, className }) => (
  <Tooltip content={IMAGINARY_UNIT_HINT} position="top">
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const el = inputRef.current;
        if (el) insertAtCaret(el, IMAGINARY_UNIT, onInsert);
      }}
      aria-label="Insert imaginary unit"
      className={`${THEME_GLASS.SYMBOL_INSERT_BTN} ${className ?? ''}`}
    >
      <span className="not-italic font-serif text-base leading-none">i</span>
    </button>
  </Tooltip>
);
