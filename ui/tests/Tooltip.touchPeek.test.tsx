// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Tooltip } from '@/components/Tooltip';

// matchMedia stand-in: jsdom ships none. Answer `(hover: hover)` from the
// `canHover` flag so a test can model a phone (canHover=false) vs a desktop
// (canHover=true, the no-matchMedia default).
function installMatchMedia(canHover: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('hover: hover') ? canHover : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

// jsdom's PointerEvent drops clientX/clientY; a MouseEvent carries the coords and
// still fires React's delegated onPointer* listeners. Stamp `pointerType` so the
// component can tell touch from mouse (real browsers set it natively).
const pointer = (
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
  pointerType: 'touch' | 'mouse' = 'touch',
) => {
  const ev = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(ev, 'pointerType', { value: pointerType });
  fireEvent(el, ev);
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
});

// On touch a tap synthesizes a mouseenter (and focus) with no matching mouseleave,
// so the desktop hover model would flash the tip and leave it stuck once the button's
// action (open a modal / menu) fires. On touch we instead give the tooltip a
// long-press "peek": tap = the button's action with no tip; hold = read the tip.
describe('Tooltip touch long-press peek (#388)', () => {
  it('does NOT show on a synthesized hover on a touch device', async () => {
    installMatchMedia(false); // phone
    render(
      <Tooltip content="TIP">
        <button>btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('btn'));
    fireEvent.focus(screen.getByText('btn'));
    await wait(300); // past the hover show-delay window
    expect(screen.queryByText('TIP')).toBeNull();
  });

  it('peeks on a long-press, hides on release, and swallows the trailing click', async () => {
    installMatchMedia(false);
    const onClick = vi.fn();
    render(
      <Tooltip content="TIP">
        <button onClick={onClick}>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByText('btn');

    pointer(btn, 'pointerdown', 5, 5, 'touch');
    // The hold timer fires (~500ms) and the tip peeks.
    await waitFor(() => expect(screen.getByText('TIP')).toBeInTheDocument());

    pointer(btn, 'pointerup', 5, 5, 'touch');
    await waitFor(() => expect(screen.queryByText('TIP')).toBeNull());

    // The click the browser fires after a long-press must NOT trigger the action.
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('a quick tap fires the action with no tooltip', async () => {
    installMatchMedia(false);
    const onClick = vi.fn();
    render(
      <Tooltip content="TIP">
        <button onClick={onClick}>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByText('btn');

    pointer(btn, 'pointerdown', 5, 5, 'touch');
    pointer(btn, 'pointerup', 5, 5, 'touch');
    fireEvent.click(btn);

    expect(onClick).toHaveBeenCalledTimes(1);
    await wait(200);
    expect(screen.queryByText('TIP')).toBeNull();
  });

  it('cancels the peek if the finger moves past the threshold (a scroll, not a hold)', async () => {
    installMatchMedia(false);
    render(
      <Tooltip content="TIP">
        <button>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByText('btn');
    pointer(btn, 'pointerdown', 5, 5, 'touch');
    pointer(btn, 'pointermove', 5, 60, 'touch'); // moved > threshold
    await wait(600);
    expect(screen.queryByText('TIP')).toBeNull();
  });

  it('desktop hover still shows the tooltip (no regression)', async () => {
    installMatchMedia(true); // desktop
    render(
      <Tooltip content="TIP">
        <button>btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('btn'));
    await waitFor(() => expect(screen.getByText('TIP')).toBeInTheDocument());
  });
});
