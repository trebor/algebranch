// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { RovingTabindexProvider, useRovingItem } from '@/hooks/useRovingTabindex';

// A leaf item that wires itself into the roving controller. data-key lets the
// test read DOM order; the default keydown handler covers Left/Right/Home/End.
function Item({ k, primary }: { k: string; primary?: boolean }) {
  const { ref, tabIndex, onKeyDown } = useRovingItem(k, { primary });
  return (
    <button ref={ref} tabIndex={tabIndex} onKeyDown={onKeyDown} data-testid={`i-${k}`}>
      {k}
    </button>
  );
}

function Tree({ keys }: { keys: string[] }) {
  return (
    <RovingTabindexProvider>
      <div>
        {keys.map((k) => (
          <Item key={k} k={k} />
        ))}
      </div>
    </RovingTabindexProvider>
  );
}

// Same provider instance across rerenders (top-level type unchanged), with a
// mixed primary/secondary item set — models the async load order where a handle
// (secondary) registers before the candidate scan adds terms (primary).
function MixedTree({ items }: { items: { k: string; primary?: boolean }[] }) {
  return (
    <RovingTabindexProvider>
      <div>
        {items.map((it) => (
          <Item key={it.k} k={it.k} primary={it.primary} />
        ))}
      </div>
    </RovingTabindexProvider>
  );
}

const tabIndexOf = (k: string) => screen.getByTestId(`i-${k}`).getAttribute('tabindex');

describe('useRovingTabindex', () => {
  afterEach(cleanup);

  it('exposes exactly one Tab stop, defaulting to the first item in DOM order', () => {
    render(<Tree keys={['a', 'b', 'c']} />);
    expect(tabIndexOf('a')).toBe('0');
    expect(tabIndexOf('b')).toBe('-1');
    expect(tabIndexOf('c')).toBe('-1');
  });

  it('defaults the entry stop to the first PRIMARY item, skipping a leading secondary', () => {
    // A folded-in handle (#257) registers as secondary: arrow-reachable, but never
    // the default Tab entry point. Here a secondary 'h' leads in DOM order, yet the
    // first primary term 'a' must be the single Tab stop.
    render(
      <RovingTabindexProvider>
        <div>
          <Item k="h" primary={false} />
          <Item k="a" />
          <Item k="b" />
        </div>
      </RovingTabindexProvider>,
    );
    expect(tabIndexOf('h')).toBe('-1');
    expect(tabIndexOf('a')).toBe('0');
    expect(tabIndexOf('b')).toBe('-1');
  });

  it('upgrades the auto-default from a leading secondary to the first primary when one arrives later', () => {
    // Async load order: the handle (secondary) registers before the candidate
    // scan adds the term (primary). The default Tab stop must move to the term,
    // not stay stuck on the handle (#257).
    const { rerender } = render(<MixedTree items={[{ k: 'h', primary: false }]} />);
    expect(tabIndexOf('h')).toBe('0'); // lone item, so it is the default

    rerender(<MixedTree items={[{ k: 'a' }, { k: 'h', primary: false }]} />);
    expect(tabIndexOf('a')).toBe('0'); // upgraded to the primary term
    expect(tabIndexOf('h')).toBe('-1');
  });

  it('does not override a secondary the user deliberately moved to', () => {
    const { rerender } = render(<MixedTree items={[{ k: 'a' }, { k: 'h', primary: false }]} />);
    act(() => screen.getByTestId('i-a').focus());
    fireEvent.keyDown(screen.getByTestId('i-a'), { key: 'ArrowRight' }); // user arrows to the handle
    expect(tabIndexOf('h')).toBe('0');

    // A later registry change (another term) must not yank focus off the handle.
    rerender(<MixedTree items={[{ k: 'a' }, { k: 'h', primary: false }, { k: 'b' }]} />);
    expect(tabIndexOf('h')).toBe('0');
  });

  it('moves the active item and focus with ArrowRight / ArrowLeft', () => {
    render(<Tree keys={['a', 'b', 'c']} />);
    const a = screen.getByTestId('i-a');
    act(() => a.focus());

    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(tabIndexOf('b')).toBe('0');
    expect(document.activeElement).toBe(screen.getByTestId('i-b'));

    fireEvent.keyDown(screen.getByTestId('i-b'), { key: 'ArrowLeft' });
    expect(tabIndexOf('a')).toBe('0');
    expect(document.activeElement).toBe(screen.getByTestId('i-a'));
  });

  it('clamps at the ends rather than wrapping', () => {
    render(<Tree keys={['a', 'b']} />);
    const a = screen.getByTestId('i-a');
    act(() => a.focus());
    fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(tabIndexOf('a')).toBe('0'); // already first, stays put
  });

  it('jumps to first / last with Home / End', () => {
    render(<Tree keys={['a', 'b', 'c']} />);
    const a = screen.getByTestId('i-a');
    act(() => a.focus());
    fireEvent.keyDown(a, { key: 'End' });
    expect(tabIndexOf('c')).toBe('0');
    fireEvent.keyDown(screen.getByTestId('i-c'), { key: 'Home' });
    expect(tabIndexOf('a')).toBe('0');
  });

  it('does not intercept Tab (composite widget, not a focus trap)', () => {
    render(<Tree keys={['a', 'b']} />);
    const a = screen.getByTestId('i-a');
    act(() => a.focus());
    const ev = fireEvent.keyDown(a, { key: 'Tab' });
    // fireEvent returns false when preventDefault was called; true means it wasn't.
    expect(ev).toBe(true);
  });

  it('falls back to the first remaining item when the active one unregisters', () => {
    const { rerender } = render(<Tree keys={['a', 'b', 'c']} />);
    act(() => screen.getByTestId('i-b').focus());
    fireEvent.keyDown(screen.getByTestId('i-a'), { key: 'ArrowRight' }); // active = b
    expect(tabIndexOf('b')).toBe('0');

    // The candidate set changes and 'b' disappears.
    rerender(<Tree keys={['a', 'c']} />);
    expect(tabIndexOf('a')).toBe('0');
    expect(tabIndexOf('c')).toBe('-1');
  });
});
