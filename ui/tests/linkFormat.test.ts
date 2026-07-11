// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The deep-link grammar spec page (#501) shows agents/humans how to hand-mint a
// `?eq=` URL for any equation. `encodeEqForUrl` is the single encoder the page's
// worked examples render from, so the table on the page can never drift from what
// actually round-trips. It follows the AGENTS.md encoding rule: encodeURIComponent
// (covers `=` `/` `+` `,`) PLUS `(` `)` `*`, which encodeURIComponent leaves raw
// but which corrupt the share-link round-trip / clickable-URL detection.
import { describe, it, expect } from 'vitest';
import { encodeEqForUrl, buildEqUrl } from '@/utils/linkFormat';
import { SITE_URL } from '@/constants/site';

describe('encodeEqForUrl (#501)', () => {
  it('percent-encodes the round-trip-hostile characters', () => {
    expect(encodeEqForUrl('x^2-9=0')).toBe('x%5E2-9%3D0');
    expect(encodeEqForUrl('a/b')).toBe('a%2Fb');
    expect(encodeEqForUrl('1+2')).toBe('1%2B2');
    expect(encodeEqForUrl('f(x,y)')).toBe('f%28x%2Cy%29');
    expect(encodeEqForUrl('2*x')).toBe('2%2Ax');
  });

  it('leaves the raw string recoverable via a single decodeURIComponent', () => {
    for (const eq of ['sqrt(4*9)+x=12', 'x^2-9=0', '(a+b)*(a-b)', 'f(x,y)=y,x']) {
      expect(decodeURIComponent(encodeEqForUrl(eq))).toBe(eq);
    }
  });

  it('builds an absolute share URL on the canonical origin', () => {
    expect(buildEqUrl('x^2-9=0')).toBe(`${SITE_URL}/?eq=x%5E2-9%3D0`);
  });
});
