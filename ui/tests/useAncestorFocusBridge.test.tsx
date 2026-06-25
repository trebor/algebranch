// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useAncestorFocusBridge } from '@/hooks/useAncestorFocusBridge';
import { navReadoutAtom } from '@/store/equation';

// A minimal nested-treeitem tree mirroring the Interaction widget's shape: an outer
// term treeitem whose group holds an inner term and a (button) handle, plus a
// top-level sibling term.
function Tree() {
  const onFocusCapture = useAncestorFocusBridge();
  return (
    <div role="tree" aria-label="t" tabIndex={-1} onFocusCapture={onFocusCapture}>
      <div role="treeitem" aria-selected={false} aria-label="x minus 3, Enter to select" tabIndex={0} data-testid="outer">
        <div role="group">
          <div role="treeitem" aria-selected={false} aria-label="x" tabIndex={0} data-testid="inner" />
          <button type="button" aria-label="Simplify" tabIndex={0} data-testid="handle" />
        </div>
      </div>
      <div role="treeitem" aria-selected={false} aria-label="7" tabIndex={0} data-testid="sibling" />
    </div>
  );
}

const readout = (store: ReturnType<typeof createStore>) =>
  store.get(navReadoutAtom).replace(/\u200B/g, '');

describe('useAncestorFocusBridge (#270/#271)', () => {
  afterEach(cleanup);

  function setup() {
    const store = createStore();
    render(
      <Provider store={store}>
        <Tree />
      </Provider>,
    );
    return store;
  }

  it('announces the enclosing term when focus moves UP to a containing ancestor', () => {
    const store = setup();
    act(() => screen.getByTestId('inner').focus());
    expect(readout(store)).toBe('');
    act(() => screen.getByTestId('outer').focus());
    expect(readout(store)).toBe('x minus 3, Enter to select');
  });

  it('announces the host term when focus returns from its handle (the #271 case)', () => {
    const store = setup();
    act(() => screen.getByTestId('handle').focus());
    act(() => screen.getByTestId('outer').focus());
    expect(readout(store)).toBe('x minus 3, Enter to select');
  });

  it('stays silent moving to a sibling (no containment)', () => {
    const store = setup();
    act(() => screen.getByTestId('inner').focus());
    act(() => screen.getByTestId('sibling').focus());
    expect(readout(store)).toBe('');
  });

  it('stays silent moving DOWN to a descendant', () => {
    const store = setup();
    act(() => screen.getByTestId('outer').focus());
    act(() => screen.getByTestId('inner').focus());
    expect(readout(store)).toBe('');
  });

  it('re-announces (marker alternates) when the same ancestor is re-entered', () => {
    const store = setup();
    act(() => screen.getByTestId('inner').focus());
    act(() => screen.getByTestId('outer').focus());
    const first = store.get(navReadoutAtom);
    act(() => screen.getByTestId('inner').focus());
    act(() => screen.getByTestId('outer').focus());
    const second = store.get(navReadoutAtom);
    expect(readout(store)).toBe('x minus 3, Enter to select');
    expect(second).not.toBe(first); // invisible marker flipped → live region re-fires
  });
});
