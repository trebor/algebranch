// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Provider, createStore } from 'jotai';
import { ExploreEquationTree } from '@/components/ExploreEquationTree';
import { rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab } from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// Seeds a single-tab store whose active workspace holds `eqText`, so the live
// currentEquationAtom resolves and the read view can walk it.
function makeStore(eqText: string) {
  const store = createStore();
  const eq = parseEquation(eqText);
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: eq, parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

function renderExplore(store: ReturnType<typeof createStore>, onExit = () => {}) {
  return render(
    <Provider store={store}>
      <ExploreEquationTree onExit={onExit} />
    </Provider>,
  );
}

// Read view narrates the active stop through an assertive live region (not ARIA
// tree/focus semantics, which VoiceOver won't re-announce when backing OUT to a
// containing parent). This reads the live region's current text, stripping the
// invisible re-announce marker.
const liveText = (): string | null =>
  document.querySelector('[aria-live="assertive"]')?.textContent?.replace(/\u200B/g, '') ?? null;

describe('Read view — live-region structural reading (#270)', () => {
  afterEach(cleanup);

  it('is a single Tab stop (the reader) with no treeitem/button chrome', () => {
    const store = makeStore('x^2-9=0');
    renderExplore(store);

    const app = screen.getByRole('application', { name: /equation reader/i });
    expect(app).toHaveAttribute('tabindex', '0');
    // No tree/treeitem roles (no "outline row" chatter) and no action handles/verbs.
    expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/Enter to/i)).toBeNull();
  });

  it('narrates the first stop (the whole left side) on entry', () => {
    const store = makeStore('x^2-9=0');
    renderExplore(store);
    expect(liveText()).toBe('x squared minus 9');
  });

  it('walks every stop depth-first with Left/Right, never getting stuck', () => {
    const store = makeStore('x^2-9=0');
    renderExplore(store);
    const app = screen.getByRole('application');
    act(() => app.focus());

    const order = ['x squared minus 9', 'x squared', 'x', '2', '9', '0'];
    for (let i = 1; i < order.length; i++) {
      fireEvent.keyDown(app, { key: 'ArrowRight' });
      expect(liveText()).toBe(order[i]);
    }
    // Right at the last stop clamps (no wrap).
    fireEvent.keyDown(app, { key: 'ArrowRight' });
    expect(liveText()).toBe('0');

    // Left walks back and clamps at the first stop.
    for (let i = order.length - 2; i >= 0; i--) {
      fireEvent.keyDown(app, { key: 'ArrowLeft' });
      expect(liveText()).toBe(order[i]);
    }
    fireEvent.keyDown(app, { key: 'ArrowLeft' });
    expect(liveText()).toBe('x squared minus 9');
  });

  it('re-narrates the enclosing term on the way UP (the core fix)', () => {
    // The reported bug: drilling in narrates each part, but arrowing back OUT failed
    // to re-announce the parent. The live region speaks whatever stop the cursor
    // lands on, every move — so Up to the enclosing term narrates it.
    const store = makeStore('x-3=7');
    renderExplore(store);
    const app = screen.getByRole('application');
    act(() => app.focus());

    expect(liveText()).toBe('x minus 3');
    fireEvent.keyDown(app, { key: 'ArrowDown' }); // into the first part: x
    expect(liveText()).toBe('x');
    fireEvent.keyDown(app, { key: 'ArrowRight' }); // its sibling: 3
    expect(liveText()).toBe('3');
    fireEvent.keyDown(app, { key: 'ArrowUp' }); // back OUT to the enclosing term
    expect(liveText()).toBe('x minus 3');
  });

  it('re-announces even when two consecutive stops have identical speech', () => {
    // x · x: drilling in gives "x" then its sibling "x". The live region must still
    // register a change so VoiceOver re-speaks it (invisible marker alternation).
    const store = makeStore('x*x=4');
    renderExplore(store);
    const app = screen.getByRole('application');
    act(() => app.focus());

    fireEvent.keyDown(app, { key: 'ArrowDown' }); // first x
    const first = document.querySelector('[aria-live="assertive"]')?.textContent;
    expect(liveText()).toBe('x');
    fireEvent.keyDown(app, { key: 'ArrowRight' }); // second x
    const second = document.querySelector('[aria-live="assertive"]')?.textContent;
    expect(liveText()).toBe('x');
    // Raw text differs (marker alternates) so the live region fires again.
    expect(second).not.toBe(first);
  });

  it('offers Up/Down as level accelerators (out to the enclosing term / into the first part)', () => {
    const store = makeStore('x^2-9=0');
    renderExplore(store);
    const app = screen.getByRole('application');
    act(() => app.focus());

    fireEvent.keyDown(app, { key: 'ArrowDown' });
    expect(liveText()).toBe('x squared');
    fireEvent.keyDown(app, { key: 'ArrowDown' });
    expect(liveText()).toBe('x');

    fireEvent.keyDown(app, { key: 'ArrowUp' });
    expect(liveText()).toBe('x squared');
    fireEvent.keyDown(app, { key: 'ArrowUp' });
    expect(liveText()).toBe('x squared minus 9');
  });

  it('treats parentheses as transparent — Down drills straight to the content', () => {
    const store = makeStore('(x+3)/2=5');
    renderExplore(store);
    const app = screen.getByRole('application');
    act(() => app.focus());
    fireEvent.keyDown(app, { key: 'ArrowDown' });
    expect(liveText()).toBe('x plus 3');
  });

  it('Escape exits the read view', () => {
    const onExit = vi.fn();
    const store = makeStore('x^2-9=0');
    renderExplore(store, onExit);
    const app = screen.getByRole('application');
    act(() => app.focus());
    fireEvent.keyDown(app, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('has no structural a11y violations', async () => {
    const store = makeStore('x^2-9=0');
    const { container } = renderExplore(store);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Read view — flatten associative operator chains (#290)', () => {
  afterEach(cleanup);

  // Walk Home→End and collect the spoken stop at each cursor position.
  const walk = (eqText: string): string[] => {
    const store = makeStore(eqText);
    renderExplore(store);
    const app = screen.getByRole('application');
    act(() => app.focus());
    fireEvent.keyDown(app, { key: 'Home' });
    const stops = [liveText()];
    for (;;) {
      const prev = liveText();
      fireEvent.keyDown(app, { key: 'ArrowRight' });
      const next = liveText();
      if (next === prev) break; // clamped at End
      stops.push(next);
    }
    return stops as string[];
  };

  it('reads a sum chain as flat siblings — no synthetic "a plus b" middle stop', () => {
    // a+b+c parses to +[+[a,b],c]; the inner + is a parser artifact, not a stop.
    expect(walk('a+b+c=0')).toEqual(['a plus b plus c', 'a', 'b', 'c', '0']);
  });

  it('reads a product chain as flat factors — no synthetic "x times y" middle stop', () => {
    expect(walk('x*y*z=0')).toEqual(['x times y times z', 'x', 'y', 'z', '0']);
  });

  it('flattens a longer chain fully', () => {
    expect(walk('a+b+c+d=0')).toEqual(['a plus b plus c plus d', 'a', 'b', 'c', 'd', '0']);
  });

  it('keeps a non-associative subtraction chain grouped (must NOT flatten)', () => {
    // a-b-c = -[-[a,b],c]; the (a-b) subterm stays its own stop.
    expect(walk('a-b-c=0')).toEqual(['a minus b minus c', 'a minus b', 'a', 'b', 'c', '0']);
  });

  it('flattens a REDUNDANT same-operator paren (parseEquation strips it — it is one flat sum)', () => {
    // a+(b+c): the parens don't change meaning for an associative op, so
    // parseEquation removes them and the chain flattens like any other sum.
    expect(walk('a+(b+c)=0')).toEqual(['a plus b plus c', 'a', 'b', 'c', '0']);
  });

  it('keeps a MEANINGFUL paren as its own stop (grouping that changes meaning survives)', () => {
    // a*(b+c): the paren matters (it gates distribution), so parseEquation keeps
    // the ParenthesisNode and the inner sum stays a navigable stop.
    expect(walk('a*(b+c)=0')).toEqual(['a times the quantity b plus c', 'a', 'b plus c', 'b', 'c', '0']);
  });

  it('Down from the sum drills straight to the first term, Up returns to the sum', () => {
    const store = makeStore('a+b+c=0');
    renderExplore(store);
    const app = screen.getByRole('application');
    act(() => app.focus());
    expect(liveText()).toBe('a plus b plus c');
    fireEvent.keyDown(app, { key: 'ArrowDown' }); // into the first term (no middle stop)
    expect(liveText()).toBe('a');
    fireEvent.keyDown(app, { key: 'ArrowRight' });
    expect(liveText()).toBe('b');
    fireEvent.keyDown(app, { key: 'ArrowUp' }); // back out to the whole sum, not "a plus b"
    expect(liveText()).toBe('a plus b plus c');
  });
});
