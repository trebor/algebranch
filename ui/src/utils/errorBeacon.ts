// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Client half of the first-party error beacon (#505 tranche B): build a minimal,
// privacy-clean *signature* of an uncaught error and POST it to `/api/errbeacon`,
// where it becomes one server log line. Chosen over any third-party collector so
// nothing ever leaves our infrastructure.
//
// `scrubUrlText` is the privacy boundary. Equation content and share keys travel
// in URLs — `?eq=`/`?ws=` queries and the `/s#<key>` fragment (which must never
// leave the client at all) — and error messages and stack frames routinely embed
// the page URL. Every URL is therefore stripped of its query and fragment before
// the signature is built. The scrub is deliberately aggressive: when a stack-frame
// URL carries a query, the line:col suffix after it is sacrificed too — losing a
// line number is acceptable, leaking an equation is not. The server re-runs the
// same scrub defensively (`errbeaconApi.ts`), so the guarantee holds even for
// hand-crafted POSTs.

import { APP_VERSION } from '../constants/version';

/** Per-field character cap — keeps one signature to a bounded log line. */
export const MAX_SIGNATURE_FIELD_CHARS = 500;

/** Per-page-load send cap so a render/error loop cannot flood the endpoint. */
export const MAX_BEACONS_PER_PAGE = 5;

/**
 * What the beacon sends — and the *whole* of what it sends: no page URL, no
 * full stack, no identifiers. Enough to answer "which error, which build, which
 * browser family" on launch day; nothing that could carry equation content.
 */
export interface ErrorSignature {
  message: string;
  topFrame: string;
  version: string;
  uaFamily: string;
}

/**
 * Strip the query and fragment from every URL-ish token in `text`. Three passes:
 * absolute `http(s)` URLs, bare `?eq=`/`?ws=` params quoted without a scheme, and
 * the scheme-less `…/s#<key>` share path. Anything after `?` or `#` is cut to the
 * end of the token (whitespace or a bracketing/quote character).
 */
export function scrubUrlText(text: string): string {
  return text
    .replace(/(https?:\/\/[^\s'"<>()?#]*)[?#][^\s'"<>()]*/g, '$1')
    .replace(/(\?(?:eq|ws)=)[^\s'"<>()]*/gi, '$1')
    .replace(/(\/s#)[^\s'"<>()]*/g, (_match, prefix: string) => prefix.slice(0, -1));
}

/**
 * Coarse browser family from a user-agent string — just enough to spot "it only
 * breaks on mobile Safari" on launch day, deliberately far short of a fingerprint.
 * Order matters: Edge and iOS-Chrome UAs also claim `Chrome`/`Safari`, and every
 * WebKit UA claims `Safari`, so the more specific tokens are tested first.
 */
export function uaFamily(userAgent: string): string {
  const mobile = /Mobi/i.test(userAgent) ? ' Mobile' : '';
  if (/Edg(?:e|A|iOS)?\//.test(userAgent)) return `Edge${mobile}`;
  if (/OPR\/|Opera/.test(userAgent)) return `Opera${mobile}`;
  if (/Firefox\/|FxiOS\//.test(userAgent)) return `Firefox${mobile}`;
  if (/Chrome\/|CriOS\//.test(userAgent)) return `Chrome${mobile}`;
  if (/Safari\//.test(userAgent)) return `Safari${mobile}`;
  return `Other${mobile}`;
}

/**
 * The first *frame* line of a stack trace — V8 stacks open with the message line
 * (`Error: …`) followed by `    at fn (url:l:c)` frames; Firefox/Safari stacks are
 * all `fn@url:l:c` frames. One frame locates the error; the full stack would just
 * multiply the URL-scrubbing surface for little diagnostic gain.
 */
export function topStackFrame(stack: string | undefined): string {
  if (!stack) return '';
  for (const raw of stack.split('\n')) {
    const line = raw.trim();
    if (/^at\s/.test(line) || /^[^\s@]*@/.test(line)) return line;
  }
  return '';
}

/** Compose the scrubbed, truncated signature from a raw error's parts. */
export function buildErrorSignature(input: {
  message: string;
  stack: string | undefined;
  version: string;
  userAgent: string;
}): ErrorSignature {
  return {
    message: scrubUrlText(input.message).slice(0, MAX_SIGNATURE_FIELD_CHARS),
    topFrame: scrubUrlText(topStackFrame(input.stack)).slice(0, MAX_SIGNATURE_FIELD_CHARS),
    version: input.version,
    uaFamily: uaFamily(input.userAgent),
  };
}

export type ErrorReporter = (candidate: { message: string; stack?: string }) => void;

/**
 * A reporter with the client-side flood guards baked in: identical signatures
 * (same message + top frame) send once, and {@link MAX_BEACONS_PER_PAGE} bounds
 * the total per page load — an error loop degrades to silence, not a flood.
 */
export function createErrorReporter(deps: {
  send: (signature: ErrorSignature) => void;
  version: string;
  userAgent: string;
}): ErrorReporter {
  const seen = new Set<string>();
  let sent = 0;
  return (candidate) => {
    if (sent >= MAX_BEACONS_PER_PAGE) return;
    const signature = buildErrorSignature({
      message: candidate.message,
      stack: candidate.stack,
      version: deps.version,
      userAgent: deps.userAgent,
    });
    const key = `${signature.message}\n${signature.topFrame}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    deps.send(signature);
  };
}

/**
 * The minimal slice of `window` the beacon depends on. Narrowing it (mirroring
 * `FetchLike` in `shareLink.ts`) lets the unit test wire a bare `EventTarget`
 * instead of the real window.
 */
export type ErrorEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/**
 * Wire the reporter to the two global escape hatches — `error` for uncaught
 * exceptions, `unhandledrejection` for promise rejections. Returns a cleanup
 * that removes both listeners (React effect contract).
 */
export function initErrorBeacon(target: ErrorEventTarget, report: ErrorReporter): () => void {
  const onError = (event: Event) => {
    const { error, message } = event as { error?: unknown; message?: string };
    report({
      message: error instanceof Error ? error.message : (message ?? String(error)),
      stack: error instanceof Error ? error.stack : undefined,
    });
  };
  const onRejection = (event: Event) => {
    const reason: unknown = (event as { reason?: unknown }).reason;
    report({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}

/**
 * Default sender: fire-and-forget POST. `keepalive` lets a beacon for a
 * teardown-time error survive navigation; failures are swallowed — the beacon
 * must never become an error source itself.
 */
export function sendErrorSignature(signature: ErrorSignature): void {
  try {
    void fetch('/api/errbeacon', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(signature),
    }).catch(() => {});
  } catch {
    // fetch itself can throw synchronously (e.g. torn-down realm) — ignore.
  }
}

let sharedReporter: ErrorReporter | undefined;

/**
 * The module-wide reporter: one dedupe set and one page cap shared by the global
 * listeners and the React error boundaries, so the same crash reported from both
 * paths still counts (and sends) once.
 */
export function sharedErrorReporter(): ErrorReporter {
  sharedReporter ??= createErrorReporter({
    send: sendErrorSignature,
    version: APP_VERSION,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  });
  return sharedReporter;
}

/**
 * Entry point for the React error boundaries (`error.tsx` / `global-error.tsx`).
 * Render errors are *caught* there — they never reach the window `error`
 * listener — yet they are exactly the "app breaks on some browser/device combo"
 * class the beacon exists for.
 */
export function reportBoundaryError(
  error: unknown,
  report: ErrorReporter = sharedErrorReporter(),
): void {
  report(
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) },
  );
}
