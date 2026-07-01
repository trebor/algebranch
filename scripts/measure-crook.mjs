#!/usr/bin/env node
// Ad-hoc geometry probe for the tall nth-root index (#201). Reads the real DOM boxes so
// the top/right/bottom gaps are measured, not eyeballed off a screenshot crop.
import { chromium } from 'playwright';

const base = process.cwd().includes('/gemini/') ? 'http://localhost:3001' : 'http://localhost:3000';
const url = `${base}/?eq=${encodeURIComponent('nthRoot(x, 1/2) = 2')}&crookdebug`;
const CROOK_FRACTION = 0.75;
const ARM_X_AT_CROOK_FRAC = (7.5 + (12 - 7.5) * (1 - CROOK_FRACTION)) / 12; // 0.71875

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.addInitScript(() => {
    try { localStorage.setItem('algebranch_consent', 'granted'); localStorage.setItem('algebranch_onboarding_completed', 'true'); } catch {}
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('[data-crookdebug="index"]', { timeout: 10000 });
  await page.waitForTimeout(2500);

  const data = await page.evaluate(({ armFrac, crookFrac }) => {
    const idx = document.querySelector('[data-crookdebug="index"]');
    const svg = document.querySelector('[data-crookdebug="svg"]');
    const i = idx.getBoundingClientRect();
    const s = svg.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(idx).fontSize);
    const crookY = s.top + crookFrac * s.height;
    const armX = s.left + armFrac * s.width;
    return {
      fontSize: fs,
      topGap: i.top - s.top,
      rightGapToArm: armX - i.right,
      bottomGap: crookY - i.bottom,
      indexRect: { top: i.top, right: i.right, bottom: i.bottom, left: i.left },
      svgRect: { top: s.top, left: s.left, width: s.width, height: s.height },
    };
  }, { armFrac: ARM_X_AT_CROOK_FRAC, crookFrac: CROOK_FRACTION });

  const em = (px) => (px / data.fontSize).toFixed(3);
  console.log(`fontSize        ${data.fontSize.toFixed(1)}px`);
  console.log(`top gap         ${data.topGap.toFixed(1)}px   ${em(data.topGap)}em`);
  console.log(`right gap→arm   ${data.rightGapToArm.toFixed(1)}px   ${em(data.rightGapToArm)}em`);
  console.log(`bottom gap      ${data.bottomGap.toFixed(1)}px   ${em(data.bottomGap)}em`);
} finally {
  await browser.close();
}
