// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Service-worker version stamping (#451). The build's `prebuild` step stamps
// `ui/public/sw.js` with the root `package.json` version so every release changes
// the worker's bytes and triggers the update-toast flow. These tests pin the
// stamping transform and assert the *built* sw.js version matches package.json.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stampServiceWorker, PRECACHE_PREFIX } from '../../scripts/stamp-sw.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(here, '..', 'public', 'sw.js');
const pkgPath = path.join(here, '..', '..', 'package.json');

const swSource = readFileSync(swPath, 'utf8');
const rootVersion: string = JSON.parse(readFileSync(pkgPath, 'utf8')).version;

const swVersionOf = (src: string) => src.match(/const SW_VERSION = '([^']*)';/)?.[1];
const precacheOf = (src: string) => src.match(/const PRECACHE_NAME = '([^']*)';/)?.[1];

describe('service-worker stamping (#451)', () => {
  it('injects an arbitrary version into SW_VERSION and the precache name', () => {
    const stamped = stampServiceWorker(swSource, '9.9.9');
    expect(swVersionOf(stamped)).toBe('9.9.9');
    expect(precacheOf(stamped)).toBe(`${PRECACHE_PREFIX}9.9.9`);
  });

  it('is idempotent (stamping an already-stamped file is a no-op)', () => {
    const once = stampServiceWorker(swSource, '2.0.0');
    const twice = stampServiceWorker(once, '2.0.0');
    expect(twice).toBe(once);
  });

  it('built sw.js version matches the root package.json version', () => {
    // What the prebuild produces at release time — the invariant that guarantees
    // every published release ships a byte-changed, update-triggering worker.
    const built = stampServiceWorker(swSource, rootVersion);
    expect(swVersionOf(built)).toBe(rootVersion);
    expect(precacheOf(built)).toBe(`${PRECACHE_PREFIX}${rootVersion}`);
  });

  it('keeps the committed sw.js in sync with package.json', () => {
    // The prebuild stamps at build time, but the committed source should already
    // match so a local `next start` (or a stale checkout) serves the right worker.
    expect(swVersionOf(swSource)).toBe(rootVersion);
    expect(precacheOf(swSource)).toBe(`${PRECACHE_PREFIX}${rootVersion}`);
  });
});
