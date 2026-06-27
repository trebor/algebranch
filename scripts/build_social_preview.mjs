// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { chromium } from 'playwright';

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const outPath = path.join(projectRoot, 'ui', 'public', 'social-preview.png');
const fileUrl = `file://${path.join(projectRoot, 'ui', 'public', 'social-preview.html')}`;

async function generateSocialPreview() {
  console.log(`Generating social preview image -> ${outPath}...`);
  
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 640 }
    });
    
    // Load local social preview html
    await page.goto(fileUrl);
    
    // Wait for rendering & font loading to settle
    await page.waitForTimeout(1000);
    
    // Take screenshot of the entire body
    const body = page.locator('body');
    await body.screenshot({ path: outPath });
    
    console.log(`Successfully generated social preview PNG at ${outPath}!`);
  } catch (err) {
    console.error(`Error generating social preview:`, err);
    throw err;
  } finally {
    await browser.close();
  }
}

generateSocialPreview();
