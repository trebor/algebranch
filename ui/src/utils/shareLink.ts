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
 * JSON body. The id is derived locally, so on success we only read `ok`/`status`;
 * `json` is optional and only consulted on a 429, whose body names the daily
 * limit (#505). Injectable for testing; the global `fetch` fits it.
 */
type PostFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;

/**
 * Outcome of minting a short link.
 * - `ok`        → `url` is the shareable `<origin>/s#<key>` link.
 * - `too-large` → the ciphertext exceeded the server's size cap (413). The caller
 *                 should fall back to a self-contained `?ws=` link.
 * - `busy`      → the server's daily write budget is exhausted (429, #505). Not
 *                 retryable now; fall back to a self-contained `?ws=` link.
 *                 `dailyLimit` is the cap the server named in the body, when it
 *                 did — it's a per-deploy dial, so it's learned, never assumed.
 * - `error`     → network failure, an unexpected status, or collisions that never
 *                 cleared. Retryable, or fall back to `?ws=`.
 */
export type CreateShareLinkResult =
  | { status: 'ok'; url: string }
  | { status: 'too-large' }
  | { status: 'busy'; dailyLimit?: number }
  | { status: 'error' };

/** Pull the `dailyLimit` a 429 body names, or undefined on any malformed shape. */
async function readDailyLimit(res: { json?: () => Promise<unknown> }): Promise<number | undefined> {
  try {
    const body = await res.json?.();
    if (typeof body === 'object' && body !== null && 'dailyLimit' in body) {
      const limit = (body as { dailyLimit: unknown }).dailyLimit;
      if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) return limit;
    }
  } catch {
    // An unreadable body just means no number to show — busy stands on its own.
  }
  return undefined;
}

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

    let res: Awaited<ReturnType<PostFetchLike>>;
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
    if (res.status === 429) {
      // Budget drained — don't retry. Carry the limit the server named, if any.
      const dailyLimit = await readDailyLimit(res);
      return dailyLimit === undefined ? { status: 'busy' } : { status: 'busy', dailyLimit };
    }
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

/**
 * Choose the initial workspace payload to load: an explicit `?ws=` param (`wsParam`)
 * always wins over a `/s#key` short-link handoff (`pendingShare`). This precedence is
 * the guarantee that classic stateless links are *unaffected* by short links (#480) —
 * an explicit `?ws=` URL loads unchanged even if a stale handoff is still stashed.
 * Returns null when neither is present, leaving the `?eq=` / saved-session paths to run.
 */
export function resolveInitialWsSource(
  wsParam: string | null,
  pendingShare: string | null,
): string | null {
  return wsParam ?? pendingShare;
}

// --- Helper functions moved from ShareMenu ---

const LINK_SIZE_TINY = 280;
const LINK_SIZE_SAFE = 2000;

interface LinkBand {
  label: string;
  tone: 'ok' | 'warn';
}

export const classifyLinkSize = (n: number): LinkBand =>
  n <= LINK_SIZE_TINY
    ? { label: 'Tiny', tone: 'ok' }
    : n <= LINK_SIZE_SAFE
      ? { label: 'Compact', tone: 'ok' }
      : { label: 'Large', tone: 'warn' };

export const bandAdvice = (
  n: number,
  { hasSmallerScope = true }: { hasSmallerScope?: boolean } = {},
): string | null => {
  if (classifyLinkSize(n).tone !== 'warn') return null;
  const risk = 'This link may be trimmed by some chat apps and QR encoders.';
  return hasSmallerScope ? `${risk} A smaller link is below.` : risk;
};

export const nextUtcMidnight = (now: Date): number =>
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

export const formatUtcDayReset = (now: Date): string => {
  const totalMinutes = Math.max(1, Math.ceil((nextUtcMidnight(now) - now.getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (hours === 0) return unit(minutes, 'minute');
  if (minutes === 0) return unit(hours, 'hour');
  return `${unit(hours, 'hour')} ${unit(minutes, 'minute')}`;
};

export const busyShareSummary = (dailyLimit: number | undefined, now: Date): string => {
  const limit = dailyLimit === undefined ? '' : ` of ${dailyLimit.toLocaleString('en-US')}`;
  return `Short links hit today's limit${limit} — more in about ${formatUtcDayReset(now)}.`;
};

export const busyShareNote = (dailyLimit: number | undefined, now: Date): string =>
  `${busyShareSummary(dailyLimit, now)} Use a link that works offline below.`;

export const LINK_NOT_COPIED_TOAST = "Link wasn't copied — try again.";

export type ShortLinkFailure =
  | { kind: 'error' }
  | { kind: 'busy'; dailyLimit?: number; resetsAt: number };

export const liveBusyFailure = (
  failure: ShortLinkFailure | null,
  nowMs: number,
): Extract<ShortLinkFailure, { kind: 'busy' }> | null =>
  failure?.kind === 'busy' && nowMs < failure.resetsAt ? failure : null;

