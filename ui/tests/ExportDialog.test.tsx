// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The Export dialog (#130) is opened *pre-scoped* from the Copy control that owns
// it — there is no scope switch. These tests pin the per-scope surface: the
// derivation scope carries the explanations toggle + Print, the equation scope
// carries Copy image, both share the White/Black/Transparent background parity
// (#335), and Save captures a PNG on the chosen background.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseEquation } from 'math-engine-client';
import type { DerivationStep } from '@/store/equation';

// Capture is a thin html-to-image wrapper that can't run under jsdom — mock just
// that function while keeping the pure colour/filename helpers real.
const captureNodeToPng = vi.fn();
vi.mock('@/utils/equationImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/equationImage')>();
  return { ...actual, captureNodeToPng: (...args: unknown[]) => captureNodeToPng(...args) };
});

import { ExportDialog } from '@/components/ExportDialog';

const equation = parseEquation('x = b/a');
const steps: DerivationStep[] = [
  { index: 1, equation: parseEquation('a*x = b') },
  { index: 2, equation, justification: 'Divide both sides by a', assumptions: ['a ≠ 0'] },
];
const pngBlob = () => new Blob(['x'], { type: 'image/png' });

describe('ExportDialog', () => {
  beforeEach(() => {
    captureNodeToPng.mockReset().mockResolvedValue(pngBlob());
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class {
      constructor(public items: Record<string, Blob>) {}
    };
    Object.assign(navigator, { clipboard: { write: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    Object.assign(navigator, { clipboard: undefined });
  });

  it('gives both scopes the same three actions and background parity (#130)', () => {
    // Derivation scope: all three verbs, explanations toggle, full background set.
    const { unmount } = render(
      <ExportDialog scope="derivation" equation={equation} steps={steps} isOpen onClose={() => {}} />,
    );
    expect(screen.getByRole('dialog', { name: /export worked solution/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print \/ pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as png/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /show step explanations/i })).toBeInTheDocument();
    for (const bg of [/white/i, /^black$/i, /transparent/i]) {
      expect(screen.getByRole('radio', { name: bg })).toBeInTheDocument();
    }
    unmount();

    // Equation scope: the identical three verbs + backgrounds; the only difference
    // is no explanations toggle (nothing to explain in a single equation).
    render(<ExportDialog scope="equation" equation={equation} isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: /export equation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print \/ pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as png/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^black$/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /show step explanations/i })).toBeNull();
  });

  it('Save as PNG captures on the chosen background and downloads', async () => {
    const createUrl = vi.fn(() => 'blob:fake');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revoke });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ExportDialog scope="derivation" equation={equation} steps={steps} isOpen onClose={() => {}} />);
    // Pick black, then save — the capture background follows the picker.
    await userEvent.click(screen.getByRole('radio', { name: /^black$/i }));
    await userEvent.click(screen.getByRole('button', { name: /save as png/i }));

    expect(captureNodeToPng).toHaveBeenCalledTimes(1);
    expect(captureNodeToPng.mock.calls[0][1]).toBe('black');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('renders document variant selector in derivation scope and disables annotations in worksheet mode', async () => {
    const { rerender } = render(
      <ExportDialog scope="derivation" equation={equation} steps={steps} isOpen onClose={() => {}} />
    );

    // Should show variant selector (Answer key / Worksheet)
    expect(screen.getByRole('radio', { name: /answer key/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /worksheet/i })).toBeInTheDocument();

    // Answer key has active annotations checkbox
    const explanationsCheckbox = screen.getByRole('checkbox', { name: /show step explanations/i });
    expect(explanationsCheckbox).not.toBeDisabled();

    // Click Worksheet
    await userEvent.click(screen.getByRole('radio', { name: /worksheet/i }));

    // Explanations checkbox should be disabled
    expect(explanationsCheckbox).toBeDisabled();

    // Worksheet notice should be visible
    expect(screen.getByText(/worksheet is a visual\/print artifact/i)).toBeInTheDocument();

    // Re-render in equation scope — variant selector should not be present
    rerender(<ExportDialog scope="equation" equation={equation} isOpen onClose={() => {}} />);
    expect(screen.queryByRole('radio', { name: /worksheet/i })).toBeNull();
  });

  it('handles reveal mode controls (prev, next, and keyboard shortcuts)', async () => {
    render(<ExportDialog scope="derivation" equation={equation} steps={steps} isOpen onClose={() => {}} />);

    // Reveal steps control checkbox
    const revealCheckbox = screen.getByRole('checkbox', { name: /reveal steps one at a time/i });
    expect(revealCheckbox).toBeInTheDocument();
    expect(revealCheckbox).not.toBeChecked();

    // Click to enable reveal mode
    await userEvent.click(revealCheckbox);
    expect(revealCheckbox).toBeChecked();

    // Should show counter "Step 1 of 2"
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();

    // Next/Prev buttons should be visible
    const prevButton = screen.getByRole('button', { name: /previous step/i });
    const nextButton = screen.getByRole('button', { name: /next step/i });
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Prev should be disabled at step 1
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Click Next
    await userEvent.click(nextButton);
    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    // Click Prev
    await userEvent.click(prevButton);
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();

    // Test ArrowRight key press to advance
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();

    // Test ArrowLeft key press to retreat
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
  });
});

