// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { chromium } from 'playwright';

const outPath = '/Users/trebor/src/algebranch/ui/public/social-preview.png';
const fileUrl = 'file:///Users/trebor/src/algebranch/ui/public/social-preview.html';

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
