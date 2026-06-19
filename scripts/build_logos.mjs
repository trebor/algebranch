// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { chromium } from 'playwright';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

const publicDir = '/Users/trebor/src/algebranch/ui/public';
const appDir = '/Users/trebor/src/algebranch/ui/src/app';
const fileUrl = 'file:///Users/trebor/src/algebranch/ui/public/logo-builder.html';

// Wrap PNG buffer in a basic single-image ICO container (for favicon.ico)
function pngToIco(pngBuffer, size) {
  // Read PNG IHDR metadata to determine actual bits per pixel (BPP)
  // Byte 24: Bit depth
  // Byte 25: Color type (0: Grayscale, 2: RGB, 3: Indexed, 4: Grayscale+Alpha, 6: RGBA)
  const bitDepth = pngBuffer[24];
  const colorType = pngBuffer[25];
  let bpp = 32; // Fallback
  if (colorType === 2) {
    bpp = bitDepth * 3; // RGB
  } else if (colorType === 6) {
    bpp = bitDepth * 4; // RGBA
  } else if (colorType === 3 || colorType === 0) {
    bpp = bitDepth;     // Indexed or Grayscale
  }

  console.log(`PNG detected: colorType=${colorType}, bitDepth=${bitDepth} -> setting ICO bpp to ${bpp}`);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: ICO
  header.writeUInt16LE(1, 4); // Number of images (1)

  const directory = Buffer.alloc(16);
  directory.writeUInt8(size, 0); // Width
  directory.writeUInt8(size, 1); // Height
  directory.writeUInt8(0, 2);    // Color count (0)
  directory.writeUInt8(0, 3);    // Reserved (0)
  directory.writeUInt16LE(1, 4);  // Color planes (1)
  directory.writeUInt16LE(bpp, 6); // Bits per pixel
  directory.writeUInt32LE(pngBuffer.length, 8); // Size of PNG data
  directory.writeUInt32LE(22, 12); // Offset of PNG data from start of file

  return Buffer.concat([header, directory, pngBuffer]);
}

async function generateLogo({ outPath, size, theme, hideText, isFavicon = false }) {
  console.log(`Generating logo -> ${outPath} (${size}x${size}, theme: ${theme}, hideText: ${hideText})...`);
  
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: size + 200, height: size + 200 }
    });
    
    // Load local builder file
    await page.goto(fileUrl);
    
    // Set theme and options in the page
    await page.evaluate(({ theme, hideText, size, isFavicon }) => {
      // Set theme
      setTheme(theme);
      
      // Set checkbox values
      document.getElementById('showCircleGuide').checked = false;
      document.getElementById('hideText').checked = hideText;
      
      // Run update preview to apply settings
      updatePreview();
      
      // Style page to cleanly capture only the SVG
      document.querySelector('header').style.display = 'none';
      document.querySelector('.controls-panel').style.display = 'none';
      document.querySelector('.main-container').style.padding = '0';
      document.querySelector('.main-container').style.margin = '0';
      document.querySelector('.preview-panel').style.padding = '0';
      
      const container = document.getElementById('svgContainer');
      container.style.width = `${size}px`;
      container.style.maxWidth = `${size}px`;
      container.style.height = `${size}px`;
      container.style.padding = '0';
      container.style.margin = '0';
      container.style.border = 'none';
      container.style.borderRadius = '0';
      container.style.background = 'transparent';

      // For the favicon, remove the background rect entirely to make it transparent,
      // and force all HTML elements to have transparent backgrounds to avoid any solid backdrop.
      if (isFavicon) {
        const bgRect = container.querySelector('svg > rect');
        if (bgRect) {
          bgRect.remove();
        }
        
        const style = document.createElement('style');
        style.textContent = '* { background: transparent !important; }';
        document.head.appendChild(style);
      }
    }, { theme, hideText, size, isFavicon });
    
    // Wait for rendering to settle
    await page.waitForTimeout(400);
    
    // Take screenshot of only the SVG element
    const locator = page.locator('#svgContainer svg');
    
    if (isFavicon) {
      // Forcing omitBackground: true ensures the background of the screenshot is transparent
      const pngBuffer = await locator.screenshot({ omitBackground: true });
      const icoBuffer = pngToIco(pngBuffer, size);
      await writeFile(outPath, icoBuffer);
      console.log(`Successfully wrote ICO container to ${outPath}`);
    } else {
      await locator.screenshot({ path: outPath });
      console.log(`Successfully wrote PNG to ${outPath}`);
    }
  } catch (err) {
    console.error(`Error generating logo:`, err);
    throw err;
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    // 1. logo.png (Chromatic, with text, 256x256)
    await generateLogo({
      outPath: join(publicDir, 'logo.png'),
      size: 256,
      theme: 'gradient',
      hideText: false
    });

    // 2. logo-black.png (Minimalist B&W, with text, 256x256)
    await generateLogo({
      outPath: join(publicDir, 'logo-black.png'),
      size: 256,
      theme: 'minimal',
      hideText: false
    });

    // 3. logo-textless.png (Chromatic, textless, 256x256)
    await generateLogo({
      outPath: join(publicDir, 'logo-textless.png'),
      size: 256,
      theme: 'gradient',
      hideText: true
    });

    // 4. logo-black-textless.png (Minimalist B&W, textless, 256x256)
    await generateLogo({
      outPath: join(publicDir, 'logo-black-textless.png'),
      size: 256,
      theme: 'minimal',
      hideText: true
    });

    // 5. icon-192.png (Chromatic, textless, 192x192)
    await generateLogo({
      outPath: join(publicDir, 'icon-192.png'),
      size: 192,
      theme: 'gradient',
      hideText: true
    });

    // 6. icon-512.png (Chromatic, textless, 512x512)
    await generateLogo({
      outPath: join(publicDir, 'icon-512.png'),
      size: 512,
      theme: 'gradient',
      hideText: true
    });

    // 7. favicon.ico (Chromatic, textless, 32x32 Windows icon resource)
    await generateLogo({
      outPath: join(appDir, 'favicon.ico'),
      size: 32,
      theme: 'gradient',
      hideText: true,
      isFavicon: true
    });

    console.log('All logo and icon assets built successfully!');
  } catch (err) {
    console.error('Failed to build all assets:', err);
    process.exit(1);
  }
}

main();
