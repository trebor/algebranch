// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi } from 'vitest';
import { insertAtCaret } from '@/utils/insertAtCaret';
import { IMAGINARY_UNIT } from '@/constants/mathSymbols';

const makeInput = (value: string, start: number, end = start): HTMLInputElement => {
  const el = document.createElement('input');
  el.value = value;
  el.setSelectionRange(start, end);
  return el;
};

describe('insertAtCaret', () => {
  it('inserts the glyph at the caret position', () => {
    const el = makeInput('3+2', 3);
    let captured = '';
    const next = insertAtCaret(el, IMAGINARY_UNIT, (v) => { captured = v; });
    expect(next).toBe(`3+2${IMAGINARY_UNIT}`);
    expect(captured).toBe(`3+2${IMAGINARY_UNIT}`);
  });

  it('inserts in the middle, splitting the existing text', () => {
    const el = makeInput('3+x', 2); // caret between '+' and 'x'
    const next = insertAtCaret(el, IMAGINARY_UNIT, () => {});
    expect(next).toBe(`3+${IMAGINARY_UNIT}x`);
  });

  it('replaces the current selection', () => {
    const el = makeInput('3+9', 2, 3); // '9' selected
    const next = insertAtCaret(el, IMAGINARY_UNIT, () => {});
    expect(next).toBe(`3+${IMAGINARY_UNIT}`);
  });

  it('restores focus and places the caret after the inserted glyph', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    const el = makeInput('3+2', 3);
    document.body.appendChild(el);
    insertAtCaret(el, IMAGINARY_UNIT, (v) => { el.value = v; });
    expect(document.activeElement).toBe(el);
    expect(el.selectionStart).toBe(4);
    expect(el.selectionEnd).toBe(4);
    document.body.removeChild(el);
    vi.unstubAllGlobals();
  });
});
