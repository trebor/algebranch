// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Recipient half of first-party zero-knowledge short links (#480). The `/s` page is
// a thin client shell over `loadSharePayload`, which is the whole resolvable chain:
//   location.hash → key → id = SHA-256(key) → GET /api/share/<id> → decrypt
// The key lives only in the fragment (never sent to the server), so decryption is
// client-side; the server returned opaque ciphertext it could not read. The returned
// `payload` is byte-identical to a `?ws=` value — the compressed workspace string —
// so the page hands it straight to the existing workspace loader unchanged.

import {
  fragmentToKey,
  deriveShareId,
  decryptWorkspace,
  generateShareKey,
  keyToFragment,
  encryptWorkspace,
} from './shareCrypto';

/**
 * The minimal slice of the Fetch API we depend on. Narrowing it (rather than
 * `typeof fetch`) keeps the unit test's fake tiny and makes the dependency
 * injectable without pulling in DOM `Response`.
 */
type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Outcome of resolving a `/s#<key>` link.
 * - `ok`        → `payload` is the compressed workspace string (feed to the loader).
 * - `malformed` → the fragment isn't a well-formed 128-bit key (typo / truncation).
 * - `not-found` → the id isn't in the store (404): a bad id, or a link never created.
 * - `corrupt`   → fetched fine, but decryption failed (wrong key or tampered blob).
 * - `error`     → the network failed or the server errored (non-404). Retryable.
 */
export type SharePayloadResult =
  | { status: 'ok'; payload: string }
  | { status: 'malformed' }
  | { status: 'not-found' }
  | { status: 'corrupt' }
  | { status: 'error' };

/**
 * Resolve a `/s#<key>` link to its decrypted workspace payload. `hash` is
 * `location.hash` verbatim (leading `#` included); `fetchImpl` is injectable for
 * testing and defaults to the global `fetch`. Never throws — every failure maps to
 * a {@link SharePayloadResult} status the page renders as a message.
 */
export async function loadSharePayload(
  hash: string,
  fetchImpl: FetchLike = fetch,
): Promise<SharePayloadResult> {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const key = fragmentToKey(fragment);
  if (key === null) return { status: 'malformed' };

  const id = await deriveShareId(key);

  let ciphertext: string;
  try {
    const res = await fetchImpl(`/api/share/${id}`);
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'error' };
    const body = (await res.json()) as { ciphertext?: unknown };
    if (typeof body.ciphertext !== 'string') return { status: 'error' };
    ciphertext = body.ciphertext;
  } catch {
    return { status: 'error' };
  }

  const payload = await decryptWorkspace(ciphertext, key);
  if (payload === null) return { status: 'corrupt' };
  return { status: 'ok', payload };
}

// --- sender half: create a short link ----------------------------------------
// The mirror of `loadSharePayload`. Given a compressed workspace payload (the same
// string a `?ws=` link carries), it mints a fresh key, encrypts client-side,
// derives the id, and POSTs the ciphertext — so the plaintext and the key never
// leave the browser. The finished link is `<origin>/s#<fragment>`: ~38 chars,
// constant regardless of workspace size, with the key living only in the fragment.

/**
 * The minimal slice of the Fetch API the create round-trip needs — a POST with a
 * JSON body, of which we only read `ok`/`status` (the id is derived locally, so the
 * response body is irrelevant). Injectable for testing; the global `fetch` fits it.
 */
type PostFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

/**
 * Outcome of minting a short link.
 * - `ok`        → `url` is the shareable `<origin>/s#<key>` link.
 * - `too-large` → the ciphertext exceeded the server's size cap (413). The caller
 *                 should fall back to a self-contained `?ws=` link.
 * - `error`     → network failure, an unexpected status, or collisions that never
 *                 cleared. Retryable, or fall back to `?ws=`.
 */
export type CreateShareLinkResult =
  | { status: 'ok'; url: string }
  | { status: 'too-large' }
  | { status: 'error' };

/**
 * Upper bound on 409-collision retries. A collision needs two random 128-bit keys
 * whose truncated (80-bit) SHA-256 digests coincide — astronomically unlikely — so
 * a handful of attempts is already generous; exhausting them means something is
 * wrong (not real contention), and we surface an error rather than loop forever.
 */
const MAX_COLLISION_RETRIES = 5;

/**
 * Mint a `<origin>/s#<key>` short link for `payload` (a compressed workspace string,
 * byte-identical to a `?ws=` value). Generates a key, encrypts locally, derives the
 * id, and POSTs the ciphertext; on a 409 collision it regenerates the key (yielding
 * a fresh id) and retries. `origin` is the scheme+host to prefix (no trailing path);
 * `fetchImpl` is injectable and defaults to the global `fetch`. Never throws.
 */
export async function createShareLink(
  payload: string,
  origin: string,
  fetchImpl: PostFetchLike = fetch,
): Promise<CreateShareLinkResult> {
  for (let attempt = 0; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    const key = generateShareKey();
    const ciphertext = await encryptWorkspace(payload, key);
    const id = await deriveShareId(key);

    let res: { ok: boolean; status: number };
    try {
      res = await fetchImpl('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ciphertext }),
      });
    } catch {
      return { status: 'error' };
    }

    if (res.status === 200) {
      return { status: 'ok', url: `${origin}/s#${keyToFragment(key)}` };
    }
    if (res.status === 409) continue; // id collision — mint a new key and retry
    if (res.status === 413) return { status: 'too-large' };
    return { status: 'error' };
  }
  return { status: 'error' }; // collisions never cleared — treat as a failure
}

// --- payload handoff to the main app -----------------------------------------
// The `/s` page decrypts client-side, then hands the payload to the existing
// workspace loader on `/`. It rides in `sessionStorage` — not the URL — so the
// long payload never re-appears in the address bar (defeating the short link) and
// the fragment key is never exposed on the destination. It is a compressed `ws`
// string, byte-identical to a `?ws=` value, so `/` consumes it through the same
// pipeline. `sessionStorage` (per-tab, cleared on close) suits this one-shot hop.

const PENDING_SHARE_KEY = 'algebranch_pending_share';

/** Stash a resolved payload for the `/` loader to pick up after navigation. */
export function stashPendingShare(payload: string): void {
  try {
    sessionStorage.setItem(PENDING_SHARE_KEY, payload);
  } catch {
    // Private-mode / disabled storage — the page falls back to an error message.
  }
}

/**
 * Read and clear a pending share payload (a one-shot handoff — consuming it
 * removes it so a refresh doesn't re-load the workspace). Returns null when none
 * is waiting or storage is unavailable.
 */
export function consumePendingShare(): string | null {
  try {
    const payload = sessionStorage.getItem(PENDING_SHARE_KEY);
    if (payload !== null) sessionStorage.removeItem(PENDING_SHARE_KEY);
    return payload;
  } catch {
    return null;
  }
}
