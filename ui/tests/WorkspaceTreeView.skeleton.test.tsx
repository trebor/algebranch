// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { WorkspaceTreeView } from '@/components/WorkspaceTreeView';
import { appHydratedAtom } from '@/store/equation';

function makeStore(hydrated: boolean): ReturnType<typeof createStore> {
  const store = createStore();
  store.set(appHydratedAtom, hydrated);
  return store;
}

describe('WorkspaceTreeView skeleton state when !appHydrated', () => {
  afterEach(cleanup);

  it('renders disabled zoom buttons and pulsing skeleton when appHydrated is false', () => {
    render(
      <Provider store={makeStore(false)}>
        <WorkspaceTreeView interactive scrollActiveIntoView={false} />
      </Provider>,
    );
    
    // Zoom buttons should be disabled
    const zoomIn = screen.getByRole('button', { name: /zoom: normal/i });
    const zoomOut = screen.getByRole('button', { name: /zoom: full tree/i });
    const overview = screen.getByRole('button', { name: /zoom: overview/i });
    
    expect(zoomIn).toBeDisabled();
    expect(zoomOut).toBeDisabled();
    expect(overview).toBeDisabled();

    // Renders the skeleton and not the actual treeitems
    expect(screen.queryByRole('treeitem')).toBeNull();
  });
});
