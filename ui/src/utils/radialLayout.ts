// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Geometry for the radial "equals menu" that blooms from the `=` sign.
 *
 * The petal circles are sized in rem (Tailwind `w-12`), so the accessibility
 * text-size knob (#239) — which scales the root rem via `--chrome-scale` —
 * grows them automatically. The ring radius and the lucide glyphs inside,
 * however, are computed in raw pixels, so without help they stay put while the
 * circles balloon: the petals bunch into an overlapping "flower" with tiny
 * icons (#278). These helpers multiply the px geometry by the same chrome scale
 * so the whole menu scales as one coherent unit.
 */

/** Number of petals arranged around the ring. */
export const RADIAL_PETAL_COUNT = 7;
/** First petal sits at 12 o'clock; the rest fan clockwise from there. */
export const RADIAL_ANGLE_START_DEG = -90;
/** Ring radius (px) at the default text size. */
export const RADIAL_BASE_RADIUS_PX = 72;
/** Petal diameter (px) at the default text size — Tailwind `w-12` (3rem @ 16px). */
export const RADIAL_PETAL_DIAMETER_PX = 48;
/** Default lucide glyph size (px) inside a petal. */
export const RADIAL_ICON_BASE_PX = 18;
/** Default lucide glyph size (px) inside the spinner stepper buttons. */
export const RADIAL_SPINNER_ICON_BASE_PX = 12;

/**
 * Viewport width (px) below which the equals menu centers horizontally on the
 * screen instead of anchoring to the `=` sign (#392). At or above it there is
 * room to keep the anchored placement. Matches Tailwind's `sm` breakpoint.
 */
export const RADIAL_NARROW_VIEWPORT_PX = 640;

/** The `=` sign's center and the viewport size, in px — inputs to menu placement. */
export interface RadialMenuAnchor {
  anchorX: number;
  anchorY: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Placement (px) for the equals menu's center. On a narrow (mobile) viewport an
 * anchor near a screen edge let the petals/input panel run off-screen (#392);
 * below the `sm` threshold we drop the menu into the dead center of the screen —
 * both axes — so it always lands fully on-screen. Wider viewports keep it
 * anchored to the `=` sign, where the bloom has room.
 */
export function radialMenuPosition(
  { anchorX, anchorY, viewportWidth, viewportHeight }: RadialMenuAnchor,
  narrowThresholdPx: number = RADIAL_NARROW_VIEWPORT_PX,
): { x: number; y: number } {
  if (viewportWidth < narrowThresholdPx) {
    return { x: viewportWidth / 2, y: viewportHeight / 2 };
  }
  return { x: anchorX, y: anchorY };
}

/** Ring radius (px) for a given chrome scale, growing with the rem petals. */
export function radialRadiusPx(chromeScale: number): number {
  return RADIAL_BASE_RADIUS_PX * chromeScale;
}

/** Petal glyph size (px) for a given chrome scale. */
export function radialIconPx(chromeScale: number): number {
  return Math.round(RADIAL_ICON_BASE_PX * chromeScale);
}

/** Spinner-button glyph size (px) for a given chrome scale. */
export function radialSpinnerIconPx(chromeScale: number): number {
  return Math.round(RADIAL_SPINNER_ICON_BASE_PX * chromeScale);
}

/** Petal diameter (px) at a given chrome scale — the rem circle's rendered size. */
export function radialPetalDiameterPx(chromeScale: number): number {
  return RADIAL_PETAL_DIAMETER_PX * chromeScale;
}

/** Chord distance (px) between two adjacent petal centers on the ring. */
export function radialPetalCenterDistancePx(chromeScale: number): number {
  return 2 * radialRadiusPx(chromeScale) * Math.sin(Math.PI / RADIAL_PETAL_COUNT);
}
