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
});
