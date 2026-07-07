// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { formatDocumentTitle, APP_NAME, DEFAULT_DOCUMENT_TITLE } from '@/utils/documentTitle';

describe('formatDocumentTitle (#449)', () => {
  it('prepends the active workspace name to the app name', () => {
    expect(formatDocumentTitle('Projectile Motion')).toBe(`Projectile Motion — ${APP_NAME}`);
  });

  it('falls back to the default title when the name is empty or whitespace', () => {
    expect(formatDocumentTitle('')).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(formatDocumentTitle('   ')).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(formatDocumentTitle(null)).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(formatDocumentTitle(undefined)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it('trims surrounding whitespace from the workspace name', () => {
    expect(formatDocumentTitle('  Kinematics  ')).toBe(`Kinematics — ${APP_NAME}`);
  });

  it('keeps the tagline out of the browser tab — base title is the bare brand (#449)', () => {
    expect(DEFAULT_DOCUMENT_TITLE).toBe('Algebranch');
    expect(DEFAULT_DOCUMENT_TITLE).not.toContain('Interactive Algebra');
    expect(formatDocumentTitle('Kinematics')).not.toContain('Interactive Algebra');
  });
});
