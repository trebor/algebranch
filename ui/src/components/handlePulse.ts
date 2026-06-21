// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Whether a handle should pulse (animate-ping). All handles stay visible for
 * discoverability, but only the hovered node's handles pulse — quieting the
 * always-on noise and tying the glow to "what you're pointing at" (#121). The
 * onboarding tour forces its marked handle to pulse regardless of hover. A node
 * selected as a transposition source (sourcePath) suppresses pulsing entirely.
 *
 * `reducedMotion` honors the user's `prefers-reduced-motion` setting (#145): the
 * pulse is decorative discoverability motion, so when the user has asked for
 * reduced motion we drop it entirely. No information is lost — the handle itself
 * stays at full opacity and the hue still codes the action; only the animated
 * ping halo is suppressed.
 */
export const shouldPulseHandle = (params: {
  sourcePath: string | null;
  isHovered: boolean;
  isStackMarked: boolean;
  reducedMotion: boolean;
}): boolean => {
  if (params.reducedMotion) return false;
  if (params.sourcePath) return false;
  return params.isHovered || params.isStackMarked;
};
