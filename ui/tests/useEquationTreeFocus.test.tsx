// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { useEquationTreeFocus } from '@/hooks/useEquationTreeFocus';

// A minimal harness mirroring the page wiring: a tree container whose
// actionable terms are <button data-eq-node tabindex="0">, plus an outside
// control to model the rest of the page chrome.
function Harness({
  equationKey,
  candidatePathsKey,
  refocusNonce,
  terms,
}: {
  equationKey: string;
  candidatePathsKey: unknown;
  refocusNonce: number;
  terms: string[];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { onFocusCapture, onBlurCapture } = useEquationTreeFocus({
    containerRef,
    equationKey,
    candidatePathsKey,
    refocusNonce,
  });
  return (
    <div>
      <button data-testid="outside">outside</button>
      <div ref={containerRef} onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture}>
        {terms.map((t) => (
          <button key={t} data-eq-node tabIndex={0} data-testid={`term-${t}`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

afterEach(cleanup);

describe('useEquationTreeFocus', () => {
  it('moves focus to the first actionable term when the equation changes while focus was in the tree', () => {
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a', 'b']} />,
    );

    // User is keyboarding inside the tree.
    act(() => getByTestId('term-a').focus());
    fireEvent.focus(getByTestId('term-a'));

    // Equation changes; mid-transition the candidate set is briefly empty.
    rerender(<Harness equationKey="1" candidatePathsKey="empty" refocusNonce={0} terms={[]} />);
    // New actionable terms arrive asynchronously.
    rerender(<Harness equationKey="1" candidatePathsKey="b" refocusNonce={0} terms={['c', 'd']} />);

    expect(document.activeElement).toBe(getByTestId('term-c'));
  });

  it('does not move focus when the change happened with focus outside the tree (load / mouse)', () => {
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a']} />,
    );
    act(() => getByTestId('outside').focus());

    rerender(<Harness equationKey="1" candidatePathsKey="b" refocusNonce={0} terms={['c']} />);

    expect(document.activeElement).toBe(getByTestId('outside'));
  });

  it('refocuses on an explicit nonce bump even if focus was outside the tree (edit-modal submit)', () => {
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a']} />,
    );
    act(() => getByTestId('outside').focus());

    rerender(<Harness equationKey="1" candidatePathsKey="b" refocusNonce={1} terms={['c']} />);

    expect(document.activeElement).toBe(getByTestId('term-c'));
  });

  it('refocuses on a nonce bump even when equation and candidate set are unchanged (reload active workspace)', () => {
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['x']} />,
    );
    act(() => getByTestId('outside').focus());

    // Only the nonce changes — same equation, same candidate set.
    rerender(<Harness equationKey="0" candidatePathsKey="a" refocusNonce={1} terms={['x']} />);

    expect(document.activeElement).toBe(getByTestId('term-x'));
  });

  it('stops refocusing after the user deliberately tabs out of the tree', () => {
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a']} />,
    );
    // Focus enters the tree, then deliberately leaves to outside chrome.
    fireEvent.focus(getByTestId('term-a'));
    fireEvent.blur(getByTestId('term-a'), { relatedTarget: getByTestId('outside') });
    act(() => getByTestId('outside').focus());

    rerender(<Harness equationKey="1" candidatePathsKey="b" refocusNonce={0} terms={['c']} />);

    expect(document.activeElement).toBe(getByTestId('outside'));
  });
});
