// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { APP_NAME } from '../constants/brand';

export { APP_NAME };

/**
 * The browser-tab title shown when there is no meaningful workspace name. The
 * tagline deliberately never appears in the tab — only the bare brand — so the
 * tab reads `Algebranch` until a workspace name is available (#449).
 */
export const DEFAULT_DOCUMENT_TITLE = APP_NAME;

/**
 * Build the browser-tab (`document.title`) string for the active workspace, so
 * open tabs are distinguishable at a glance (#449). Named workspaces read as
 * `"<name> — Algebranch"`; a blank/whitespace name falls back to the bare brand.
 */
export function formatDocumentTitle(workspaceName?: string | null): string {
  const trimmed = workspaceName?.trim();
  return trimmed ? `${trimmed} — ${APP_NAME}` : DEFAULT_DOCUMENT_TITLE;
}
