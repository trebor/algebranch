// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { atom } from 'jotai';

/**
 * Raised when the app boots from a `?ws=` share link (#241). Drives the
 * one-time recipient banner that acknowledges the shared derivation and
 * teaches the share feature at the moment the recipient is most primed to
 * "get it" — closing the viral loop. Lowered when the banner is dismissed.
 */
export const sharedWorkspaceBannerAtom = atom<boolean>(false);
