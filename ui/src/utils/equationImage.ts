// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { Equation } from 'math-engine-client';
import { equationToFormat } from '../store/equation';

/**
 * Helpers for exporting a single equation as a PNG image (#335). The pure colour /
 * filename logic lives here so it can be unit-tested; the DOM→raster capture is a
 * thin lazy wrapper over `html-to-image` (untestable under jsdom, kept minimal).
 */

/** The three offered export backgrounds. `transparent` leaves the alpha channel. */
export type ImageBackground = 'white' | 'black' | 'transparent';

export const IMAGE_BACKGROUNDS: readonly ImageBackground[] = ['white', 'black', 'transparent'];

/**
 * CSS colour fed to `html-to-image`'s `backgroundColor`. `transparent` maps to
 * `undefined`, which tells the library to leave the canvas unfilled so the PNG
 * keeps its alpha channel.
 */
export function backgroundColorFor(bg: ImageBackground): string | undefined {
  switch (bg) {
    case 'white':
      return '#ffffff';
    case 'black':
      return '#000000';
    case 'transparent':
      return undefined;
  }
}

/**
 * Glyph colour that reads on a given background. Black needs light text; white and
 * transparent (most often dropped onto light surfaces) get dark text.
 */
export function foregroundColorFor(bg: ImageBackground): string {
  return bg === 'black' ? '#f8fafc' : '#0f172a';
}

const MAX_SLUG = 48;

/**
 * A filesystem-safe slug from an equation's plain-text form: anything that isn't a
 * safe, readable math character collapses to a single hyphen, so the result can't
 * contain path separators, whitespace, or glob characters. Empty when nothing
 * usable survives, so callers can supply their own fallback.
 */
function equationSlug(eq: Equation): string {
  return equationToFormat(eq, 'plain')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9=+^-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG);
}

/**
 * Download filename for an exported equation, e.g. `algebranch-x^2-9=0.png`.
 * Falls back to a generic name when the slug is empty.
 */
export function equationImageFilename(eq: Equation): string {
  const slug = equationSlug(eq);
  return slug ? `algebranch-${slug}.png` : 'algebranch-equation.png';
}

/**
 * Download filename for a worked-solution PNG (#130), keyed off the original
 * problem equation, e.g. `algebranch-solution-2x=4.png`. Distinct `-solution-`
 * segment so a saved worked solution reads apart from a single-equation image.
 */
export function workedSolutionImageFilename(problem: Equation): string {
  const slug = equationSlug(problem);
  return slug ? `algebranch-solution-${slug}.png` : 'algebranch-solution.png';
}

/**
 * Capture a DOM node to a PNG blob on the chosen background. `html-to-image` is
 * dynamically imported so it never loads during SSR or in unit tests that only
 * exercise the pure helpers above. `pixelRatio` is bumped to 2 for crisp output on
 * the high-DPI screens these promo images are usually viewed on. Returns null when
 * the capture yields no blob.
 */
export async function captureNodeToPng(
  node: HTMLElement,
  bg: ImageBackground,
  pixelRatio = 2,
): Promise<Blob | null> {
  const { toBlob } = await import('html-to-image');
  return toBlob(node, {
    backgroundColor: backgroundColorFor(bg),
    pixelRatio,
    cacheBust: true,
  });
}
