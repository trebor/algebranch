// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseEquation } from 'math-engine-client';

// Capture is a thin html-to-image wrapper that can't run under jsdom — mock just
// that function while keeping the pure colour/filename helpers real.
const captureNodeToPng = vi.fn();
vi.mock('@/utils/equationImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/equationImage')>();
  return { ...actual, captureNodeToPng: (...args: unknown[]) => captureNodeToPng(...args) };
});

import { ImageExportDialog } from '@/components/ImageExportDialog';

const eq = parseEquation('x^2-9=0');
const pngBlob = () => new Blob(['x'], { type: 'image/png' });

describe('ImageExportDialog', () => {
  beforeEach(() => {
    captureNodeToPng.mockReset().mockResolvedValue(pngBlob());
    // Image clipboard available in this run.
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

  it('renders the equation, background options, and a default-on branding toggle', () => {
    render(<ImageExportDialog equation={eq} isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: /save as image/i })).toBeInTheDocument();
    // The equation is typeset (a variable glyph is present).
    expect(screen.getAllByText('x').length).toBeGreaterThan(0);
    // Three background radios.
    expect(screen.getByRole('radio', { name: /white/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /black/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /transparent/i })).toBeInTheDocument();
    // Branding on by default + shown in the preview.
    expect(screen.getByRole('checkbox', { name: /algebranch\.org/i })).toBeChecked();
    expect(screen.getByText('algebranch.org')).toBeInTheDocument();
  });

  it('Download captures a PNG for the chosen background and triggers a download', async () => {
    const createUrl = vi.fn(() => 'blob:fake');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revoke });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ImageExportDialog equation={eq} isOpen onClose={() => {}} />);
    await userEvent.click(screen.getByRole('radio', { name: /black/i }));
    await userEvent.click(screen.getByRole('button', { name: /download png/i }));

    await waitFor(() => expect(captureNodeToPng).toHaveBeenCalled());
    expect(captureNodeToPng.mock.calls[0][1]).toBe('black');
    expect(clickSpy).toHaveBeenCalled();
    expect(createUrl).toHaveBeenCalled();
  });

  it('Copy writes the captured image to the clipboard and confirms', async () => {
    render(<ImageExportDialog equation={eq} isOpen onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /copy image/i }));

    await waitFor(() => expect(captureNodeToPng).toHaveBeenCalled());
    expect(await screen.findByText(/copied!/i)).toBeInTheDocument();
  });

  it('disables Copy and explains when the image clipboard is unsupported', () => {
    delete (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    render(<ImageExportDialog equation={eq} isOpen onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /copy image/i })).toBeDisabled();
    expect(screen.getByText(/isn.t supported in this browser/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ImageExportDialog equation={eq} isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
