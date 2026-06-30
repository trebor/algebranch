// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Copy text to the user's clipboard securely.
 * Falls back to document.execCommand('copy') when navigator.clipboard is
 * unavailable (e.g., on Android over non-HTTPS connections or inside certain webviews).
 */
export async function safeCopyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Try navigator.clipboard first if available
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, trying fallback:', err);
    }
  }

  // Fallback: document.execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Prevent scrolling or zooming
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

/**
 * Whether copying an image to the clipboard is supported here. Requires the async
 * `navigator.clipboard.write` API and the `ClipboardItem` constructor, both of
 * which are gated to secure contexts (HTTPS / localhost). There is no
 * `execCommand` fallback for images, so callers should hide/disable an image-copy
 * affordance when this is false and offer download instead.
 */
export function canCopyImage(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard?.write
  );
}

/**
 * Copy an image blob to the clipboard as `image/png`. Returns false (never throws)
 * when unsupported or rejected — e.g. denied permission or an insecure context —
 * so the caller can fall back to a download. The blob's own MIME type is used when
 * present so a non-PNG export still lands under the right clipboard flavor.
 */
export async function safeCopyImage(blob: Blob): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    const type = blob.type || 'image/png';
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    return true;
  } catch (err) {
    console.warn('navigator.clipboard.write (image) failed:', err);
    return false;
  }
}
