// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import {
  buildWorkspaceUrl,
  buildEquationUrl,
  detectDeviceType,
  buildGithubIssueUrl,
  parseUserAgent,
  FeedbackPayload,
} from '../../ui/src/utils/feedbackUrl';

const basePayload: FeedbackPayload = {
  type: 'bug',
  subject: 'Something broke',
  message: 'Clicking the term crashes the app.',
  rating: 4,
  context: 'Active Equation: x^2 - 9 = 0',
  steps: '1. (Start) x^2 - 9 = 0',
  shareLink: 'https://algebranch.org/?ws=ABC123',
  device: 'Desktop',
  browser: 'Chrome',
  os: 'macOS',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

describe('buildWorkspaceUrl', () => {
  test('builds a ?ws= URL from origin + compressed state', () => {
    expect(buildWorkspaceUrl('https://algebranch.org', 'ABC123')).toBe(
      'https://algebranch.org/?ws=ABC123'
    );
  });

  test('works for a localhost origin', () => {
    expect(buildWorkspaceUrl('http://localhost:3000', 'XYZ')).toBe(
      'http://localhost:3000/?ws=XYZ'
    );
  });

  test('returns empty string when there is no compressed workspace', () => {
    expect(buildWorkspaceUrl('https://algebranch.org', '')).toBe('');
  });

  test('returns empty string when origin is missing', () => {
    expect(buildWorkspaceUrl('', 'ABC')).toBe('');
  });
});

describe('buildEquationUrl', () => {
  test('builds a ?eq= URL, percent-encoding ()*!\' for round-trip safety', () => {
    expect(buildEquationUrl('https://algebranch.org', 'sqrt(4*9)+x=12')).toBe(
      'https://algebranch.org/?eq=sqrt%284%2A9%29%2Bx%3D12'
    );
  });

  test('returns empty string when there is no equation', () => {
    expect(buildEquationUrl('https://algebranch.org', '')).toBe('');
  });
});

describe('detectDeviceType', () => {
  test('narrow viewport is Mobile', () => {
    expect(detectDeviceType(375)).toBe('Mobile');
  });
  test('medium viewport is Tablet', () => {
    expect(detectDeviceType(820)).toBe('Tablet');
  });
  test('wide viewport is Desktop', () => {
    expect(detectDeviceType(1440)).toBe('Desktop');
  });
});

describe('parseUserAgent', () => {
  test('detects macOS and Chrome on Desktop', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua, 1440);
    expect(result.os).toBe('macOS');
    expect(result.browser).toBe('Chrome');
    expect(result.device).toBe('Desktop');
  });

  test('detects iOS and Safari on iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua, 375);
    expect(result.os).toBe('iOS');
    expect(result.browser).toBe('Safari');
    expect(result.device).toBe('Mobile');
  });

  test('detects Android and Chrome on mobile viewport', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    const result = parseUserAgent(ua, 360);
    expect(result.os).toBe('Android');
    expect(result.browser).toBe('Chrome');
    expect(result.device).toBe('Mobile');
  });

  test('treats a Macintosh UA with touch points as an iPad (iOS/Tablet)', () => {
    // iPadOS Safari often masquerades with a desktop Macintosh UA; touch points
    // and a tablet-sized viewport are how we tell it apart.
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    const result = parseUserAgent(ua, 834, 5);
    expect(result.os).toBe('iOS');
    expect(result.device).toBe('Tablet');
  });

  test('detects iPadOS/Tablet', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua, 820);
    expect(result.os).toBe('iOS');
    expect(result.browser).toBe('Safari');
    expect(result.device).toBe('Tablet');
  });
});

describe('buildGithubIssueUrl', () => {
  test('bug report targets the bug template with mapped field ids', () => {
    const url = new URL(buildGithubIssueUrl(basePayload));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/trebor/algebranch/issues/new'
    );
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('title')).toBe('bug: Something broke');
    expect(url.searchParams.get('what-happened')).toBe(basePayload.message);
    // repro leads with a narrative prompt, then the captured flat steps.
    expect(url.searchParams.get('repro')).toContain('your own words');
    expect(url.searchParams.get('repro')).toContain(basePayload.steps);
    expect(url.searchParams.get('share-link')).toBe(basePayload.shareLink);
    expect(url.searchParams.get('device')).toBe('Desktop');
    expect(url.searchParams.get('browser')).toBe('Chrome');
    expect(url.searchParams.get('os')).toBe('macOS');
    expect(url.searchParams.get('rating')).toBe('4');
    // The raw UA gets its own clean, extractable field (ground truth when the
    // parsed browser/OS fields miss an edge case).
    expect(url.searchParams.get('user-agent')).toBe(basePayload.userAgent);
    // The screenshots/extra field is left blank for the user — not pre-filled
    // with a duplicated equation or the UA.
    expect(url.searchParams.has('extra')).toBe(false);
    expect(url.searchParams.has('screenshots')).toBe(false);
  });

  test('omits the share-link field when the user shares nothing', () => {
    const url = new URL(
      buildGithubIssueUrl({ ...basePayload, shareLink: '' })
    );
    expect(url.searchParams.has('share-link')).toBe(false);
  });

  test('feature request targets the feature template with mapped field ids', () => {
    const url = new URL(buildGithubIssueUrl({ ...basePayload, type: 'feature' }));
    expect(url.searchParams.get('template')).toBe('feature_request.yml');
    expect(url.searchParams.get('title')).toBe('feat: Something broke');
    expect(url.searchParams.get('problem')).toBe(basePayload.message);
    expect(url.searchParams.get('rating')).toBe('4');
    expect(url.searchParams.get('device')).toBe('Desktop');
    expect(url.searchParams.get('browser')).toBe('Chrome');
    expect(url.searchParams.get('os')).toBe('macOS');
    expect(url.searchParams.get('user-agent')).toBe(basePayload.userAgent);
    // The chosen link lands in the common `share-link` field, not the proposal.
    expect(url.searchParams.get('share-link')).toBe(basePayload.shareLink);
    expect(url.searchParams.get('proposal')).not.toContain('Rating:');
  });

  test('not-rated payloads omit the rating field (left blank, not "0")', () => {
    const url = new URL(buildGithubIssueUrl({ ...basePayload, rating: 0 }));
    expect(url.searchParams.has('rating')).toBe(false);
  });
});

