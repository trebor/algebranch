// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DocMarkdown } from '../src/components/DocMarkdown';

// The on-domain docs render from GitHub-shaped markdown (#509): sibling .md links
// must repoint to on-domain routes, external links open safely, and remark-gfm
// tables (the keyboard-shortcut grids) must render as real tables.
describe('DocMarkdown', () => {
  it('repoints a sibling .md link to its on-domain route, same-tab', () => {
    render(<DocMarkdown markdown="See the [scope](scope.md) page." />);
    const link = screen.getByRole('link', { name: 'scope' });
    expect(link).toHaveAttribute('href', '/scope');
    expect(link).not.toHaveAttribute('target', '_blank');
  });

  it('relativizes a same-origin algebranch.org link and keeps it same-tab', () => {
    // A new-tab open to an in-scope URL is what the installed PWA captures (#509),
    // so these must stay same-origin, same-tab.
    render(<DocMarkdown markdown="Read the [Privacy Policy](https://algebranch.org/privacy)." />);
    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link).toHaveAttribute('href', '/privacy');
    expect(link).not.toHaveAttribute('target', '_blank');
  });

  it('relativizes an in-app example deep link so it opens on the current origin', () => {
    render(<DocMarkdown markdown="[open](https://algebranch.org/?eq=x%5E2-9%3D0)" />);
    const link = screen.getByRole('link', { name: 'open' });
    expect(link).toHaveAttribute('href', '/?eq=x%5E2-9%3D0');
    expect(link).not.toHaveAttribute('target', '_blank');
  });

  it('opens a genuinely external link in a new tab with a safe rel', () => {
    render(<DocMarkdown markdown="See [#183](https://github.com/trebor/algebranch/issues/183)." />);
    const link = screen.getByRole('link', { name: '#183' });
    expect(link).toHaveAttribute('href', 'https://github.com/trebor/algebranch/issues/183');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders a GFM table', () => {
    const md = ['| Key | Action |', '| --- | --- |', '| `W` | Toggle |'].join('\n');
    render(<DocMarkdown markdown={md} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Key' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Toggle' })).toBeInTheDocument();
  });
});
