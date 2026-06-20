#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris
/**
 * shoot-hero.mjs — capture the README "hero" screenshot from a shared workspace.
 *
 * The hero is a deliberately dense frame: a graphable equation, a live graph,
 * a branching history tree, and the full set of colored handles (move / simplify
 * / substitute). Producing it is half creative (you build the scene in the app)
 * and half mechanical (this script). This file automates the mechanical half and
 * documents the gotchas; see docs/screenshots/README.md for the full runbook.
 *
 * Why this isn't just `shoot.mjs --url <ws-link>`:
 *
 *   1. A `?ws=` "share workspace" link serializes only the ACTIVE tab's history
 *      tree (ui/src/app/page.tsx, getCompressedWorkspace). Sibling tabs do not
 *      travel in it. Substitution handles, however, require a *fact* — a variable
 *      isolated in ANOTHER tab (e.g. `x = sqrt(5)`). So to get the teal handles
 *      we recreate that fact tab here and merge it into the workspace via
 *      localStorage (algebranch_workspace_tabs), then reload.
 *
 *   2. The graph is viable only when the active equation has exactly ONE variable
 *      (isGraphViableAtom). The fact must therefore live in its own tab, never in
 *      the hero equation — which is exactly what the merge above arranges.
 *
 *   3. The graph panel's open/closed state is UI, not part of the share link, so
 *      it always loads closed. We press "g" to pop it open (short "split" view).
 *
 * The human owns the dev server (see AGENTS.md): start `npm run dev` first.
 *
 * Usage:
 *   npm run shoot:hero -- --ws "http://localhost:3000/?ws=…" --fact "x = sqrt(5)"
 *   npm run shoot:hero -- --ws-file screenshots/ws_url.txt --out docs/screenshots/hero.png
 *   npm run shoot:hero -- --ws "<link>" --no-graph        # graph closed
 *
 * Options:
 *   --ws <url>         The full ?ws= workspace share link.
 *   --ws-file <path>   Read the link from a file instead (avoids shell-quoting a
 *                      ~1.5 KB blob; the safest way to pass it exactly).
 *   --fact <equation>  Substitution fact to add as a second tab, e.g. "x = sqrt(5)".
 *                      Omit to skip the teal substitution handles.
 *   --out <path>       Output PNG (default screenshots/hero.png; screenshots/ is gitignored).
 *   --base <url>       Base URL (default http://localhost:3000).
 *   --width <px>       Viewport width  (default 1440).
 *   --height <px>      Viewport height (default 900).
 *   --graph            Open the graph panel (default is to leave it closed).
 *   --settle <ms>      Extra wait after each navigation (default 900).
 */

import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    // Boolean flags take no value.
    if (key === 'graph' || key === 'open-graph') {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const base = args.base ?? 'http://localhost:3000';
const out = args.out ?? 'screenshots/hero.png';
const width = Number(args.width ?? 1440);
const height = Number(args.height ?? 900);
const settle = Number(args.settle ?? 900);
const openGraph = Boolean(args.graph || args['open-graph']);

let ws = args.ws;
if (!ws && args['ws-file']) ws = (await readFile(args['ws-file'], 'utf8')).trim();
if (!ws) {
  console.error('Provide the workspace link with --ws "<url>" or --ws-file <path>.');
  process.exit(1);
}

const readTabs = (page) =>
  page.evaluate(() => localStorage.getItem('algebranch_workspace_tabs'));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  // Suppress the first-visit onboarding overlay.
  await page.addInitScript(() => {
    try { localStorage.setItem('algebranch_onboarding_completed', 'true'); } catch { /* ignore */ }
  });

  const load = async (url) => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('[data-flip-id]', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(settle);
  };

  if (args.fact) {
    // 1. Build the fact tab and let the app serialize it correctly.
    await load(`${base}/?eq=${encodeURIComponent(args.fact)}`);
    const factTabs = await readTabs(page);
    // 2. Load the hero workspace (its single active tab + full history).
    await load(ws);
    const heroTabs = await readTabs(page);
    // 3. Merge the fact tab in alongside the hero, hero active.
    await page.evaluate(({ factStr, heroStr }) => {
      const fact = JSON.parse(factStr);
      const hero = JSON.parse(heroStr);
      const heroTab = hero[0];
      const factTab = fact[0];
      if (factTab.id === heroTab.id) factTab.id = `${factTab.id}_fact`;
      localStorage.setItem('algebranch_workspace_tabs', JSON.stringify([heroTab, factTab]));
      localStorage.setItem('algebranch_active_tab_id', heroTab.id);
    }, { factStr: factTabs, heroStr: heroTabs });
    // 4. Reload with no URL param so the merged tabs hydrate from localStorage.
    await load(`${base}/`);
  } else {
    await load(ws);
  }

  if (openGraph) {
    await page.keyboard.press('g');
    await page.waitForTimeout(1200);
  }

  // Freeze animations for a clean, deterministic frame.
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  await page.waitForTimeout(300);

  await mkdir(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(`Wrote ${out}  (${width}x${height} @2x)`);
} finally {
  await browser.close();
}
