// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Pure transforms that adapt the GitHub-shaped `docs/*.md` markdown to the
 * on-domain documentation pages (#509). The markdown is the single source of
 * truth; these functions strip the GitHub chrome, repoint sibling `.md` links to
 * their on-domain routes, and derive the FAQPage structured data — all without
 * mutating the source, so GitHub and the domain stay in lockstep.
 */
import { SITE_URL } from '../constants/site';

// Every doc opens with an H1, a `[nav](file.md) • …` row, and a horizontal rule
// before the real content. On the domain the page supplies its own header and
// cross-link nav, so we drop everything up to and including that first rule.
export function stripDocChrome(markdown: string): string {
  const lines = markdown.split('\n');
  const ruleIndex = lines.findIndex((line) => line.trim() === '---');
  if (ruleIndex === -1) return markdown.trim();
  return lines.slice(ruleIndex + 1).join('\n').trim();
}

// A sibling doc link like `scope.md` or `user-guide.md#anchor` becomes the
// on-domain route `/scope` / `/user-guide#anchor`; `index.md` is the hub `/docs`.
// Genuinely external and bare-anchor links pass through untouched.
const DOC_LINK = /^(?:\.\/)?([a-z0-9-]+)\.md(#.*)?$/i;

export function rewriteDocHref(href: string): string {
  const match = href.match(DOC_LINK);
  if (match) {
    const [, name, hash = ''] = match;
    const slug = name === 'index' ? 'docs' : name;
    return `/${slug}${hash}`;
  }
  // Relativize our own origin. The docs source uses absolute algebranch.org URLs
  // so they resolve on GitHub, but on-domain they must be same-origin so a click
  // stays on the current origin (localhost/preview/prod) and same-tab — a new-tab
  // open to an in-scope URL is what the installed PWA captures.
  if (href === SITE_URL) return '/';
  if (href.startsWith(SITE_URL)) {
    const rest = href.slice(SITE_URL.length);
    if (rest.startsWith('/')) return rest;
    if (rest.startsWith('?') || rest.startsWith('#')) return `/${rest}`;
  }
  return href;
}

// Flatten a snippet of markdown to plain prose for the FAQPage answer text:
// drop list markers, unwrap bold/italic/inline-code, keep only the visible text
// of links, and collapse all whitespace to single spaces.
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2') // italic (avoid touching ** )
    .replace(/^\s*[*+-]\s+/gm, '') // list-item markers
    .replace(/^\s*#+\s+/gm, '') // stray headings
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FaqEntry {
  question: string;
  answer: string;
}

// Turn the raw faq.md into { question, answer } pairs for FAQPage JSON-LD. Each
// `### Question` heading owns the prose that follows until the next `---` rule.
export function extractFaqEntries(markdown: string): FaqEntry[] {
  const body = stripDocChrome(markdown);
  const entries: FaqEntry[] = [];
  for (const block of body.split(/^---$/m)) {
    const headingMatch = block.match(/^###\s+(.+)$/m);
    if (!headingMatch) continue;
    const question = headingMatch[1].trim();
    const answerMd = block.slice(block.indexOf(headingMatch[0]) + headingMatch[0].length);
    const answer = markdownToPlainText(answerMd);
    if (question && answer) entries.push({ question, answer });
  }
  return entries;
}
