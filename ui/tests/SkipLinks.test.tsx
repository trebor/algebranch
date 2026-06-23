// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { SkipLinks } from '@/components/SkipLinks';

// Skip links are a keyboard "fast lane" (#257, PR A): visually hidden until
// focused, they let a keyboard-only user jump straight to the region they want
// instead of tabbing through the chrome. The targets stand in for the real
// landmark regions wired up in page.tsx.
function renderWithTargets() {
  const store = createStore();
  return render(
    <Provider store={store}>
      <SkipLinks />
      <div id="equation-region" tabIndex={-1}>equation</div>
      <div id="history-region" tabIndex={-1}>history</div>
    </Provider>,
  );
}

describe('SkipLinks', () => {
  afterEach(cleanup);

  it('links to the equation and history regions by fragment id', () => {
    renderWithTargets();
    expect(screen.getByRole('link', { name: /skip to equation/i })).toHaveAttribute('href', '#equation-region');
    expect(screen.getByRole('link', { name: /skip to history/i })).toHaveAttribute('href', '#history-region');
  });

  it('moves focus to the equation region when its skip link is activated', () => {
    renderWithTargets();
    fireEvent.click(screen.getByRole('link', { name: /skip to equation/i }));
    expect(document.getElementById('equation-region')).toHaveFocus();
  });

  it('moves focus to the history region when its skip link is activated', () => {
    renderWithTargets();
    fireEvent.click(screen.getByRole('link', { name: /skip to history/i }));
    expect(document.getElementById('history-region')).toHaveFocus();
  });

  it('keeps skip links out of the visual flow until focused', () => {
    renderWithTargets();
    expect(screen.getByRole('link', { name: /skip to equation/i }).className).toContain('sr-only');
  });
});
