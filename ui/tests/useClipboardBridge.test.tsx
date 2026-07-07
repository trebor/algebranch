// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClipboardBridge } from '@/hooks/useClipboardBridge';

/** Dispatch a synthetic `copy`/`paste` from a chosen target, with a stub clipboardData. */
function dispatchClipboard(
  type: 'copy' | 'paste',
  {
    target = document.body,
    getData,
    setData,
  }: { target?: EventTarget; getData?: () => string; setData?: (fmt: string, v: string) => void } = {},
) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', {
    value: { getData: getData ?? (() => ''), setData: setData ?? (() => {}) },
    configurable: true,
  });
  target.dispatchEvent(ev);
  return ev;
}

const baseOpts = () => ({
  getEquationUnicode: vi.fn<() => string | null>(() => 'x²'),
  onIdleCopy: vi.fn(),
  onPaste: vi.fn(),
});

describe('useClipboardBridge — paste', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the modal with the pasted text when focus is not editable', () => {
    const opts = baseOpts();
    renderHook(() => useClipboardBridge(opts));

    const ev = dispatchClipboard('paste', { getData: () => '2x+1=7' });

    expect(opts.onPaste).toHaveBeenCalledWith('2x+1=7');
    expect(ev.defaultPrevented).toBe(true);
  });

  it('never hijacks paste while focus is in an input', () => {
    const opts = baseOpts();
    renderHook(() => useClipboardBridge(opts));

    const input = document.createElement('input');
    document.body.appendChild(input);
    const ev = dispatchClipboard('paste', { target: input, getData: () => '2x+1=7' });

    expect(opts.onPaste).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    input.remove();
  });

  it('ignores a blank clipboard (never opens an empty modal)', () => {
    const opts = baseOpts();
    renderHook(() => useClipboardBridge(opts));

    const ev = dispatchClipboard('paste', { getData: () => '   ' });

    expect(opts.onPaste).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('does nothing when disabled', () => {
    const opts = baseOpts();
    renderHook(() => useClipboardBridge({ ...opts, disabled: true }));

    dispatchClipboard('paste', { getData: () => '2x+1=7' });
    expect(opts.onPaste).not.toHaveBeenCalled();
  });
});

describe('useClipboardBridge — idle copy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('copies the current equation as Unicode when the selection is collapsed', () => {
    const opts = baseOpts();
    renderHook(() => useClipboardBridge(opts));

    const setData = vi.fn();
    const ev = dispatchClipboard('copy', { setData });

    expect(setData).toHaveBeenCalledWith('text/plain', 'x²');
    expect(opts.onIdleCopy).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('yields to the native copy when a real text selection exists', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false } as Selection);
    const opts = baseOpts();
    renderHook(() => useClipboardBridge(opts));

    const setData = vi.fn();
    const ev = dispatchClipboard('copy', { setData });

    expect(setData).not.toHaveBeenCalled();
    expect(opts.onIdleCopy).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('does nothing when there is no current equation', () => {
    const opts = { ...baseOpts(), getEquationUnicode: vi.fn(() => null) };
    renderHook(() => useClipboardBridge(opts));

    const setData = vi.fn();
    const ev = dispatchClipboard('copy', { setData });

    expect(setData).not.toHaveBeenCalled();
    expect(opts.onIdleCopy).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });
});
