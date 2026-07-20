// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { Tooltip } from '@/components/Tooltip';

afterEach(cleanup);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Tooltip interactive mode (Option A & B)', () => {
  it('default non-interactive tooltip has pointer-events-none and ignores portal hover', async () => {
    render(
      <Tooltip content={<div>Non-interactive content</div>}>
        <button>Trigger Button</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger Button');
    fireEvent.mouseEnter(trigger);
    await act(async () => {
      await wait(200);
    });

    const content = screen.getByText('Non-interactive content');
    const tooltipCard = content.parentElement!;
    expect(tooltipCard).toHaveClass('pointer-events-none');

    // Mouse leaves trigger
    fireEvent.mouseLeave(trigger);

    // After hideDelay (150ms), tooltip should be removed
    await act(async () => {
      await wait(200);
    });
    expect(screen.queryByText('Non-interactive content')).not.toBeInTheDocument();
  });

  it('interactive tooltip (interactive={true}) has pointer-events-auto and stays open when hovering portal content', async () => {
    render(
      <Tooltip interactive={true} content={<a href="https://wikipedia.org">Wikipedia Link</a>}>
        <button>Preset Button</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Preset Button');
    fireEvent.mouseEnter(trigger);
    await act(async () => {
      await wait(200);
    });

    const link = screen.getByText('Wikipedia Link');
    const tooltipPortal = link.parentElement!;
    expect(tooltipPortal).toHaveClass('pointer-events-auto');

    // Mouse leaves trigger...
    fireEvent.mouseLeave(trigger);

    // ...and immediately enters the tooltip portal (simulating user moving cursor onto Wikipedia link)
    fireEvent.mouseEnter(tooltipPortal);

    // Wait past the normal hide delay
    await act(async () => {
      await wait(350);
    });

    // Tooltip should STILL be open because cursor is over the portal
    expect(screen.getByText('Wikipedia Link')).toBeInTheDocument();

    // Now mouse leaves the portal div
    fireEvent.mouseLeave(tooltipPortal);

    // After the portal-exit hide delay (150ms), tooltip should disappear quickly
    await act(async () => {
      await wait(200);
    });
    expect(screen.queryByText('Wikipedia Link')).not.toBeInTheDocument();
  });

  it('dismisses snappily when transiting through and exiting an interactive tooltip portal', async () => {
    render(
      <Tooltip interactive={true} content={<span>Transit Content</span>}>
        <button>Preset Button</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Preset Button');
    fireEvent.mouseEnter(trigger);
    await act(async () => {
      await wait(200);
    });

    const content = screen.getByText('Transit Content');
    const tooltipPortal = content.parentElement!;

    // Transit sequence: leave trigger, enter portal, leave portal
    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(tooltipPortal);
    fireEvent.mouseLeave(tooltipPortal);

    // Should disappear within 200ms after leaving portal
    await act(async () => {
      await wait(200);
    });
    expect(screen.queryByText('Transit Content')).not.toBeInTheDocument();
  });
});
