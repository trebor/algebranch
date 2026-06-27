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
 *   --select-leftmost  After load, select the deepest node in the leftmost branch
 *                      (the leftmost lane's terminal node) so that branch reads as
 *                      the active derivation path and its equation fills the canvas.
 *   --hover-node <which>  Park a tree node's detail tooltip open for the shot:
 *                      "active"   hovers the selected node → its equation card
 *                                 (robust to the post-selection DOM reorder);
 *                      "loop"     hovers the loop (∞) bubble → "Loop Detected" card;
 *                      "leftmost" hovers the leftmost branch's terminal node → its
 *                                 equation card. No-op if the target isn't present.
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
    if (key === 'graph' || key === 'open-graph' || key === 'select-leftmost' || key === 'wider') {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const defaultBase = process.cwd().includes('/gemini/') ? 'http://localhost:3001' : 'http://localhost:3000';
const base = args.base ?? defaultBase;
const out = args.out ?? 'screenshots/hero.png';
const width = Number(args.width ?? 1440);
const height = Number(args.height ?? 900);
const settle = Number(args.settle ?? 900);
const openGraph = Boolean(args.graph || args['open-graph']);
const selectLeftmost = Boolean(args['select-leftmost']);
// --hover-node <leftmost|loop>: park a node's detail tooltip open in the frame.
const hoverNode = args['hover-node'];
const widerSidebar = Boolean(args.wider);

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
  // Suppress the first-visit onboarding overlay and the cookie-consent banner —
  // both would otherwise occlude the hero frame.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('algebranch_onboarding_completed', 'true');
      localStorage.setItem('algebranch_consent', 'denied');
    } catch { /* ignore */ }
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

  if (widerSidebar) {
    await page.keyboard.press('h');
    await page.waitForTimeout(600);
  }

  // Scope every node query to the history panel. The equation reader ALSO exposes
  // role="treeitem" for its terms, so an unscoped selector would mix canvas terms
  // in with history nodes — and pick the wrong "leftmost".
  const TREE_NODES = '[aria-label="Derivation history"] [role="treeitem"]';

  // Index the history tree's nodes by on-screen geometry. Both selection and the
  // detail-tooltip hover key off this; the loop (∞) bubble additionally matches
  // aria-label "Loop back to step …".
  const findTreeNodeIndex = (which) =>
    page.evaluate(({ sel, which }) => {
      const items = Array.from(document.querySelectorAll(sel));
      if (!items.length) return null;
      const boxes = items.map((el, i) => {
        const r = el.getBoundingClientRect();
        return { i, x: r.x, y: r.y, label: el.getAttribute('aria-label') || '' };
      });
      if (which === 'loop') {
        const loop = boxes.find((b) => /^Loop back to step/i.test(b.label));
        return loop ? loop.i : null;
      }
      // "leftmost": smallest x (the leftmost lane), then deepest (largest y) in it.
      const minX = Math.min(...boxes.map((b) => b.x));
      const lane = boxes.filter((b) => b.x - minX < 8).sort((a, b) => b.y - a.y);
      return lane.length ? lane[0].i : null;
    }, { sel: TREE_NODES, which });

  if (selectLeftmost) {
    const idx = await findTreeNodeIndex('leftmost');
    if (idx != null) {
      await page.locator(TREE_NODES).nth(idx).click();
      await page.waitForTimeout(settle); // let the canvas reflow to the new active equation
      // Selecting a node triggers scrollIntoView, which centers the active node
      // and can leave the leftmost lane clipped at the panel's left edge. Scroll
      // the tree's container fully left so that lane reads with proper margin.
      await page.evaluate(() => {
        const tree = document.querySelector('[aria-label="Derivation history"]');
        for (let el = tree; el && el !== document.body; el = el.parentElement) {
          const ox = getComputedStyle(el).overflowX;
          if (/(auto|scroll)/.test(ox) && el.scrollWidth > el.clientWidth) {
            el.scrollLeft = 0;
            return;
          }
        }
      });
      await page.waitForTimeout(300);
    } else {
      console.warn('--select-leftmost: no tree nodes found; skipping.');
    }
  }

  // Freeze animations for a clean, deterministic frame.
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  await page.waitForTimeout(300);

  // Hover LAST so the tooltip stays up through the capture (it mounts after the
  // node's 300ms hover delay; we never move the cursor again before the shot).
  if (hoverNode) {
    // "active" targets the selected node by a stable attribute — robust to the
    // DOM reorder a selection triggers (which makes nth-index hovers miss).
    let target = null;
    if (hoverNode === 'active') {
      const sel = page.locator(`${TREE_NODES}[aria-selected="true"]`).first();
      if (await sel.count()) target = sel;
    } else {
      const idx = await findTreeNodeIndex(hoverNode);
      if (idx != null) target = page.locator(TREE_NODES).nth(idx);
    }
    if (target) {
      // Park the cursor elsewhere first: after a selection click the mouse already
      // rests on the node, so hover() would fire no fresh mousemove (no tooltip).
      await page.mouse.move(8, 8);
      await page.waitForTimeout(50);
      await target.hover();
      await page.waitForTimeout(500);
    } else {
      console.warn(`--hover-node ${hoverNode}: target not found; skipping.`);
    }
  }

  await mkdir(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(`Wrote ${out}  (${width}x${height} @2x)`);
} finally {
  await browser.close();
}
