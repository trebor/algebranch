// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Sentence-case the first character of a step description (#125).
 *
 * Structured step descriptors (#42) are authored lowercase ("add 3 to both
 * sides", "distribute") while coarse fallback labels are Title Case ("Move",
 * "Distribute"), so adjacent derivation steps clash. Normalizing casing here —
 * at the shared display/export composition point rather than across dozens of
 * source strings — capitalizes only the leading character. Every descriptor
 * begins with a verb, so this only ever lifts a lowercase lead and leaves
 * already-capitalized labels untouched.
 */
export const sentenceCase = (text: string | undefined): string | undefined =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
