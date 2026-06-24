// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static guard for the immersive hide-chrome CSS (#252). The spatial effect is
// CSS-driven: a `data-immersive` attribute on :root collapses the header and
// bottom-nav height vars to 0 (so the workspace reclaims the space through the
// #218/#251 variable plumbing) and slides the chrome out of view. The height
// vars are registered with @property as <length> so the collapse animates in
// step with the slide; reduced-motion users get the global snap for free.

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('immersive chrome CSS (#252)', () => {
  it('registers --header-height and --bottom-nav-height as <length> so they animate', () => {
    expect(css).toMatch(/@property\s+--header-height\s*\{[^}]*syntax:\s*['"]<length>['"]/);
    expect(css).toMatch(/@property\s+--bottom-nav-height\s*\{[^}]*syntax:\s*['"]<length>['"]/);
  });

  it('collapses both chrome height vars to zero under :root[data-immersive]', () => {
    const start = css.indexOf(':root[data-immersive]');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toMatch(/--header-height:\s*0/);
    expect(block).toMatch(/--bottom-nav-height:\s*0/);
  });

  it('gates the immersive collapse inside the short-screen media query', () => {
    // The collapse must only engage on the tight-landscape breakpoint (#218),
    // so the data-immersive rule lives after that media query opens.
    const mediaStart = css.indexOf('@media (max-height: 500px) and (max-width: 1024px)');
    const immersiveStart = css.indexOf(':root[data-immersive]');
    expect(mediaStart).toBeGreaterThan(-1);
    expect(immersiveStart).toBeGreaterThan(mediaStart);
  });
});
