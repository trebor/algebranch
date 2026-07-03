// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Codec for the `?eq=` share link. We Base64URL-encode the equation string so
// the payload is an opaque [A-Za-z0-9-_] token: social linkifiers (Facebook,
// iMessage, WhatsApp) decode percent-escapes for display and then truncate the
// clickable link at the first decoded space/comma/`*`, dropping the tail of the
// equation. An opaque token has nothing for them to re-decode or break on.
//
// Kept free of React/store/engine imports so it stays unit-testable in isolation
// (mirrors feedbackUrl.ts). The equation-validity arbiter is injected rather than
// imported — see `decodeEqParam`.
//
// Unlike the `?ws=` workspace payload (see math-engine/compress.ts) we do NOT
// deflate first: an equation string is short enough that gzip framing usually
// makes it *larger*, so gzip stays reserved for the heavy workspace blob.

const BASE64URL_ONLY = /^[A-Za-z0-9\-_]+$/;

/** Base64URL-encode the UTF-8 bytes of a string (url-safe alphabet, no padding). */
export const encodeEqParam = (equationString: string): string => {
  const bytes = new TextEncoder().encode(equationString);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Decode a Base64URL token back to its UTF-8 string, or null when the token is
 * not well-formed Base64URL/UTF-8. Never throws. `fatal: true` makes an invalid
 * byte sequence reject (return null) rather than silently yield replacement
 * characters, so a bare token that isn't really Base64URL is caught here.
 */
const decodeBase64Url = (token: string): string | null => {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
};

/**
 * Resolve a raw `eq=` param value to the equation string.
 *
 * A value drawn purely from the Base64URL alphabet is treated as a share token:
 * we decode it and confirm the result with `isEquation` (the injected arbiter —
 * in the app, "parseEquation doesn't throw"). Anything else — hand-authored raw
 * operators, legacy percent-encoding, or a bare token that fails the equation
 * check — falls through to a single percent-decode. So `?eq=x^2-9=0` and the
 * encoded `?eq=x%5E2-9%3D0` still resolve, and a bare `?eq=x` stays `x`.
 */
export const decodeEqParam = (raw: string, isEquation: (s: string) => boolean): string => {
  if (BASE64URL_ONLY.test(raw)) {
    const decoded = decodeBase64Url(raw);
    if (decoded !== null && isEquation(decoded)) return decoded;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};
