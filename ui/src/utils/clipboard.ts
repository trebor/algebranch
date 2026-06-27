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
