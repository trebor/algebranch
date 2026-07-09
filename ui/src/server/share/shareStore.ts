// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Swappable persistence contract for the first-party short-link store (#480).
 *
 * The store is deliberately minimal and content-blind: it holds `id → ciphertext`
 * and nothing else. The symmetric key never reaches the server (it rides in the
 * URL fragment), so the store is zero-knowledge by construction — it cannot read
 * the workspaces it holds. Everything the routes and client depend on is this
 * interface; the concrete vendor (today Cloudflare KV) lives behind it, so a
 * vendor swap later is one new adapter plus a dual-read backfill — never a route
 * or client change, and never a change to any already-minted `/s#key` link.
 *
 * There is no `touch`/TTL method: links are forever (the resolved #480 decision),
 * so nothing expires and there is no refresh-on-read to model.
 */
export interface ShareStore {
  /**
   * Store `ciphertext` under `id` only if `id` is not already present.
   * Returns `true` when the write happened, `false` when `id` was already taken.
   *
   * The `false` case is the collision signal: because `id = truncate(SHA-256(key))`
   * an existing id means a different key already maps there, and overwriting would
   * break that live link — so the caller must regenerate the key and retry rather
   * than clobber it.
   */
  put(id: string, ciphertext: string): Promise<boolean>;

  /** Fetch the ciphertext stored under `id`, or `null` when there is no such id. */
  get(id: string): Promise<string | null>;
}
