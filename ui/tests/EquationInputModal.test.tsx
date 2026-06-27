// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationInputModal } from '@/components/EquationInputModal';
import {
  equationInputModalOpenAtom,
  equationEditSeedAtom,
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

const pristineTab: WorkspaceTab = {
  id: 'a',
  name: 'x = 0',
  historyTree: {
    '0': { id: '0', equation: parseEquation('x=0'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  },
  currentNodeId: '0',
  timestamp: 1,
};

const tabWithHistory: WorkspaceTab = {
  id: 'a',
  name: '3 * x = 9',
  historyTree: {
    '0': { id: '0', equation: parseEquation('3*x=9'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
    '1': { id: '1', equation: parseEquation('x=3'), parentId: '0', childrenIds: [], label: 'Divide', timestamp: 2 },
  },
  currentNodeId: '1',
  timestamp: 1,
};

describe('EquationInputModal', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the relation operator select dropdown when open', () => {
    const store = createStore();
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const select = screen.getByRole('combobox', { name: /relation operator/i }) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('=');
  });

  it('renders the chevron down handle inside the wrapper and does not render a pulsing badge', () => {
    const store = createStore();
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const select = screen.getByRole('combobox', { name: /relation operator/i });
    const wrapper = select.parentElement;
    expect(wrapper).toBeTruthy();

    // Assert the chevron SVG icon is present in the wrapper
    const svg = wrapper!.querySelector('svg');
    expect(svg).toBeTruthy();

    // Assert there is no pulsing badge (no .animate-pulse element inside the wrapper)
    const badge = wrapper!.querySelector('.animate-pulse');
    expect(badge).toBeNull();
  });

  it('prefills both sides and the relation from an edit seed (#261)', () => {
    const store = createStore();
    store.set(equationEditSeedAtom, { lhs: '3 * x + 2', relation: '=', rhs: '8' });
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const lhs = screen.getByPlaceholderText(/left side/i) as HTMLInputElement;
    const rhs = screen.getByPlaceholderText(/right side/i) as HTMLInputElement;
    expect(lhs.value).toBe('3 * x + 2');
    expect(rhs.value).toBe('8');
  });

  it('labels the submit button "Update Equation" when editing a pristine workspace (#261)', () => {
    const store = createStore();
    store.set(rawTabsAtom, [pristineTab]);
    store.set(rawActiveTabIdAtom, 'a');
    store.set(equationEditSeedAtom, { lhs: 'x', relation: '=', rhs: '0' });
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    expect(screen.getByRole('button', { name: /update equation/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /new workspace/i })).toBeNull();
  });

  it('labels the submit button to signal a new workspace when the workspace has history (#261)', () => {
    const store = createStore();
    store.set(rawTabsAtom, [tabWithHistory]);
    store.set(rawActiveTabIdAtom, 'a');
    store.set(equationEditSeedAtom, { lhs: 'x', relation: '=', rhs: '3' });
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    expect(screen.getByRole('button', { name: /new workspace/i })).toBeTruthy();
  });

  it('prefills the Workspace Title input field from an edit seed when specified', () => {
    const store = createStore();
    store.set(equationEditSeedAtom, { lhs: 'x', relation: '=', rhs: '3', title: 'Custom Title' });
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const titleInput = screen.getByLabelText(/workspace title/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Custom Title');
  });

  it('updates the Workspace Title placeholder dynamically as the user types the equation', () => {
    const store = createStore();
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const titleInput = screen.getByLabelText(/workspace title/i) as HTMLInputElement;
    expect(titleInput.placeholder).toBe('e.g. Quadratic Formula (optional)');

    const lhs = screen.getByPlaceholderText(/left side/i) as HTMLInputElement;
    fireEvent.change(lhs, { target: { value: '3 * y' } });

    expect(titleInput.placeholder).toBe('3 * y = ...');
  });

  it('moves focus to the RHS input when relation operator dropdown is focused and equals key is pressed', () => {
    const store = createStore();
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const select = screen.getByRole('combobox', { name: /relation operator/i }) as HTMLSelectElement;
    const rhs = screen.getByPlaceholderText(/right side/i) as HTMLInputElement;

    select.focus();
    fireEvent.keyDown(select, { key: '=' });

    expect(document.activeElement).toBe(rhs);
  });
});
