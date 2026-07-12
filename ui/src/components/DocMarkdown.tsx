// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Renders a chrome-stripped docs/*.md body into themed, server-rendered HTML for
// the on-domain documentation pages (#509). It is a server component: react-markdown
// runs at build time, so the whole doc ships in the initial HTML with no client
// hydration — the same crawlable, zero-JS shape as /input-format and /link-format.
// Sibling `.md` links are repointed to their on-domain routes via rewriteDocHref,
// and GitHub-flavored tables (the keyboard-shortcut grids) come from remark-gfm.
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { THEME_GLASS } from '../constants/theme';
import { rewriteDocHref } from '../utils/docsMarkdown';

const COMPONENTS: Components = {
  h2: ({ children }) => (
    <h2 className={`text-lg font-bold ${THEME_GLASS.TEXT_HEADING} tracking-tight mt-4`}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-tight mt-2`}>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className={`text-sm font-semibold ${THEME_GLASS.TEXT_HEADING}`}>{children}</h4>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="flex flex-col gap-2 pl-5 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="flex flex-col gap-2 pl-5 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className={`font-semibold ${THEME_GLASS.TEXT_HEADING}`}>{children}</strong>
  ),
  hr: () => <hr className={`border-t ${THEME_GLASS.PANEL_BORDER}`} />,
  a: ({ href, children }) => {
    const target = rewriteDocHref(href ?? '');
    // Same-origin (rewritten to a path/anchor) → same-tab navigation, so it stays
    // on the current origin and is never captured by the installed PWA. Only a
    // genuinely external link opens in a new tab.
    const isExternal = /^https?:\/\//i.test(target);
    if (isExternal) {
      return (
        <a href={target} target="_blank" rel="noopener noreferrer" className={THEME_GLASS.LINK}>
          {children}
        </a>
      );
    }
    return (
      <a href={target} className={THEME_GLASS.LINK}>
        {children}
      </a>
    );
  },
  // Inline code is a single-line chip; a multi-line run is a fenced block and is
  // left plain so the <pre> container styles it without chip padding.
  code: ({ children }) => {
    const text = String(children);
    if (text.includes('\n')) {
      return <code className="font-mono text-xs whitespace-pre">{children}</code>;
    }
    return <code className={THEME_GLASS.CODE_CHIP}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre
      className={`overflow-x-auto rounded-lg bg-white/5 border ${THEME_GLASS.PANEL_BORDER_SUBTLE} p-4 text-xs ${THEME_GLASS.TEXT_MUTED}`}
    >
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className={`border-b ${THEME_GLASS.PANEL_BORDER} ${THEME_GLASS.TEXT_MUTED}`}>
      {children}
    </thead>
  ),
  tr: ({ children }) => (
    <tr className={`border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} align-top`}>{children}</tr>
  ),
  th: ({ children }) => <th className="py-2 pr-4 font-semibold">{children}</th>,
  td: ({ children }) => <td className="py-2 pr-4">{children}</td>,
};

export function DocMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}
