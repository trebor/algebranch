// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Splice `text` into a controlled text input at the current caret (replacing any
 * selection), hand the new value to `setValue`, and restore focus with the caret
 * placed just after the inserted text. Used by the imaginary-unit insert button
 * (#105): the glyph ⅈ can't be typed from a bare keyboard, so a palette button
 * inserts it at the caret of whatever expression field is focused.
 *
 * Returns the resulting string (handy for tests / callers that want it). The
 * caret restore is deferred to the next frame so it runs after React has flushed
 * the new controlled value into the DOM node.
 */
export function insertAtCaret(
  input: HTMLInputElement,
  text: string,
  setValue: (next: string) => void,
): string {
  const value = input.value;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;
  const next = value.slice(0, start) + text + value.slice(end);
  setValue(next);

  const caret = start + text.length;
  const restore = () => {
    input.focus();
    input.setSelectionRange(caret, caret);
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(restore);
  } else {
    restore();
  }
  return next;
}
