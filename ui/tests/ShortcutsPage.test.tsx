// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The /shortcuts reference page (#514) renders the shared SHORTCUT_CATALOG as an
// on-domain, zero-hydration page. These tests confirm it documents the same
// bindings the app dispatches — visible rows present, hidden aliases suppressed,
// leader chords shown as two keycaps — so the crawlable page and the app agree.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ShortcutsPage from '@/app/shortcuts/page';
import { SHORTCUT_CATALOG } from '@/constants/shortcutCatalog';

// The page's shared "Back to Workspace" affordance (#514) calls useRouter for its
// Escape-to-workspace handler; stub it so the page renders without an App Router
// context. Its own behavior is covered in BackToWorkspaceLink.test.tsx.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('ShortcutsPage (#514)', () => {
  afterEach(cleanup);

  it('renders every visible shortcut description from the catalog', () => {
    render(<ShortcutsPage />);
    for (const entry of SHORTCUT_CATALOG) {
      if (entry.hidden) continue;
      // Some descriptions repeat across surfaces; getAllByText tolerates dupes.
      expect(screen.getAllByText(entry.description).length, entry.id).toBeGreaterThan(0);
    }
  });

  it('shows the neutral Ctrl/Cmd keycap for modifier shortcuts', () => {
    render(<ShortcutsPage />);
    const keycaps = Array.from(document.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keycaps).toContain('Ctrl/Cmd + Z'); // Undo
  });

  it('renders leader chords (C then E) as two keycaps', () => {
    render(<ShortcutsPage />);
    const keycaps = Array.from(document.querySelectorAll('kbd')).map((k) => k.textContent);
    // The `C` leader appears, and each chord's second key (E / D / W) too.
    expect(keycaps).toContain('C');
    expect(keycaps).toContain('E');
    expect(screen.getAllByText('then').length).toBeGreaterThan(0);
  });

  it('uses keyLabel glyphs (?, =) rather than the Shift-decorated combo', () => {
    render(<ShortcutsPage />);
    const keycaps = Array.from(document.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keycaps).toContain('?');
    expect(keycaps).toContain('=');
    // The `?` binding is Shift+`/` internally; the page must not leak that.
    expect(keycaps).not.toContain('Shift + /');
  });
});
