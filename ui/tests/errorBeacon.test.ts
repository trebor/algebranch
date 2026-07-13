// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Client half of the error beacon (#505 tranche B). The scrubber is the privacy
// boundary — equation content and share keys ride in URL queries (`?eq=`, `?ws=`)
// and fragments (`/s#<key>`), so every URL in an error message or stack frame must
// lose its query and fragment before the signature leaves the browser. These tests
// pin the scrubber hard, then the signature builder and the listener wiring around
// it (dedupe + per-page cap so an error loop can't flood the endpoint).
import { describe, it, expect, vi } from 'vitest';
import {
  scrubUrlText,
  uaFamily,
  topStackFrame,
  buildErrorSignature,
  createErrorReporter,
  initErrorBeacon,
  reportBoundaryError,
  MAX_SIGNATURE_FIELD_CHARS,
  MAX_BEACONS_PER_PAGE,
  type ErrorSignature,
} from '@/utils/errorBeacon';

describe('scrubUrlText (the privacy boundary)', () => {
  it('strips the query from an absolute URL', () => {
    expect(scrubUrlText('failed at https://algebranch.org/?eq=2x%2B1%3D5 today')).toBe(
      'failed at https://algebranch.org/ today',
    );
  });

  it('strips the fragment — the share key must never leave the client', () => {
    expect(scrubUrlText('loading https://algebranch.org/s#AbCdEf0123456789AbCdEf')).toBe(
      'loading https://algebranch.org/s',
    );
  });

  it('strips query and fragment together', () => {
    expect(scrubUrlText('https://algebranch.org/s?ws=payload#secretkey')).toBe(
      'https://algebranch.org/s',
    );
  });

  it('scrubs every URL in a string, not just the first', () => {
    expect(
      scrubUrlText('from https://a.org/?eq=x to https://b.org/s#key end'),
    ).toBe('from https://a.org/ to https://b.org/s end');
  });

  it('preserves the line:col of a clean stack-frame URL', () => {
    const frame = 'at fn (https://algebranch.org/_next/static/chunks/main-abc123.js:12:34)';
    expect(scrubUrlText(frame)).toBe(frame);
  });

  it('strips the value of a bare ?eq=/?ws= param with no scheme', () => {
    expect(scrubUrlText('could not parse ?eq=2x%2B1%3D5')).toBe('could not parse ?eq=');
    expect(scrubUrlText('bad payload in ?ws=N4IgzgpgTgxg')).toBe('bad payload in ?ws=');
  });

  it('strips a scheme-less /s# fragment key', () => {
    expect(scrubUrlText('resolving algebranch.org/s#AbCdEf0123456789')).toBe(
      'resolving algebranch.org/s',
    );
  });

  it('leaves URL-free text untouched', () => {
    const plain = "Cannot read properties of undefined (reading 'foo')";
    expect(scrubUrlText(plain)).toBe(plain);
  });
});

describe('uaFamily', () => {
  const CHROME_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
  const SAFARI =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const EDGE =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
  const CHROME_ANDROID =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const SAFARI_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

  it('classifies the major desktop families', () => {
    expect(uaFamily(CHROME_MAC)).toBe('Chrome');
    expect(uaFamily(FIREFOX)).toBe('Firefox');
    expect(uaFamily(SAFARI)).toBe('Safari');
    expect(uaFamily(EDGE)).toBe('Edge');
  });

  it('flags mobile variants', () => {
    expect(uaFamily(CHROME_ANDROID)).toBe('Chrome Mobile');
    expect(uaFamily(SAFARI_IOS)).toBe('Safari Mobile');
  });

  it('falls back to Other for anything unrecognized', () => {
    expect(uaFamily('SomeBot/1.0')).toBe('Other');
  });
});

describe('topStackFrame', () => {
  it('returns the first frame line of a V8 stack (skipping the message line)', () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'foo')",
      '    at renderStep (https://algebranch.org/_next/static/chunks/main.js:12:34)',
      '    at outer (https://algebranch.org/_next/static/chunks/main.js:56:78)',
    ].join('\n');
    expect(topStackFrame(stack)).toBe(
      'at renderStep (https://algebranch.org/_next/static/chunks/main.js:12:34)',
    );
  });

  it('returns the first line of a Firefox-style stack', () => {
    const stack = 'renderStep@https://algebranch.org/main.js:12:34\nouter@https://algebranch.org/main.js:56:78';
    expect(topStackFrame(stack)).toBe('renderStep@https://algebranch.org/main.js:12:34');
  });

  it('returns an empty string when there is no stack', () => {
    expect(topStackFrame(undefined)).toBe('');
    expect(topStackFrame('')).toBe('');
  });
});

