// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  stripDocChrome,
  rewriteDocHref,
  markdownToPlainText,
  extractFaqEntries,
} from '../src/utils/docsMarkdown';
import { DOCS_PAGES } from '../src/constants/docsPages';

// The docs/ markdown is the single source of truth (#509); the on-domain pages
// render from it at build time. These tests pin the transforms that adapt the
// GitHub-shaped markdown to the on-domain surface — and, by reading the real
// files, guard against the config drifting from what actually ships.
const DOCS_DIR = path.join(process.cwd(), '..', 'docs');
const readDoc = (file: string) => readFileSync(path.join(DOCS_DIR, file), 'utf8');

describe('stripDocChrome', () => {
  it('drops the H1, the GitHub nav row, and the leading horizontal rule', () => {
    const md = [
      '# Frequently Asked Questions',
      '',
      '[User Guide](user-guide.md) • [FAQ](faq.md)',
      '',
      '---',
      '',
      '### Real question',
      'Real answer.',
    ].join('\n');
    expect(stripDocChrome(md)).toBe('### Real question\nReal answer.');
  });

  it('strips only up to the FIRST rule, leaving section separators intact', () => {
    const md = '# T\n\n[nav](a.md)\n\n---\n\n## A\ntext\n\n---\n\n## B\nmore';
    expect(stripDocChrome(md)).toBe('## A\ntext\n\n---\n\n## B\nmore');
  });

  it('returns the content untouched (trimmed) when there is no chrome rule', () => {
    expect(stripDocChrome('## Already stripped\ntext')).toBe('## Already stripped\ntext');
  });
});

describe('rewriteDocHref', () => {
  it('maps a sibling doc file to its on-domain route', () => {
    expect(rewriteDocHref('user-guide.md')).toBe('/user-guide');
    expect(rewriteDocHref('faq.md')).toBe('/faq');
    expect(rewriteDocHref('features.md')).toBe('/features');
    expect(rewriteDocHref('scope.md')).toBe('/scope');
  });

  it('maps the documentation index to /docs', () => {
    expect(rewriteDocHref('index.md')).toBe('/docs');
  });

  it('preserves an anchor when rewriting', () => {
    expect(rewriteDocHref('user-guide.md#deep-links--sharing')).toBe(
      '/user-guide#deep-links--sharing',
    );
  });

  it('tolerates a leading ./', () => {
    expect(rewriteDocHref('./scope.md')).toBe('/scope');
  });

  it('relativizes same-origin algebranch.org links so they stay on the current origin', () => {
    // The markdown source uses absolute URLs so they resolve on GitHub; on-domain
    // they must become same-origin same-tab paths, or a new-tab open to an in-scope
    // URL gets captured by the installed PWA (#509).
    expect(rewriteDocHref('https://algebranch.org/privacy')).toBe('/privacy');
    expect(rewriteDocHref('https://algebranch.org/?eq=x%5E2-9%3D0')).toBe('/?eq=x%5E2-9%3D0');
    expect(rewriteDocHref('https://algebranch.org')).toBe('/');
  });

  it('leaves genuinely external, root-relative, and anchor links untouched', () => {
    expect(rewriteDocHref('https://github.com/trebor/algebranch/issues/183')).toBe(
      'https://github.com/trebor/algebranch/issues/183',
    );
    expect(rewriteDocHref('/input-format')).toBe('/input-format');
    expect(rewriteDocHref('#section')).toBe('#section');
    // A look-alike host must not be mistaken for our origin.
    expect(rewriteDocHref('https://algebranch.org.evil.com/x')).toBe(
      'https://algebranch.org.evil.com/x',
    );
  });
});

describe('markdownToPlainText', () => {
  it('strips bold, links, and inline code to readable prose', () => {
    expect(markdownToPlainText('**No.** The math stays on your device.')).toBe(
      'No. The math stays on your device.',
    );
    expect(markdownToPlainText('read our [Privacy Policy](https://algebranch.org/privacy).')).toBe(
      'read our Privacy Policy.',
    );
    expect(markdownToPlainText('saved under keys prefixed with `algebranch_`.')).toBe(
      'saved under keys prefixed with algebranch_.',
    );
  });

  it('flattens a bullet list into one whitespace-collapsed string', () => {
    const md = '*   **Auto-Save**: saved automatically.\n*   **Sharing**: click Share.';
    expect(markdownToPlainText(md)).toBe('Auto-Save: saved automatically. Sharing: click Share.');
  });
});

describe('extractFaqEntries', () => {
  it('pairs each ### question with its answer text from raw faq markdown', () => {
    const md = [
      '# FAQ',
      '',
      '[nav](index.md)',
      '',
      '---',
      '',
      '### Is my work uploaded to a server?',
      '**No.** It stays on your device.',
      '',
      '---',
      '',
      '### Will Algebranch solve equations for me?',
      '**No.** You make every move.',
    ].join('\n');
    expect(extractFaqEntries(md)).toEqual([
      { question: 'Is my work uploaded to a server?', answer: 'No. It stays on your device.' },
      { question: 'Will Algebranch solve equations for me?', answer: 'No. You make every move.' },
    ]);
  });

  it('extracts every question from the real docs/faq.md without empty answers', () => {
    const entries = extractFaqEntries(readDoc('faq.md'));
    expect(entries.length).toBeGreaterThanOrEqual(8);
    for (const { question, answer } of entries) {
      expect(question.length).toBeGreaterThan(0);
      expect(answer.length).toBeGreaterThan(0);
      expect(answer).not.toContain('**');
      expect(answer).not.toMatch(/\]\(/); // no unresolved markdown links
    }
    const questions = entries.map((e) => e.question);
    expect(questions).toContain('Will Algebranch solve equations for me?');
  });
});

describe('DOCS_PAGES config', () => {
  it('points every page at a docs/ file that exists and has content', () => {
    for (const page of DOCS_PAGES) {
      expect(() => readDoc(page.file)).not.toThrow();
      expect(readDoc(page.file).trim().length).toBeGreaterThan(0);
    }
  });

  it('has unique slugs', () => {
    const slugs = DOCS_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
