// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Layers } from 'lucide-react';
import {
  sharedWorkspaceBannerAtom,
  sharedWorkspacePresetAtom,
  markSharedWorkspaceBannerDismissed,
} from '../store/sharedWorkspaceBanner';
import { consentAtom } from '../store/consent';
import { THEME_GLASS } from '../constants/theme';

/**
 * Recipient loop banner (#241). When the app opens a `?ws=` share link, this
 * acknowledges that the link restored someone's *full* derivation — the actual
 * magic of workspace-share — and invites the recipient to keep working on it or
 * share their own. It closes the viral loop by teaching the feature to the
 * person most primed to discover it. Non-blocking and dismissible; mirrors the
 * focus etiquette of the ConsentBanner so keyboard/SR users land on the action.
 */
export const SharedWorkspaceBanner = () => {
  const [open, setOpen] = useAtom(sharedWorkspaceBannerAtom);
  const presetLabel = useAtomValue(sharedWorkspacePresetAtom);
  const consent = useAtomValue(consentAtom);
  const dismissButtonRef = React.useRef<HTMLButtonElement>(null);

  // On first run a ?ws= link can raise this banner *and* the cookie consent
  // banner together. The cookie choice takes precedence, so we hold the banner
  // back entirely until consent is resolved — then it takes the stage (and
  // focus) on its own. Gating on this also isolates the Escape keys: while
  // consent is unset the banner is unmounted with no global listener, so the
  // Escape that declines cookies can never cascade into dismissing it (#484).
  const visible = open && consent !== 'unset';

  // Record the dismissal so future `?ws=` arrivals skip the banner (#263).
  const dismiss = React.useCallback(() => {
    markSharedWorkspaceBannerDismissed();
    setOpen(false);
  }, [setOpen]);

  // Pull focus onto the dismiss button once the banner actually appears, so
  // keyboard / screen-reader users land on the action. No focus trap; tabbing
  // back out into the app is intentional. Restore focus on unmount.
  React.useEffect(() => {
    if (!visible) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dismissButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [visible]);

  // Escape dismisses from anywhere on the page, not just while focus is inside
  // the banner (#484): the recipient often clicks onto the canvas first, moving
  // focus out. A global listener, mounted only while the banner is visible,
  // keeps Escape working.
  //
  // Arm it on the next macrotask. When the banner is raised by the very Escape
  // that dismisses the cookie banner, React flushes this mount *synchronously*
  // inside that keydown's dispatch (Escape is a discrete event), so the same
  // keydown then keeps bubbling to `window` and this brand-new listener catches
  // it — dismissing the banner before it ever paints. A microtask defer doesn't
  // help (the DOM runs a microtask checkpoint *between* event-listener calls, so
  // it flips before the window-phase listener runs); a macrotask can't run until
  // the whole dispatch is over, so `setTimeout` skips exactly that one in-flight
  // press while every later Escape still dismisses.
  React.useEffect(() => {
    if (!visible) return;
    let armed = false;
    const timer = setTimeout(() => {
      armed = true;
    }, 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!armed || e.key !== 'Escape') return;
      e.preventDefault();
      dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="shared-workspace-title"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[100] animate-[fadeIn_0.3s_ease-out]"
    >
      <div className={`${THEME_GLASS.PANEL} p-5 flex flex-col gap-4`}>
        <div className="flex items-start gap-3">
          <Layers size={20} className="mt-0.5 shrink-0 text-indigo-400" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h3 id="shared-workspace-title" className={THEME_GLASS.BANNER_TITLE}>
              A shared workspace was opened for you
            </h3>
            <p className={THEME_GLASS.BANNER_TEXT}>
              {presetLabel && (
                <span className="block mb-1.5 text-indigo-300 font-semibold">
                  This link set: {presetLabel}
                </span>
              )}
              This link restored someone&apos;s full derivation and history tree — keep working on
              it right here. Built a worked solution of your own? Hit <strong>Share</strong> to
              hand the whole workspace to someone in one gesture.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            ref={dismissButtonRef}
            onClick={dismiss}
            className={`${THEME_GLASS.BUTTON_PRIMARY} px-4 py-2 text-xs font-semibold`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
