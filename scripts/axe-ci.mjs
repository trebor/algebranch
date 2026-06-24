#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris
/**
 * axe-ci.mjs — real-browser accessibility gate for CI (#238).
 *
 * The fast in-CI a11y suite (ui/tests/a11y-axe.test.tsx) runs under jsdom, so
 * axe's `color-contrast` rule is inert there — it guards accessible names /
 * roles / structure, not contrast. This runner is the slower, browser-gated
 * complement: it drives a real headless Chromium against the *built* app and
 * runs axe-core including `color-contrast`, so the WCAG AA contrast work from
 * #145 is protected against regression.
 *
 * It expects a production build already being served (CI: `npm run build` then
 * `npm run start`); the human owns the local dev server, so locally point this
 * at the running app. Exits non-zero on any violation.
 *
 *   node scripts/axe-ci.mjs                 # audits http://localhost:3000
 *   AXE_BASE_URL=http://localhost:3000 node scripts/axe-ci.mjs
 *
 * Surfaces audited: the main workspace, the consent banner (first paint), the
 * Settings modal, and the keyboard-Shortcuts overlay — the representative glass
 * surfaces whose contrast tokens live in THEME_GLASS.
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { formatAxeReport } from './axe-report.mjs';

const BASE_URL = process.env.AXE_BASE_URL ?? 'http://localhost:3000';
// A representative equation so the workspace renders real nodes/handles rather
// than the empty state. URL-encoded like the app's share links.
const SAMPLE_EQ = 'sqrt(4*9)+x=12';
const WORKSPACE_URL = `${BASE_URL}/?eq=${encodeURIComponent(SAMPLE_EQ)}`;

// WCAG 2.0/2.1 Level A & AA — the conformance bar the app targets. This tag set
// includes `color-contrast`, the rule jsdom can't evaluate.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const NAV_TIMEOUT = 20000;
const SELECTOR_TIMEOUT = 10000;
const SETTLE_MS = 500;

const runAxe = (page) => new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

/**
 * Open a fresh, isolated context (so each surface's seeded localStorage is its
 * own), navigate to the workspace, and wait for the equation tree to mount.
 * `@axe-core/playwright` requires a context-owned page, not a default page.
 */
const openWorkspace = async (browser, { consent = 'granted' } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(
    (consentState) => {
      try {
        // Suppress the first-visit onboarding tour so it doesn't overlay surfaces.
        localStorage.setItem('algebranch_onboarding_completed', 'true');
        if (consentState) localStorage.setItem('algebranch_consent', consentState);
      } catch {
        /* localStorage may be blocked; overlays will just render */
      }
    },
    consent,
  );
  const page = await context.newPage();
  await page.goto(WORKSPACE_URL, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  await page.waitForSelector('[data-flip-id]', { timeout: SELECTOR_TIMEOUT });
  return { context, page };
};

const auditWorkspace = async (browser) => {
  const { context, page } = await openWorkspace(browser, { consent: 'granted' });
  await page.waitForTimeout(SETTLE_MS);
  const { violations } = await runAxe(page);
  await context.close();
  return { name: 'main workspace', violations };
};

const auditConsentBanner = async (browser) => {
  // Leave consent unset so the banner paints (onboarding still suppressed).
  const { context, page } = await openWorkspace(browser, { consent: null });
  await page.waitForSelector('[data-consent-banner], [role="dialog"]', { timeout: SELECTOR_TIMEOUT })
    .catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  const { violations } = await runAxe(page);
  await context.close();
  return { name: 'consent banner', violations };
};

const auditModal = async (browser, { name, key }) => {
  const { context, page } = await openWorkspace(browser, { consent: 'granted' });
  // Move focus off any node/input so the bare-key shortcut fires, then open.
  await page.locator('body').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press(key);
  await page.waitForSelector('[role="dialog"], [aria-modal="true"]', { timeout: SELECTOR_TIMEOUT });
  await page.waitForTimeout(SETTLE_MS);
  const { violations } = await runAxe(page);
  await context.close();
  return { name, violations };
};

const main = async () => {
  const browser = await chromium.launch();
  let surfaces;
  try {
    // Sequential keeps the report order stable and avoids contention on a single
    // dev/preview server in CI.
    surfaces = [
      await auditWorkspace(browser),
      await auditConsentBanner(browser),
      await auditModal(browser, { name: 'Settings modal', key: ',' }),
      // The app matches the cheat-sheet on Shift+`?`; Playwright needs the
      // modifier spelled out (press('?') alone won't set shiftKey).
      await auditModal(browser, { name: 'Shortcuts overlay', key: 'Shift+?' }),
    ];
  } catch (err) {
    console.error(`\naxe browser audit failed to drive the app at ${BASE_URL}`);
    console.error('Is the production server up? In CI: `npm run build` then `npm run start`.\n');
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }

  const { ok, text } = formatAxeReport(surfaces);
  console.log(text);
  process.exit(ok ? 0 : 1);
};

main();
