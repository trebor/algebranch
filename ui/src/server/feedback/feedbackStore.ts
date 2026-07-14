// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Swappable persistence contract for the first-party feedback store (#519).
 *
 * Mirrors the shape of {@link import('../share/shareStore').ShareStore}: the core
 * (`feedbackApi.ts`) depends only on this interface, and the concrete vendor
 * (today Cloudflare KV, in the same namespace as short links behind an `fb:`
 * key prefix) lives behind it, so a vendor swap is one new adapter and never a
 * route or core change.
 *
 * Unlike the share store, feedback is *not* zero-knowledge — the whole point is
 * that a human reads it — so the store holds the report verbatim and exposes a
 * `list` for the authenticated admin read. It is still content-blind at this
 * layer: the core hands it an opaque JSON string and gets opaque strings back.
 */

/** One stored report: its key and the opaque JSON body the core wrote. */
export interface StoredFeedbackEntry {
  id: string;
  json: string;
}

export interface FeedbackStore {
  /**
   * Persist `json` under `id`. Unlike the share store there is no store-if-absent
   * dance: ids are time-ordered and unique by construction, so a plain write is
   * correct and collisions are not a concern.
   */
  put(id: string, json: string): Promise<void>;

  /**
   * The most recent `limit` reports, newest first. Backs the admin read; the
   * caller (the route) is responsible for gating it behind auth.
   */
  list(limit: number): Promise<StoredFeedbackEntry[]>;
}
