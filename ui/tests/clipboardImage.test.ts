// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeCopyImage, canCopyImage } from '@/utils/clipboard';

// jsdom has no ClipboardItem; install a minimal stub that records its payload so we
// can assert the image is handed to the clipboard as an `image/png` item.
class FakeClipboardItem {
  items: Record<string, Blob>;
  constructor(items: Record<string, Blob>) {
    this.items = items;
  }
}

const pngBlob = () => new Blob(['x'], { type: 'image/png' });

describe('safeCopyImage / canCopyImage', () => {
  beforeEach(() => {
    (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = FakeClipboardItem;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    // Reset clipboard between tests.
    Object.assign(navigator, { clipboard: undefined });
  });

  it('reports the image clipboard as available when write + ClipboardItem exist', () => {
    Object.assign(navigator, { clipboard: { write: vi.fn() } });
    expect(canCopyImage()).toBe(true);
  });

  it('reports unavailable when ClipboardItem is missing', () => {
    Object.assign(navigator, { clipboard: { write: vi.fn() } });
    delete (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    expect(canCopyImage()).toBe(false);
  });

  it('writes the blob as an image/png ClipboardItem and resolves true', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { write } });
    const blob = pngBlob();

    await expect(safeCopyImage(blob)).resolves.toBe(true);

    expect(write).toHaveBeenCalledTimes(1);
    const [items] = write.mock.calls[0];
    expect(items).toHaveLength(1);
    expect((items[0] as FakeClipboardItem).items['image/png']).toBe(blob);
  });

  it('resolves false (no throw) when the clipboard write rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const write = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { write } });

    await expect(safeCopyImage(pngBlob())).resolves.toBe(false);
  });

  it('resolves false when image clipboard is unsupported', async () => {
    Object.assign(navigator, { clipboard: undefined });
    await expect(safeCopyImage(pngBlob())).resolves.toBe(false);
  });
});
