// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Pure helpers for turning in-app feedback into a pre-populated GitHub issue.
// Kept free of React/store/engine imports so they can be unit-tested directly.

const ISSUES_NEW_URL = 'https://github.com/trebor/algebranch/issues/new';

export type DeviceType = 'Desktop' | 'Mobile' | 'Tablet';

export type FeedbackType = 'bug' | 'feature';

/** What the user chose to attach to their report, via the share selector. */
export type ShareMode = 'workspace' | 'equation' | 'none';

export interface FeedbackPayload {
  type: FeedbackType;
  subject: string;
  message: string;
  /** 1–5 star rating, or 0 when the user did not rate. */
  rating: number;
  /** App context line (e.g. the active equation), or null when absent. */
  context: string | null;
  /** Flat list of the algebra steps taken to reach the current equation. */
  steps: string;
  /** The link the user chose to share: a `?ws=`/`?eq=` URL, or '' for nothing. */
  shareLink: string;
  device: DeviceType;
  browser: string;
  os: string;
  userAgent: string;
}

export interface ClientEnv {
  device: DeviceType;
  browser: string;
  os: string;
}

/**
 * Build a deep link that reloads the exact workspace (resolves the goal of #170).
 * Returns '' when either piece is missing so callers can omit the line.
 */
export const buildWorkspaceUrl = (origin: string, compressed: string): string =>
  origin && compressed ? `${origin}/?ws=${compressed}` : '';

// Mirror ShareMenu's encoding: encodeURIComponent leaves ()*!' raw, which break
// the link round-trip / terminal clickability, so percent-encode them too.
const encodeEqSafe = (s: string): string =>
  encodeURIComponent(s).replace(/[()*!']/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/**
 * Build a `?eq=` deep link for the current equation only (the lighter share
 * option). Returns '' when either piece is missing so callers can omit the line.
 */
export const buildEquationUrl = (origin: string, equationString: string): string =>
  origin && equationString ? `${origin}/?eq=${encodeEqSafe(equationString)}` : '';

/** Map a viewport width to the device-type field values in bug_report.yml. */
export const detectDeviceType = (width: number): DeviceType => {
  if (width < 640) return 'Mobile';
  if (width < 1024) return 'Tablet';
  return 'Desktop';
};

/**
 * Parse a userAgent string (plus optional viewport width and touch-point count)
 * to detect browser, OS, and device type. Kept pure — the caller supplies
 * `maxTouchPoints` (from `navigator`) rather than this module reading `window`.
 */
export const parseUserAgent = (userAgent: string, width?: number, maxTouchPoints = 0): ClientEnv => {
  // 1. Detect OS
  let os = 'Unknown OS';
  if (/Windows/i.test(userAgent)) {
    os = 'Windows';
  } else if (/Android/i.test(userAgent)) {
    os = 'Android';
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    os = 'iOS';
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    // iPad Safari can sometimes send a Macintosh user agent.
    // If it has touch capability or width < 1024, it might be an iPad.
    const isTouch = maxTouchPoints > 0;
    if (isTouch || (width !== undefined && width < 1024)) {
      os = 'iOS'; // Maps to standard iOS/iPadOS
    } else {
      os = 'macOS';
    }
  } else if (/Linux/i.test(userAgent)) {
    os = 'Linux';
  }

  // 2. Detect Browser
  let browser = 'Unknown Browser';
  if (/Firefox|FxiOS/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/Edg\/|Edge/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/OPR\/|Opera/i.test(userAgent)) {
    browser = 'Opera';
  } else if (/Chrome|CriOS/i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/Safari/i.test(userAgent)) {
    browser = 'Safari';
  }

  // 3. Detect Device
  let device: DeviceType = 'Desktop';
  if (/iPad|tablet/i.test(userAgent)) {
    device = 'Tablet';
  } else if (/iPhone|iPod|Mobi/i.test(userAgent)) {
    device = 'Mobile';
  } else if (/Android/i.test(userAgent)) {
    device = /Mobile/i.test(userAgent) ? 'Mobile' : 'Tablet';
  }

  // Override device based on viewport width if present
  if (width !== undefined) {
    if (width < 640) {
      device = 'Mobile';
    } else if (width < 1024 && device === 'Desktop') {
      device = 'Tablet';
    }
  }

  return { device, browser, os };
};

// Emit the rating as a bare 1–5 number so the `rating` form field stays clean
// and extractable (the "stars" wording lives in the field label). Returns ''
// when unrated so the field is omitted/left blank rather than reading "0".
const formatRating = (rating: number): string =>
  rating > 0 ? String(rating) : '';

// Leads the auto-filled bug repro so the captured algebra steps don't read as
// the whole story — we still want a narrative of what went wrong.
const REPRO_PROMPT =
  'In your own words, describe what you did and what went wrong — including anything outside the algebra steps below.';

/** Join the non-empty parts with a separator (drops blanks). */
const joinParts = (parts: (string | null | undefined)[], sep: string): string =>
  parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);

/** Append only the non-empty params (GitHub ignores blanks, but keep URLs lean). */
const toUrl = (base: string, params: Record<string, string>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `${base}?${search.toString()}`;
};

/**
 * Construct a pre-populated GitHub new-issue URL from feedback inputs, mapping
 * fields to the `id`s in `.github/ISSUE_TEMPLATE/*.yml`. Only `input`/`textarea`
 * fields are used — GitHub does not prefill dropdowns via query params, which is
 * why device/rating are plain text fields the app fills in.
 */
export const buildGithubIssueUrl = (payload: FeedbackPayload): string => {
  const { subject, message, rating, context, steps, shareLink, device, browser, os, userAgent } = payload;

  if (payload.type === 'bug') {
    return toUrl(ISSUES_NEW_URL, {
      template: 'bug_report.yml',
      title: `bug: ${subject}`,
      'what-happened': message,
      repro: joinParts(
        [REPRO_PROMPT, steps ? `Algebra steps taken to reach this point:\n${steps}` : ''],
        '\n\n'
      ),
      'share-link': shareLink,
      device,
      browser,
      os,
      'user-agent': userAgent,
      rating: formatRating(rating),
      // `screenshots` is intentionally left blank for the user to fill — we
      // don't pre-fill it with the equation (already in `repro`/`share-link`).
    });
  }

  return toUrl(ISSUES_NEW_URL, {
    template: 'feature_request.yml',
    title: `feat: ${subject}`,
    problem: message,
    proposal: joinParts(
      [
        context ? `App context: ${context}` : '',
        steps ? `Steps taken:\n${steps}` : '',
      ],
      '\n\n'
    ),
    'share-link': shareLink,
    rating: formatRating(rating),
  });
};

