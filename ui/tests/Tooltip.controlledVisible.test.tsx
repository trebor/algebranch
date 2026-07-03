// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Tooltip } from '@/components/Tooltip';

afterEach(cleanup);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Tooltip controlled visibility vs. the single-active dismiss (#388)', () => {
  // Regression: on touch, every equation node is wrapped in a <Tooltip> (most with
  // visible={false}). A tap synthesizes a mouseenter on neighbours/ancestors of the
  // pressed node; their hover-driven show would fire the global "close the active
  // tooltip" side effect ~150ms later and dismiss the long-press peek out from under
  // the finger — "the tip shows then quickly dismisses." A tooltip whose owner said
  // visible={false} must not respond to hover at all.
  it('a hover on a visible={false} tooltip does NOT dismiss a shown, controlled-visible one', async () => {
    render(
      <>
        <Tooltip content="PEEK PREVIEW" visible={true}>
          <button>peek-anchor</button>
        </Tooltip>
        <Tooltip content="NEIGHBOUR" visible={false}>
          <button>neighbour-anchor</button>
        </Tooltip>
      </>,
    );

    // The controlled-visible peek is shown.
    expect(await screen.findByText('PEEK PREVIEW')).toBeInTheDocument();

    // A synthesized hover lands on the neighbour (whose owner set visible={false}).
    fireEvent.mouseEnter(screen.getByText('neighbour-anchor'));

    // Past the show-delay window: the peek must still be up, not dismissed.
    await wait(250);
    expect(screen.getByText('PEEK PREVIEW')).toBeInTheDocument();
  });
});
