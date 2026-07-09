// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Client crypto for first-party zero-knowledge short links (#480):
// `algebranch.org/s#<key>`. The AES-128-GCM key is generated and used only in the
// browser and rides in the URL *fragment* (`#…`), which is never sent to the
// server — that fragment-only key is the entire zero-knowledge mechanism. The
// server sees only the derived `id` and the ciphertext, so the store cannot read
// the workspaces it holds.
//
// Pipeline (per #480):
//   create : serialize → compress → encryptWorkspace(key) → store ciphertext under id
//   open   : fetch ciphertext by id → decryptWorkspace(key) → decompress → load
// Compression lives outside this module (math-engine `compress.ts`); here we only
// encrypt/decrypt an opaque UTF-8 string, so the module stays pure and, like
// eqParam.ts, unit-testable in isolation with no React/store/network imports.
//
// `id = base62(truncate(SHA-256(key)))` is a *deterministic* function of the key,
// derived client-side. Two different keys collide on an id only if their truncated
// SHA-256 digests collide; the POST route additionally guards with store-if-absent
// + retry, so a collision never clobbers a live link.

/** AES-128 key length in bytes (→ 22 base64url chars in the fragment). */
export const KEY_BYTES = 16;

/** GCM initialization-vector length in bytes; prepended to each ciphertext. */
const IV_BYTES = 12;

/**
 * Bytes of the SHA-256 digest kept for the id (80 bits). Ample against birthday
 * collisions at millions-of-links scale, and store-if-absent covers the rest.
 */
const ID_BYTES = 10;

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Fixed width of a share id: the base62 length of the largest ID_BYTES value.
 * Left-padding to this width makes every id the same shape, so the GET route can
 * validate by a single regex (see {@link SHARE_ID_PATTERN}).
 */
export const SHARE_ID_LENGTH = Math.ceil((ID_BYTES * 8) / Math.log2(62)); // 14

/** Shape of a valid share id — for cheap server-side validation before any store hit. */
export const SHARE_ID_PATTERN = new RegExp(`^[0-9A-Za-z]{${SHARE_ID_LENGTH}}$`);

// --- base64url byte codec (url-safe alphabet, no padding) --------------------
// Local copies (rather than importing compress.ts helpers, which aren't exported)
// keep this module dependency-free and independently testable, matching eqParam.ts.

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a base64url token to bytes, or null when it is not well-formed. Never throws. */
function base64UrlToBytes(token: string): Uint8Array | null {
  if (token.length === 0 || /[^A-Za-z0-9_-]/.test(token)) return null;
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// --- key generation & fragment codec -----------------------------------------

/** Generate a fresh random 128-bit AES key as raw bytes. */
export function generateShareKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}

/** Encode a key as the URL-fragment token (22 base64url chars for 16 bytes). */
export function keyToFragment(key: Uint8Array): string {
  return bytesToBase64Url(key);
}

/**
 * Decode a fragment token back to a key, or null when it is not a well-formed
 * 128-bit key — a malformed alphabet, or the wrong decoded byte count.
 */
export function fragmentToKey(fragment: string): Uint8Array | null {
  const bytes = base64UrlToBytes(fragment);
  if (bytes === null || bytes.length !== KEY_BYTES) return null;
  return bytes;
}

// --- id derivation -----------------------------------------------------------

/**
 * Big-endian bytes → base62, left-padded to {@link SHARE_ID_LENGTH}. Uses base-256
 * long division rather than BigInt (the tsconfig targets ES2017, which disallows
 * BigInt literals); each step's `remainder * 256 + digit` stays well inside the
 * Number safe range, so the arithmetic is exact.
 */
function bytesToBase62(bytes: Uint8Array): string {
  const digits = Array.from(bytes);
  let out = '';
  while (digits.some((d) => d !== 0)) {
    let remainder = 0;
    for (let i = 0; i < digits.length; i++) {
      const acc = remainder * 256 + digits[i];
      digits[i] = Math.floor(acc / 62);
      remainder = acc % 62;
    }
    out = BASE62[remainder] + out;
  }
  return out.padStart(SHARE_ID_LENGTH, '0');
}

/**
 * Copy a (possibly offset) byte view into a standalone ArrayBuffer. `crypto.subtle`
 * wants a `BufferSource` backed by `ArrayBuffer`, but TS types a plain `Uint8Array`
 * over `ArrayBufferLike` (which includes `SharedArrayBuffer`); these bytes are never
 * shared, so materializing an `ArrayBuffer` is both correct and type-clean.
 */
function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Derive the storage id from the key: `base62(truncate(SHA-256(key), ID_BYTES))`.
 * Deterministic — the same key always yields the same id — so the client can
 * derive the id locally and the server never needs (or sees) the key.
 */
export async function deriveShareId(key: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', asBuffer(key)));
  return bytesToBase62(digest.subarray(0, ID_BYTES));
}

// --- authenticated encryption ------------------------------------------------

function importAesKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBuffer(key), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt `plaintext` under `key`, returning a base64url token of `iv || ciphertext`
 * (the 12-byte GCM IV — not secret — prepended to the GCM output, which already
 * carries its auth tag). A fresh random IV per call means encrypting the same
 * payload twice yields distinct blobs.
 */
export async function encryptWorkspace(plaintext: string, key: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cryptoKey = await importAesKey(key);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBuffer(iv) },
      cryptoKey,
      asBuffer(new TextEncoder().encode(plaintext)),
    ),
  );
  const blob = new Uint8Array(iv.length + ciphertext.length);
  blob.set(iv, 0);
  blob.set(ciphertext, iv.length);
  return bytesToBase64Url(blob);
}

/**
 * Decrypt a blob produced by {@link encryptWorkspace}. Returns null — never throws —
 * on any failure: malformed base64url, a blob too short to hold the IV, or a GCM
 * auth-tag mismatch (wrong key or tampered ciphertext). Callers treat null as an
 * unreadable / corrupt link.
 */
export async function decryptWorkspace(blob: string, key: Uint8Array): Promise<string | null> {
  const bytes = base64UrlToBytes(blob);
  if (bytes === null || bytes.length <= IV_BYTES) return null;
  const iv = bytes.subarray(0, IV_BYTES);
  const ciphertext = bytes.subarray(IV_BYTES);
  try {
    const cryptoKey = await importAesKey(key);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBuffer(iv) },
      cryptoKey,
      asBuffer(ciphertext),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch {
    return null;
  }
}
