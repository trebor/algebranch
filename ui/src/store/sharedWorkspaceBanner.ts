// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { atom } from 'jotai';
import { safeStorage } from '../utils/safeStorage';

/**
 * Raised when the app boots from a `?ws=` share link (#241). Drives the
 * one-time recipient banner that acknowledges the shared derivation and
 * teaches the share feature at the moment the recipient is most primed to
 * "get it" — closing the viral loop. Lowered when the banner is dismissed.
 */
export const sharedWorkspaceBannerAtom = atom<boolean>(false);
export const sharedWorkspacePresetAtom = atom<string | null>(null);

/**
 * localStorage key recording that the recipient has seen and dismissed the
 * banner at least once (#263). The banner teaches the share feature, so it only
 * needs to land once — after that, every subsequent `?ws=` arrival stays quiet.
 */
export const SHARED_WORKSPACE_BANNER_DISMISSED_KEY =
  'algebranch:shared-workspace-banner-dismissed';

/**
 * True once the recipient has dismissed the banner on this device. Read at
 * share-link load time to gate raising the banner. Guarded so a disabled or
 * throwing localStorage (private mode, SSR) just reports "not dismissed".
 */
export const isSharedWorkspaceBannerDismissed = (): boolean =>
  safeStorage.getItem(SHARED_WORKSPACE_BANNER_DISMISSED_KEY) === 'true';

/** Persist the dismissal so future share links don't re-raise the banner. */
export const markSharedWorkspaceBannerDismissed = (): void => {
  safeStorage.setItem(SHARED_WORKSPACE_BANNER_DISMISSED_KEY, 'true');
};