describe('buildErrorSignature', () => {
  it('composes scrubbed message + top frame with version and UA family', () => {
    const sig = buildErrorSignature({
      message: 'boom at https://algebranch.org/?eq=x%3D1',
      stack: 'Error: boom\n    at f (https://algebranch.org/s?ws=abc#key:1:2)',
      version: '1.4.2',
      userAgent: 'Mozilla/5.0 Firefox/127.0',
    });
    expect(sig).toEqual({
      message: 'boom at https://algebranch.org/',
      topFrame: 'at f (https://algebranch.org/s)',
      version: '1.4.2',
      uaFamily: 'Firefox',
    });
  });

  it('truncates over-long fields', () => {
    const sig = buildErrorSignature({
      message: 'x'.repeat(MAX_SIGNATURE_FIELD_CHARS + 100),
      stack: undefined,
      version: '1.4.2',
      userAgent: '',
    });
    expect(sig.message).toHaveLength(MAX_SIGNATURE_FIELD_CHARS);
  });
});

describe('createErrorReporter', () => {
  const deps = { version: '1.4.2', userAgent: 'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36' };

  it('sends a built signature through the injected sender', () => {
    const send = vi.fn();
    const report = createErrorReporter({ ...deps, send });
    report({ message: 'boom', stack: 'Error: boom\n    at f (https://a.org/x.js:1:2)' });
    expect(send).toHaveBeenCalledTimes(1);
    const sig = send.mock.calls[0][0] as ErrorSignature;
    expect(sig.message).toBe('boom');
    expect(sig.topFrame).toBe('at f (https://a.org/x.js:1:2)');
  });

  it('dedupes identical signatures — the same error twice sends once', () => {
    const send = vi.fn();
    const report = createErrorReporter({ ...deps, send });
    report({ message: 'boom' });
    report({ message: 'boom' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('caps sends per page load so an error loop cannot flood', () => {
    const send = vi.fn();
    const report = createErrorReporter({ ...deps, send });
    for (let i = 0; i < MAX_BEACONS_PER_PAGE + 10; i++) {
      report({ message: `distinct error ${i}` });
    }
    expect(send).toHaveBeenCalledTimes(MAX_BEACONS_PER_PAGE);
  });
});

describe('initErrorBeacon', () => {
  const deps = { version: '1.4.2', userAgent: 'Mozilla/5.0 Firefox/127.0' };

  it('reports an uncaught error (window error event)', () => {
    const send = vi.fn();
    const target = new EventTarget();
    const cleanup = initErrorBeacon(target, createErrorReporter({ ...deps, send }));
    target.dispatchEvent(
      new ErrorEvent('error', { message: 'boom', error: new Error('boom') }),
    );
    cleanup();
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as ErrorSignature).message).toBe('boom');
  });

  it('reports an unhandled rejection with an Error reason', () => {
    const send = vi.fn();
    const target = new EventTarget();
    const cleanup = initErrorBeacon(target, createErrorReporter({ ...deps, send }));
    const event = new Event('unhandledrejection') as Event & { reason?: unknown };
    event.reason = new Error('rejected hard');
    target.dispatchEvent(event);
    cleanup();
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as ErrorSignature).message).toBe('rejected hard');
  });

  it('reports a non-Error rejection reason as its string form', () => {
    const send = vi.fn();
    const target = new EventTarget();
    const cleanup = initErrorBeacon(target, createErrorReporter({ ...deps, send }));
    const event = new Event('unhandledrejection') as Event & { reason?: unknown };
    event.reason = 'plain string reason';
    target.dispatchEvent(event);
    cleanup();
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as ErrorSignature).message).toBe('plain string reason');
  });

  it('reports a boundary-caught error through the same reporter path', () => {
    const report = vi.fn();
    reportBoundaryError(new Error('render blew up'), report);
    expect(report).toHaveBeenCalledWith({
      message: 'render blew up',
      stack: expect.stringContaining('render blew up'),
    });
    reportBoundaryError('thrown string', report);
    expect(report).toHaveBeenCalledWith({ message: 'thrown string' });
  });

  it('cleanup removes both listeners', () => {
    const send = vi.fn();
    const target = new EventTarget();
    const cleanup = initErrorBeacon(target, createErrorReporter({ ...deps, send }));
    cleanup();
    target.dispatchEvent(new ErrorEvent('error', { message: 'boom', error: new Error('boom') }));
    const event = new Event('unhandledrejection') as Event & { reason?: unknown };
    event.reason = new Error('late');
    target.dispatchEvent(event);
    expect(send).not.toHaveBeenCalled();
  });
});
