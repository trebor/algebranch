// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Client crypto for first-party zero-knowledge short links (#480). The whole
// zero-knowledge promise rests on this module: the AES-128-GCM key is generated
// and used only client-side and rides in the URL *fragment*; the server ever sees
// only the derived `id` and the ciphertext. These tests pin the contract that
// makes that safe — deterministic id derivation, an authenticating round-trip
// that rejects the wrong key / tampering, and a fragment codec that round-trips
// exactly. Runs under `node` for real Web Crypto (jsdom lacks `crypto.subtle`).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  KEY_BYTES,
  SHARE_ID_LENGTH,
  SHARE_ID_PATTERN,
  generateShareKey,
  keyToFragment,
  fragmentToKey,
  deriveShareId,
  encryptWorkspace,
  decryptWorkspace,
} from '@/utils/shareCrypto';

// Independent base62 of the first ID_BYTES of a digest, so the id test validates
// against a from-scratch computation rather than the module's own arithmetic.
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_BYTES = 10;
function expectedId(key: Uint8Array): string {
  const digest = createHash('sha256').update(Buffer.from(key)).digest();
  // BigInt via constructor (not `0n` literals) so this compiles at the ES2017
  // tsconfig target; independent of the module's base-256 long division.
  const TWO_FIFTY_SIX = BigInt(256);
  const SIXTY_TWO = BigInt(62);
  let n = BigInt(0);
  for (const b of digest.subarray(0, ID_BYTES)) n = n * TWO_FIFTY_SIX + BigInt(b);
  let out = '';
  while (n > BigInt(0)) {
    out = BASE62[Number(n % SIXTY_TWO)] + out;
    n = n / SIXTY_TWO;
  }
  return out.padStart(SHARE_ID_LENGTH, '0');
}

describe('shareCrypto key generation & fragment codec', () => {
  it('generates a 16-byte (AES-128) key', () => {
    const key = generateShareKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(KEY_BYTES);
    expect(KEY_BYTES).toBe(16);
  });

  it('generates a fresh key each call', () => {
    const a = keyToFragment(generateShareKey());
    const b = keyToFragment(generateShareKey());
    expect(a).not.toBe(b);
  });

  it('round-trips key ↔ fragment as a 22-char base64url token', () => {
    const key = generateShareKey();
    const fragment = keyToFragment(key);
    expect(fragment).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes, no padding
    expect(Array.from(fragmentToKey(fragment)!)).toEqual(Array.from(key));
  });

  it('rejects a malformed fragment (wrong length / bad alphabet) as null', () => {
    expect(fragmentToKey('')).toBeNull();
    expect(fragmentToKey('too-short')).toBeNull();
    expect(fragmentToKey('!'.repeat(22))).toBeNull();
    // Valid base64url but decoding to the wrong byte count is not a 128-bit key.
    expect(fragmentToKey(keyToFragment(new Uint8Array(8)))).toBeNull();
  });
});

describe('shareCrypto id derivation', () => {
  it('derives a fixed-length base62 id deterministically from the key', async () => {
    const key = generateShareKey();
    const id = await deriveShareId(key);
    expect(id).toMatch(SHARE_ID_PATTERN);
    expect(id.length).toBe(SHARE_ID_LENGTH);
    expect(await deriveShareId(key)).toBe(id); // deterministic
  });

  it('matches an independent base62(truncate(SHA-256(key))) computation', async () => {
    const key = generateShareKey();
    expect(await deriveShareId(key)).toBe(expectedId(key));
  });

  it('changes the id when a single key bit flips (avalanche)', async () => {
    const key = generateShareKey();
    const flipped = Uint8Array.from(key);
    flipped[0] ^= 0x01;
    expect(await deriveShareId(flipped)).not.toBe(await deriveShareId(key));
  });

  it('SHARE_ID_PATTERN rejects wrong-shape ids', () => {
    expect(SHARE_ID_PATTERN.test('0'.repeat(SHARE_ID_LENGTH))).toBe(true);
    expect(SHARE_ID_PATTERN.test('0'.repeat(SHARE_ID_LENGTH - 1))).toBe(false);
    expect(SHARE_ID_PATTERN.test('0'.repeat(SHARE_ID_LENGTH + 1))).toBe(false);
    expect(SHARE_ID_PATTERN.test('-'.repeat(SHARE_ID_LENGTH))).toBe(false); // base62, not base64url
    expect(SHARE_ID_PATTERN.test('')).toBe(false);
  });
});

describe('shareCrypto encrypt/decrypt round-trip', () => {
  it('round-trips a payload through the same key', async () => {
    const key = generateShareKey();
    const plaintext = 'ws payload — with unicode ∛ and emoji 🧮';
    const blob = await encryptWorkspace(plaintext, key);
    expect(await decryptWorkspace(blob, key)).toBe(plaintext);
  });

  it('produces a fresh ciphertext each time (random IV) that still decrypts', async () => {
    const key = generateShareKey();
    const plaintext = 'same input twice';
    const a = await encryptWorkspace(plaintext, key);
    const b = await encryptWorkspace(plaintext, key);
    expect(a).not.toBe(b); // 12-byte random IV prepended → distinct blobs
    expect(await decryptWorkspace(a, key)).toBe(plaintext);
    expect(await decryptWorkspace(b, key)).toBe(plaintext);
  });

  it('returns null when decrypting with the wrong key (GCM auth failure)', async () => {
    const blob = await encryptWorkspace('secret work', generateShareKey());
    expect(await decryptWorkspace(blob, generateShareKey())).toBeNull();
  });

  it('returns null when the ciphertext is tampered', async () => {
    const key = generateShareKey();
    const blob = await encryptWorkspace('secret work', key);
    // Flip a char in the middle of the blob (past the IV) → auth tag mismatch.
    const i = Math.floor(blob.length / 2);
    const tampered =
      blob.slice(0, i) + (blob[i] === 'A' ? 'B' : 'A') + blob.slice(i + 1);
    expect(await decryptWorkspace(tampered, key)).toBeNull();
  });

  it('returns null for a malformed / too-short blob', async () => {
    const key = generateShareKey();
    expect(await decryptWorkspace('', key)).toBeNull();
    expect(await decryptWorkspace('!!!not-base64!!!', key)).toBeNull();
    expect(await decryptWorkspace('AAAA', key)).toBeNull(); // shorter than a 12-byte IV
  });
});
