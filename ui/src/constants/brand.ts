// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Canonical brand strings — the single source of truth for the product name and
 * tagline (#449). Everything that renders the name/tagline (the page metadata in
 * `app/layout.tsx`, the header subtitle, the browser-tab title) must import from
 * here so the wording never drifts between places.
 */
export const APP_NAME = 'Algebranch';

/** Short marketing tagline shown under the logo and in the default page title. */
export const APP_TAGLINE = 'Interactive Algebra';

/** `"Algebranch - Interactive Algebra"` — the app's default/landing title. */
export const APP_TITLE = `${APP_NAME} - ${APP_TAGLINE}`;
