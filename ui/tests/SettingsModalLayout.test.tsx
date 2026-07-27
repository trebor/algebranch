// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { SettingsModal } from '@/components/SettingsModal';
import {
  settingsModalOpenAtom,
  rawSettingsAtom,
  DEFAULT_SETTINGS,
} from '@/store/equation';

function renderModal() {
  const store = createStore();
  store.set(settingsModalOpenAtom, true);
  store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS });
  const result = render(
    <Provider store={store}>
      <SettingsModal />
    </Provider>,
  );
  return { store, ...result };
}

describe('SettingsModal — layout organization and cleanup', () => {
  afterEach(cleanup);

  it('orders content top-to-bottom: Classroom Settings, Display & Motion, Privacy & Cookies', () => {
    renderModal();

    const classroomHeading = screen.getByText(/classroom settings/i);
    const textScaleHeading = screen.getByText(/interface text size/i);
    const privacyHeading = screen.getByText(/privacy & cookies/i);

    expect(classroomHeading).toBeTruthy();
    expect(textScaleHeading).toBeTruthy();
    expect(privacyHeading).toBeTruthy();

    // Verify DOM order using compareDocumentPosition
    const classroomPos = classroomHeading.compareDocumentPosition(textScaleHeading);
    const privacyPos = textScaleHeading.compareDocumentPosition(privacyHeading);

    // Node.DOCUMENT_POSITION_FOLLOWING is 4
    expect(classroomPos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(privacyPos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('removes redundant launcher buttons for Help, Shortcuts, Workspaces, and About', () => {
    renderModal();

    // Help, Shortcuts, Export Workspaces, Import Workspaces, About Algebranch should no longer be present in Settings
    expect(screen.queryByRole('button', { name: /view/i })).toBeNull(); // Shortcuts button
    expect(screen.queryByRole('button', { name: /open/i })).toBeNull(); // Help button
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull(); // Workspaces export
    expect(screen.queryByRole('button', { name: /import/i })).toBeNull(); // Workspaces import
    expect(screen.queryByRole('button', { name: /about algebranch/i })).toBeNull(); // Footer about button
  });
});
