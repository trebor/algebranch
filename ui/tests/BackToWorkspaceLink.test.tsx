// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The shared "Back to Workspace" affordance (#514) that every standalone doc and
// reference route renders. These tests pin its two jobs: it renders the visible
// link to the workspace, and Escape returns there too — the parity with the
// in-app doc modal the reader asked for, so the key behaves the same whether the
// page was loaded cold or opened as a modal.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BackToWorkspaceLink } from '@/components/BackToWorkspaceLink';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('BackToWorkspaceLink (#514)', () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
  });

  it('renders the visible link to the workspace', () => {
    render(<BackToWorkspaceLink />);
    const link = screen.getByRole('link', { name: /back to workspace/i });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('returns to the workspace when Escape is pressed', () => {
    render(<BackToWorkspaceLink />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(push).toHaveBeenCalledWith('/');
  });

  it('ignores other keys', () => {
    render(<BackToWorkspaceLink />);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(push).not.toHaveBeenCalled();
  });
});
