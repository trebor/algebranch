// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { CopyFormatMenu } from '@/components/CopyFormatMenu';
import { equationToFormat, toastAtom } from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

const eq = parseEquation('x^2-9=0');

describe('CopyFormatMenu', () => {
  let writeText: ReturnType<typeof mockClipboard>;

  beforeEach(() => {
    writeText = mockClipboard();
  });
  afterEach(cleanup);

  const renderMenu = (props: Partial<React.ComponentProps<typeof CopyFormatMenu>> = {}) =>
    render(
      <CopyFormatMenu
        getText={(format) => equationToFormat(eq, format)}
        variant="panel"
        trackAction="copy_step"
        trackCategory="history"
        trackLabel="node-1"
        scopeLabel="This step"
        scopeEquation={eq}
        {...props}
      />,
    );

  it('primary click copies the Unicode default in one gesture, no menu', async () => {
    renderMenu();
    // The primary copy button is distinct from the caret.
    await userEvent.click(screen.getByRole('button', { name: /^copy equation$/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(equationToFormat(eq, 'unicode')),
    );
    // A primary copy must NOT open the format menu.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('the caret reveals the three-format menu', async () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /plain text/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /unicode/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /latex/i })).toBeInTheDocument();
  });

  it('renders an icon alongside each format label', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    const menu = screen.getByRole('menu');
    for (const name of [/plain text/i, /unicode/i, /latex/i]) {
      const item = within(menu).getByRole('menuitem', { name });
      expect(item.querySelector('svg')).not.toBeNull();
    }
  });

  it('selecting a format row copies that format', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /latex/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(equationToFormat(eq, 'latex')),
    );
    // Menu closes after a selection.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows a toast confirming the copy when a format is selected', async () => {
    const store = getDefaultStore();
    store.set(toastAtom, null);
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /latex/i }));

    await waitFor(() => expect(store.get(toastAtom)?.message).toMatch(/latex/i));
  });

  it('the one-click primary copy also confirms with a toast', async () => {
    const store = getDefaultStore();
    store.set(toastAtom, null);
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /^copy equation$/i }));

    await waitFor(() => expect(store.get(toastAtom)?.message).toBeTruthy());
  });

  it('Escape closes an open menu', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders the typeset equation preview in the menu header (not a flat string)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    const menu = screen.getByRole('menu');

    // The eyebrow label is present...
    expect(within(menu).getByText('This step')).toBeInTheDocument();
    // ...and the typeset preview rendered the variable as its own element, rather
    // than echoing the whole equation as one flat unicode string.
    expect(within(menu).queryByText(equationToFormat(eq, 'unicode'))).toBeNull();
    expect(within(menu).getByText('x')).toBeInTheDocument();
  });

  it('primary click stops propagation when asked (per-step card is clickable)', async () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <CopyFormatMenu
          getText={(format) => equationToFormat(eq, format)}
          variant="tree"
          trackAction="copy_step"
          trackCategory="history"
          trackLabel="node-1"
          scopeLabel="This step"
          scopeEquation={eq}
          stopPropagation
        />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: /^copy equation$/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('renders the menu inside a portal as a child of document.body', async () => {
    render(
      <CopyFormatMenu
        getText={(format) => equationToFormat(eq, format)}
        variant="tree"
        trackAction="copy_step"
        trackCategory="history"
        trackLabel="node-1"
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(menu.parentElement).toBe(document.body);
  });

  it('is text-only by default, and gains a scoped export entry when exportScope is set (#130)', async () => {
    const { rerender } = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    // Always the three text formats.
    expect(screen.getByRole('menuitem', { name: /plain text/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /unicode/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /latex/i })).toBeInTheDocument();
    // No export entry without a scope.
    expect(screen.queryByRole('menuitem', { name: /save as image|export image/i })).toBeNull();

    await userEvent.keyboard('{Escape}');
    rerender(
      <CopyFormatMenu
        getText={(format) => equationToFormat(eq, format)}
        variant="panel"
        trackAction="copy_step"
        trackCategory="history"
        trackLabel="node-1"
        exportScope="equation"
        exportEquation={eq}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /export image or pdf/i }));

    // The pre-scoped export dialog opens; the format menu closes.
    expect(await screen.findByRole('dialog', { name: /export equation/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onOpenChange when opening and closing the menu', async () => {
    const onOpenChange = vi.fn();
    render(
      <CopyFormatMenu
        getText={(format) => equationToFormat(eq, format)}
        variant="tree"
        trackAction="copy_step"
        trackCategory="history"
        trackLabel="node-1"
        onOpenChange={onOpenChange}
      />
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Open menu
    await userEvent.click(screen.getByRole('button', { name: /copy format options/i }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    // Close menu via Escape
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
