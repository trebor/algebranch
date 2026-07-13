// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import {
  RovingTabindexProvider,
  useRovingItem,
  nearestAncestorKey,
  nearestDescendantKey,
  nearestRegisteredKey,
} from '@/hooks/useRovingTabindex';

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

  it('with preferSpecificDefault, defaults to the most specific primary, not a whole-side ancestor (#373)', () => {
    // Path keys: a whole-side node ('lhs') that is a candidate AND wraps two inner
    // candidates. The default cursor must land on the first inner term, not the
    // entire side — otherwise returning to Interaction highlights the whole side.
    render(
      <RovingTabindexProvider preferSpecificDefault>
        <div>
          {['lhs', 'lhs/0', 'lhs/1', 'rhs'].map((k) => (
            <Item key={k} k={k} />
          ))}
        </div>
      </RovingTabindexProvider>,
    );
    expect(tabIndexOf('lhs/0')).toBe('0');
    expect(tabIndexOf('lhs')).toBe('-1');
  });

  it('with preferSpecificDefault, keeps an ancestor as default when nothing more specific is registered', () => {
    // Only the whole side is actionable (no inner candidate) — then it is a fine
    // default; the skip rule must not strand the cursor.
    render(
      <RovingTabindexProvider preferSpecificDefault>
        <div>
          {['lhs', 'rhs'].map((k) => (
            <Item key={k} k={k} />
          ))}
        </div>
      </RovingTabindexProvider>,
    );
    expect(tabIndexOf('lhs')).toBe('0');
  });

  it('without preferSpecificDefault, keeps the first primary (whole-side overview) as default (#270)', () => {
    // The reader relies on this: entry announces the whole expression, not an
    // inner term, so the skip rule must stay opt-in.
    render(<Tree keys={['lhs', 'lhs/0', 'lhs/1', 'rhs']} />);
    expect(tabIndexOf('lhs')).toBe('0');
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

// The path-prefix resolvers shared by the ArrowUp/ArrowDown roving handlers and
// the cross-mode cursor carry-over (#373). Keys are AST paths ('0/1/2' = left
// side → child 1 → child 2); ancestor = longer-lived enclosing term, descendant
// = a term nested inside the path.
describe('nearestAncestorKey', () => {
  it('returns the closest (longest-prefix) registered ancestor', () => {
    const keys = ['0', '0/1', '1'];
    expect(nearestAncestorKey(keys, '0/1/2')).toBe('0/1');
  });

  it('does not treat the path itself as its own ancestor', () => {
    expect(nearestAncestorKey(['0/1'], '0/1')).toBeNull();
  });

  it('returns null when no ancestor is registered', () => {
    expect(nearestAncestorKey(['1', '1/0'], '0/1')).toBeNull();
  });
});

describe('nearestDescendantKey', () => {
  it('returns the shallowest (fewest-segment) registered descendant', () => {
    const keys = ['0/1/2/3', '0/1/2', '0/1'];
    expect(nearestDescendantKey(keys, '0')).toBe('0/1');
  });

  it('breaks depth ties by input (document) order', () => {
    const keys = ['0/1', '0/2'];
    expect(nearestDescendantKey(keys, '0')).toBe('0/1');
  });

  it('does not treat the path itself as its own descendant', () => {
    expect(nearestDescendantKey(['0/1'], '0/1')).toBeNull();
  });

  it('returns null when no descendant is registered', () => {
    expect(nearestDescendantKey(['1', '1/0'], '0')).toBeNull();
  });
});

describe('nearestRegisteredKey', () => {
  it('returns the exact path when it is registered', () => {
    expect(nearestRegisteredKey(['0', '0/1', '0/1/2'], '0/1')).toBe('0/1');
  });

  it('falls back to the nearest ancestor when the path is absent', () => {
    expect(nearestRegisteredKey(['0', '0/1'], '0/1/2')).toBe('0/1');
  });

  it('prefers the closer of an ancestor and a descendant', () => {
    // path '0/1' absent; ancestor '0' is 1 level up, descendant '0/1/2/3' is 2
    // down — the closer ancestor wins.
    expect(nearestRegisteredKey(['0', '0/1/2/3'], '0/1')).toBe('0');
  });

  it('favors the descendant on a tie — the transparent-wrapper case (#373)', () => {
    // path '0/1' absent; ancestor '0' and descendant '0/1/2' are both 1 level away.
    // The descendant is the same-or-inner content (e.g. a paren's child), so it
    // wins over the broader enclosing side.
    expect(nearestRegisteredKey(['0', '0/1/2'], '0/1')).toBe('0/1/2');
    // Mirrors the real bug: carried paren `lhs/0` → reader has `lhs` and the paren
    // content `lhs/0/0`; the content must win, not the whole side.
    expect(nearestRegisteredKey(['lhs', 'lhs/0/0'], 'lhs/0')).toBe('lhs/0/0');
  });

  it('falls back to a descendant when no ancestor is registered', () => {
    expect(nearestRegisteredKey(['0/1/2'], '0/1')).toBe('0/1/2');
  });

  it('returns null when nothing is near the path', () => {
    expect(nearestRegisteredKey(['1', '1/0'], '0/2')).toBeNull();
  });
});

// #373: a freshly-mounted provider (the incoming mode's tree) seeds its cursor
// from a carried path rather than always resetting to the first item.
function SeededTree({
  keys,
  seedKey,
  seedFocus,
}: {
  keys: string[];
  seedKey?: string | null;
  seedFocus?: boolean;
}) {
  return (
    <RovingTabindexProvider seedKey={seedKey} seedFocus={seedFocus}>
      <div>
        {keys.map((k) => (
          <Item key={k} k={k} />
        ))}
      </div>
    </RovingTabindexProvider>
  );
}

describe('RovingTabindexProvider carry-over seeding (#373)', () => {
  it('seeds the cursor at the carried path when it is registered', () => {
    render(<SeededTree keys={['0', '0/1', '0/1/2']} seedKey="0/1" />);
    expect(tabIndexOf('0/1')).toBe('0');
    expect(tabIndexOf('0')).toBe('-1');
  });

  it('seeds at the nearest ancestor when the carried path is not registered', () => {
    render(<SeededTree keys={['0', '0/1']} seedKey="0/1/2" />);
    expect(tabIndexOf('0/1')).toBe('0');
  });

  it('falls back to the default item when no key is near the carried path', () => {
    // Sibling keys (no ancestor nesting) so the fallback is unambiguously the
    // first, isolating carry-over fallback from the most-specific-default rule.
    render(<SeededTree keys={['a', 'b']} seedKey="z" />);
    expect(tabIndexOf('a')).toBe('0');
  });

  it('moves DOM focus to the seeded node only when seedFocus is set', () => {
    const { unmount } = render(<SeededTree keys={['0', '0/1']} seedKey="0/1" seedFocus />);
    expect(screen.getByTestId('i-0/1')).toBe(document.activeElement);
    unmount();
    render(<SeededTree keys={['0', '0/1']} seedKey="0/1" />);
    expect(screen.getByTestId('i-0/1')).not.toBe(document.activeElement);
  });

  it('keeps the carried seed under a double-invoked effect (StrictMode replay) (#373)', () => {
    // The reader-mode regression: React StrictMode runs the validation effect
    // twice with the same activeKey=null closure. A consumed-once flag would flip
    // on the first run and let the replay fall through to the whole-side default;
    // the resolution must be idempotent so the carried key survives.
    render(
      <React.StrictMode>
        <SeededTree keys={['lhs', 'lhs/0', 'lhs/1', 'rhs']} seedKey="lhs/1" />
      </React.StrictMode>,
    );
    expect(tabIndexOf('lhs/1')).toBe('0');
    expect(tabIndexOf('lhs')).toBe('-1');
  });

  it('reports active-key changes through onActiveKeyChange', () => {
    const seen: (string | null)[] = [];
    render(
      <RovingTabindexProvider onActiveKeyChange={(k) => seen.push(k)}>
        <div>
          <Item k="0" />
          <Item k="0/1" />
        </div>
      </RovingTabindexProvider>,
    );
    act(() => screen.getByTestId('i-0').focus());
    fireEvent.keyDown(screen.getByTestId('i-0'), { key: 'ArrowRight' });
    expect(seen).toContain('0/1');
  });
});
