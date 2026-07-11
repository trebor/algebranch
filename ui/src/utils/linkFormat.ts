// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Encoder for the hand-authored `?eq=` deep link (#501), used by the /link-format
// spec page's worked examples so the documented encoding can never drift from one
// that actually round-trips. This is the human/agent-writable form — the app also
// mints opaque Base64URL share tokens (see eqParam.ts), but an agent constructing
// a link mid-conversation writes the readable `?eq=<equation>` form and needs the
// encoding rule spelled out.
//
// The rule (matching AGENTS.md): encodeURIComponent handles the round-trip-hostile
// characters `=` `/` `+` `,` (a raw `+` form-decodes to a space, corrupting sums),
// but it leaves `(` `)` `*` raw — and most terminals drop a trailing `)` from a
// clickable link. Encode those three too so the whole URL stays clickable and
// survives the share round-trip.
import { SITE_URL } from '../constants/site';

const EXTRA_ENCODE: Record<string, string> = {
  '(': '%28',
  ')': '%29',
  '*': '%2A',
};

/** Percent-encode an equation string for the readable `?eq=` deep-link form. */
export const encodeEqForUrl = (equationString: string): string =>
  encodeURIComponent(equationString).replace(/[()*]/g, (c) => EXTRA_ENCODE[c]);

/** Build the full canonical `?eq=` deep link for an equation string. */
export const buildEqUrl = (equationString: string): string =>
  `${SITE_URL}/?eq=${encodeEqForUrl(equationString)}`;
