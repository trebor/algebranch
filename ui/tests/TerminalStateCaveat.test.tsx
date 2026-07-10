// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { undefinedPathsAtom, terminalStatusAtom } from '../src/store/equation';
import { TerminalStateCaveat } from '../src/components/TerminalStateCaveat';

const renderWith = (
  opts: {
    undefined?: boolean;
    status?: 'contradiction' | 'identity' | null;
  } = {},
) => {
  const store = createStore();
  if (opts.undefined) store.set(undefinedPathsAtom, [{ path: 'lhs', reason: 'division-by-zero' }]);
  store.set(terminalStatusAtom, opts.status ?? null);
  return render(
    <Provider store={store}>
      <TerminalStateCaveat />
    </Provider>,
  );
};

describe('TerminalStateCaveat (#487) — the single standing halt banner', () => {
  test('renders nothing on a non-terminal state', () => {
    const { container } = renderWith();
    expect(container).toBeEmptyDOMElement();
  });

  test('contradiction states "no solution" as a reached conclusion', () => {
    renderWith({ status: 'contradiction' });
    const note = screen.getByRole('note');
    expect(note.textContent ?? '').toMatch(/no solution/i);
    expect(note.textContent ?? '').toMatch(/reached a conclusion/i);
  });

  test('identity states "always true" as a reached conclusion', () => {
    renderWith({ status: 'identity' });
    const note = screen.getByRole('note');
    expect(note.textContent ?? '').toMatch(/always true/i);
    expect(note.textContent ?? '').toMatch(/reached a conclusion/i);
  });

  test('÷0 states a dead end and points back to undo', () => {
    renderWith({ undefined: true });
    const note = screen.getByRole('note');
    expect(note.textContent ?? '').toMatch(/divides by zero/i);
    expect(note.textContent ?? '').toMatch(/undo/i);
  });

  test('only one halt banner ever renders — ÷0 wins over a stale terminalStatus', () => {
    // The two channels should never both be set, but if they were the ÷0 dead end
    // takes priority (mirrors the engine), and there is still exactly one note.
    renderWith({ undefined: true, status: 'identity' });
    const notes = screen.getAllByRole('note');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent ?? '').toMatch(/divides by zero/i);
  });
});
