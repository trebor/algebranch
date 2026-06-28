#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris
/**
 * shoot.mjs — headless screenshot helper for visually verifying UI changes.
 *
 * Renders the running app in headless Chromium and writes a PNG an agent (or
 * human) can eyeball. A screenshot is a faithful render of the real app — real
 * CSS, real layout — so it's the trustworthy way to check visual/layout work
 * (e.g. handle crowding, baseline alignment) rather than reasoning about
 * em/rem math by hand.
 *
 * The human owns the dev server (see AGENTS.md): start `npm run dev` first,
 * then point this at http://localhost:3000.
 *
 * Usage:
 *   npm run shoot -- --eq "sqrt(4*9)+x=12"
 *   npm run shoot -- --eq "x^2-9=0" --width 480 --height 360 --out screenshots/small.png
 *   npm run shoot -- --eq "sqrt(4*9)+x=12" --no-motion --hover "[data-path='lhs/args/0']"
 *
 * Options:
 *   --eq <raw>         Equation; URL-encoded (encodeURIComponent) and appended as ?eq=...
 *   --url <full>       Full URL to visit (overrides --eq + --base)
 *   --base <url>       Base URL (default http://localhost:3000)
 *   --out <path>       Output PNG path (default screenshots/shot.png; screenshots/ is gitignored)
 *   --width <px>       Viewport width  (default 1280) — drives the 0.4–2.8x useMathScale auto-scaler
 *   --height <px>      Viewport height (default 800)
 *   --hover <selector> CSS selector to hover before capturing (e.g. reveal hover-gated handles)
 *   --click <selector> CSS selector to click before capturing
 *   --selector <sel>   Clip the screenshot to this element instead of the viewport
 *   --settle <ms>      Extra wait after load/interaction (default 400)
 *   --no-motion        Disable CSS animations/transitions for a clean, deterministic static frame
 *   --full-page        Capture the full scrollable page instead of just the viewport
 *   --show-onboarding  Let the first-visit onboarding tour render (suppressed by default)
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    // Boolean flags take no value.
    if (key === 'no-motion' || key === 'full-page' || key === 'show-onboarding') {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const defaultBase = process.cwd().includes('/gemini/') ? 'http://localhost:3001' : 'http://localhost:3000';
const base = args.base ?? defaultBase;
const out = args.out ?? 'screenshots/shot.png';
const width = Number(args.width ?? 1280);
const height = Number(args.height ?? 800);
const settle = Number(args.settle ?? 400);

let url = args.url;
if (!url) {
  // Encode the equation exactly like the app's share links: encodeURIComponent
  // covers the round-trip cases (= / + , etc.) the share-link decoder needs.
  url = args.eq ? `${base}/?eq=${encodeURIComponent(args.eq)}` : base;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height } });

  // Suppress the first-visit onboarding tour (it overlays the equation) by
  // pre-seeding the localStorage flag the app checks on mount. Runs before any
  // page script on every navigation. Opt out with --show-onboarding.
  // Pre-seed localStorage to avoid blocking/cluttering overlays.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('algebranch_consent', 'granted');
    } catch { /* localStorage may be blocked */ }
  });

  if (!args['show-onboarding']) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('algebranch_onboarding_completed', 'true');
      } catch { /* localStorage may be blocked; tour will just render */ }
    });
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (err) {
    console.error(`\nFailed to load ${url}`);
    console.error('Is the dev server running? Start it with:  npm run dev\n');
    throw err;
  }

  // Wait for the equation tree to mount (every node carries data-flip-id).
  await page.waitForSelector('[data-flip-id]', { timeout: 10000 }).catch(() => {
    console.warn('Warning: no equation nodes ([data-flip-id]) found — capturing anyway.');
  });

  if (args['no-motion']) {
    await page.addStyleTag({
      content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
    });
  }

  if (args.hover) await page.hover(args.hover);
  if (args.click) await page.click(args.click);

  // Let the auto-scaler settle and any (non-disabled) transitions finish.
  await page.waitForTimeout(settle);

  await mkdir(dirname(out), { recursive: true });

  const target = args.selector ? page.locator(args.selector) : page;
  await target.screenshot({ path: out, fullPage: !args.selector && Boolean(args['full-page']) });

  console.log(`Wrote ${out}  (${width}x${height})  ${url}`);
} finally {
  await browser.close();
}
