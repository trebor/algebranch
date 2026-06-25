// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import { render } from '@testing-library/react';
import { useFLIPAnimation } from '@/hooks/useFLIPAnimation';

/**
 * FLIP is a measure → invert → play dance over real DOM rects, deferred a frame
 * so React's commits settle first. jsdom has no layout, so we drive
 * `getBoundingClientRect` from a mutable map keyed by `data-flip-id`, flip a
 * node's coordinates between renders, and run the hook's `requestAnimationFrame`
 * work synchronously. A node that moved ends up with a `transform` transition
 * (the PLAY step); the invert→play collapses in one frame, so we assert on that
 * transition rather than the transient invert transform.
 */
const rectMap = new Map<string, { left: number; top: number }>();

function mockRects() {
  return vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      const id = this.getAttribute('data-flip-id') ?? '';
      const { left, top } = rectMap.get(id) ?? { left: 0, top: 0 };
      return {
        left, top, right: left, bottom: top, width: 0, height: 0, x: left, y: top,
        toJSON: () => ({}),
      } as DOMRect;
    });
}

function Harness({
  dep,
  reducedMotion,
  onAnimatingChange,
}: {
  dep: number;
  reducedMotion: boolean;
  onAnimatingChange?: (animating: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFLIPAnimation(ref, dep, reducedMotion, onAnimatingChange);
  return (
    <div ref={ref}>
      <div data-flip-id="a">A</div>
    </div>
  );
}

describe('useFLIPAnimation', () => {
  let rectSpy: ReturnType<typeof mockRects>;
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rectMap.clear();
    rectMap.set('a', { left: 0, top: 0 });
    rectSpy = mockRects();
    // The hook defers its measure/invert/play into a single rAF (after React's
    // commits settle). Run it synchronously so the effect completes within the
    // render's act() flush.
    rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0; });
  });

  afterEach(() => {
    rectSpy.mockRestore();
    rafSpy.mockRestore();
  });

  it('animates a moved node when motion is allowed', () => {
    const { rerender } = render(<Harness dep={1} reducedMotion={false} />);
    const node = document.querySelector('[data-flip-id="a"]') as HTMLElement;
    expect(node.style.transition).toBe('');

    // The node slides 100px right between equation states.
    rectMap.set('a', { left: 100, top: 0 });
    rerender(<Harness dep={2} reducedMotion={false} />);

    // PLAY applied a transform transition, i.e. the slide fired.
    expect(node.style.transition).toContain('transform');
  });

  it('does not animate when reduced motion is requested', () => {
    const { rerender } = render(<Harness dep={1} reducedMotion={true} />);
    const node = document.querySelector('[data-flip-id="a"]') as HTMLElement;

    rectMap.set('a', { left: 100, top: 0 });
    rerender(<Harness dep={2} reducedMotion={true} />);

    expect(node.style.transition).not.toContain('transform');
    expect(node.style.transform).toBe('');
  });

  it('still tracks positions while reduced so re-enabling motion does not jump', () => {
    // Reduced run records the move silently (no animation)...
    const { rerender } = render(<Harness dep={1} reducedMotion={true} />);
    const node = document.querySelector('[data-flip-id="a"]') as HTMLElement;
    rectMap.set('a', { left: 100, top: 0 });
    rerender(<Harness dep={2} reducedMotion={true} />);
    expect(node.style.transition).not.toContain('transform');

    // ...so a later same-position render with motion on produces no spurious slide.
    rerender(<Harness dep={3} reducedMotion={false} />);
    expect(node.style.transition).not.toContain('transform');
  });

  it('reports animating true while a slide is in flight, then false', () => {
    vi.useFakeTimers();
    try {
      const onAnimatingChange = vi.fn();
      const { rerender } = render(
        <Harness dep={1} reducedMotion={false} onAnimatingChange={onAnimatingChange} />,
      );
      onAnimatingChange.mockClear();

      rectMap.set('a', { left: 100, top: 0 });
      rerender(<Harness dep={2} reducedMotion={false} onAnimatingChange={onAnimatingChange} />);

      // Slide started → animating turns on (so consumers can suppress tooltips).
      expect(onAnimatingChange).toHaveBeenCalledWith(true);
      expect(onAnimatingChange).not.toHaveBeenCalledWith(false);

      // After the slide duration elapses, animating turns back off.
      vi.advanceTimersByTime(2000);
      expect(onAnimatingChange).toHaveBeenLastCalledWith(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never reports animating when reduced motion is requested', () => {
    const onAnimatingChange = vi.fn();
    const { rerender } = render(
      <Harness dep={1} reducedMotion={true} onAnimatingChange={onAnimatingChange} />,
    );
    rectMap.set('a', { left: 100, top: 0 });
    rerender(<Harness dep={2} reducedMotion={true} onAnimatingChange={onAnimatingChange} />);

    expect(onAnimatingChange).not.toHaveBeenCalledWith(true);
  });
});
