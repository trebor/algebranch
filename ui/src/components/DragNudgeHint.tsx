// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { X } from 'lucide-react';
import {
  dragNudgeAtom,
  dismissDragNudgeAtom,
  sourcePathAtom,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PreviewEquationNode } from './PreviewEquationNode';

// Gap (px) between the term and the card when it floats above the term.
const ANCHOR_GAP_PX = 12;

// Card width (px) — matches DRAG_NUDGE_CARD's `w-60`. Used to clamp/center.
const CARD_W = 240;

const measureRect = (path: string): DOMRect | null => {
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(path) : path;
  const el = document.querySelector(`[data-node-path="${escaped}"]`);
  return el ? el.getBoundingClientRect() : null;
};

/**
 * The card body, keyed by the anchored path so it remounts fresh for each new
 * nudge — that resets the "Don't show this again" checkbox with no reset effect.
 */
const DragNudgeCard: React.FC<{ path: string }> = ({ path }) => {
  const sourcePath = useAtomValue(sourcePathAtom);
  const dismiss = useSetAtom(dismissDragNudgeAtom);
  const reducedMotion = useReducedMotion();

  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  // Analytics fire exactly on appearance — mount is 1:1 with "shown", so the
  // count is honest (the store gate already decided it should show).
  React.useEffect(() => {
    trackEvent({ action: 'drag_nudge_shown', category: 'math_interaction', label: path });
  }, [path]);

  // Measure the anchored term and keep the card pinned across scroll/resize.
  // setState only ever runs inside a callback (rAF / listeners), never
  // synchronously in the effect body.
  React.useEffect(() => {
    const measure = () => setRect(measureRect(path));
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [path]);

  // No auto-dismiss (#386): the hint stays until the user acts. Escape is one of
  // the several manual outs — reading pace shouldn't race a timer.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss({ dontShowAgain: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  // The user acted (moved the term, deselected, or the equation advanced): the
  // selection no longer matches the anchor, so the coaching moment is over.
  React.useEffect(() => {
    if (sourcePath !== path) dismiss({ dontShowAgain: false });
  }, [sourcePath, path, dismiss]);

  // Float above the term when there's room, else below it. Clamp horizontally so
  // a term near the viewport edge doesn't push the card off-screen.
  let top = 0;
  let left = 0;
  let placeBelow = false;
  if (rect) {
    placeBelow = rect.top < 120;
    top = placeBelow ? rect.bottom + ANCHOR_GAP_PX : rect.top - ANCHOR_GAP_PX;
    const centered = rect.left + rect.width / 2 - CARD_W / 2;
    left = Math.max(8, Math.min(centered, window.innerWidth - CARD_W - 8));
  }

  return (
    // Not itself a live region: the two-tap hint is announced once via
    // liveAnnouncementAtom (set when the nudge fires) so a screen reader isn't told
    // twice. The card stays in the a11y tree so its checkbox/close stay reachable.
    <div
      role="group"
      aria-label="Two taps to move"
      style={{
        position: 'fixed',
        top,
        left,
        transform: placeBelow ? undefined : 'translateY(-100%)',
      }}
      className={`${THEME_GLASS.DRAG_NUDGE_CARD} relative ${reducedMotion ? '' : 'animate-[fadeIn_0.2s_ease-out]'}`}
    >
      <button
        type="button"
        aria-label="Dismiss hint"
        className={THEME_GLASS.DRAG_NUDGE_CLOSE}
        onClick={() => dismiss({ dontShowAgain })}
      >
        <X size={12} />
      </button>
      <span className={THEME_GLASS.DRAG_NUDGE_TITLE}>Two taps to move</span>
      <span className={THEME_GLASS.DRAG_NUDGE_DESC}>
        Moving a term takes two taps — no dragging.
      </span>
      <div className={THEME_GLASS.DRAG_NUDGE_PREVIEW_ROW}>
        <span className={THEME_GLASS.DRAG_NUDGE_PREVIEW_LABEL}>You selected</span>
        <div className={THEME_GLASS.DRAG_NUDGE_PREVIEW_BOX}>
          <PreviewEquationNode path={path} />
        </div>
      </div>
      <span className={THEME_GLASS.DRAG_NUDGE_DESC}>
        Now <strong>tap a green glowing target</strong> to move it there.
      </span>
      <label className={THEME_GLASS.DRAG_NUDGE_CHECK_ROW}>
        <input
          type="checkbox"
          className={THEME_GLASS.DRAG_NUDGE_CHECKBOX}
          checked={dontShowAgain}
          onChange={(e) => {
            const checked = e.target.checked;
            setDontShowAgain(checked);
            if (checked) {
              trackEvent({
                action: 'drag_nudge_dismissed_forever',
                category: 'math_interaction',
                label: path,
              });
              dismiss({ dontShowAgain: true });
            }
          }}
        />
        <span>Don&rsquo;t show this again</span>
      </label>
    </div>
  );
};

/**
 * The drag-nudge coach card (#386). Renders only while `dragNudgeAtom` is set —
 * i.e. right after a drag attempt on a movable term selected it as the source and
 * lit the targets. It floats near that term and coaches the second tap, with a
 * "Don't show this again" checkbox that permanently silences it.
 */
export const DragNudgeHint: React.FC = () => {
  const nudge = useAtomValue(dragNudgeAtom);
  if (!nudge || typeof document === 'undefined') return null;

  return createPortal(
    // Fixed overlay layer; only the card is interactive so the rest of the canvas
    // stays usable (the second tap must land on a live target).
    <div className="fixed inset-0 z-40 pointer-events-none">
      <DragNudgeCard key={nudge.path} path={nudge.path} />
    </div>,
    document.body,
  );
};
