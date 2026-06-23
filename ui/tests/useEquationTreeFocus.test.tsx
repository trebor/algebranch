// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { useEquationTreeFocus } from '@/hooks/useEquationTreeFocus';

// A minimal harness mirroring the page wiring: a tree container whose actionable
// terms are the real treeitem markup (#257) — `data-eq-node role="treeitem"`
// carrying `aria-selected` — plus an outside control modelling the page chrome.
// `activeTabIndex` defaults to 0 (the controller has assigned the Tab stop); a
// test can pass -1 to model the commit where the roving controller has not yet
// caught up, which is the race the refocus must survive.
function Harness({
  equationKey,
  candidatePathsKey,
  refocusNonce,
  terms,
  activeTabIndex = 0,
  selectionKey = null,
}: {
  equationKey: string;
  candidatePathsKey: unknown;
  refocusNonce: number;
  terms: string[];
  activeTabIndex?: number;
  selectionKey?: string | null;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { onFocusCapture, onBlurCapture } = useEquationTreeFocus({
    containerRef,
    equationKey,
    candidatePathsKey,
    refocusNonce,
    selectionKey,
  });
  return (
    <div>
      <button data-testid="outside">outside</button>
      <div ref={containerRef} onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture}>
        {terms.map((t, i) => (
          <div
            key={t}
            data-eq-node
            role="treeitem"
            aria-selected={false}
            tabIndex={i === 0 ? activeTabIndex : -1}
            data-testid={`term-${t}`}
          >
            {t}
          </div>
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

  it('focuses the first actionable term even before the roving controller has assigned tabindex=0 (race)', () => {
    // After an apply the roving controller assigns the active item's tabindex=0 one
    // commit later than the candidate set repopulates, so keying the refocus off
    // tabindex alone misses and never retries (#257). The first actionable term
    // carries aria-selected, so we land on it regardless of the controller's lag.
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a']} activeTabIndex={0} />,
    );
    act(() => getByTestId('outside').focus());

    // Equation changes while a source was applied; the new terms exist but the
    // controller has not yet promoted the first one to tabindex=0.
    rerender(
      <Harness equationKey="1" candidatePathsKey="b" refocusNonce={0} terms={['c', 'd']} activeTabIndex={-1} />,
    );
    // The refocus arms on focus-within only, so model that the apply happened from
    // inside the tree via an explicit nonce bump (matches the keyboard-apply path).
    rerender(
      <Harness equationKey="1" candidatePathsKey="b" refocusNonce={1} terms={['c', 'd']} activeTabIndex={-1} />,
    );

    expect(document.activeElement).toBe(getByTestId('term-c'));
  });

  it('refocuses the actionable set when a source is selected by keyboard (no equation change)', () => {
    // Selecting a source recomputes candidates without changing the equation, so
    // the focused term briefly unmounts and focus falls to <body>. Arming on the
    // selection (while focus was in the tree) restores focus to the actionable set
    // — keeping the keyboard flow alive between select and apply (#257).
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a', 'b']} selectionKey={null} />,
    );
    act(() => getByTestId('term-a').focus());
    fireEvent.focus(getByTestId('term-a'));

    // A source is selected; candidates recompute (equation key unchanged). The
    // focused term unmounts mid-recompute (focus drops to <body>), then the new
    // actionable set — with the source first — arrives.
    rerender(<Harness equationKey="0" candidatePathsKey="empty" refocusNonce={0} terms={[]} selectionKey="a" />);
    rerender(<Harness equationKey="0" candidatePathsKey="sel" refocusNonce={0} terms={['a', 'target']} selectionKey="a" />);

    expect(document.activeElement).toBe(getByTestId('term-a'));
  });

  it('does not refocus on deselect (selection cleared) — Escape releases to the container', () => {
    // Going from selected back to nothing must NOT yank focus to a term: Escape
    // deliberately releases focus to the region container (#257).
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="sel" refocusNonce={0} terms={['a', 'b']} selectionKey="a" />,
    );
    act(() => getByTestId('term-a').focus());
    fireEvent.focus(getByTestId('term-a'));

    // Selection cleared (null) — a deselect, not a new selection — across the same
    // unmount/repopulate transition.
    rerender(<Harness equationKey="0" candidatePathsKey="empty" refocusNonce={0} terms={[]} selectionKey={null} />);
    rerender(<Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a', 'b']} selectionKey={null} />);

    expect(document.activeElement).toBe(document.body);
  });

  it('re-lands focus across multiple settling commits when the term is re-parented (not unmounted)', () => {
    // Applying a transposition re-parents the focused term as it changes sides, so
    // it blurs to <body> while staying mounted, and the candidate set settles over
    // several commits. A one-shot refocus lands on the first commit but is then
    // blurred by a later re-parent; the request must persist until focus actually
    // rests inside the tree (#257). Model that with a stray blur-to-body after the
    // first refocus, followed by another candidate-set commit.
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a', 'b']} />,
    );
    act(() => getByTestId('term-a').focus());
    fireEvent.focus(getByTestId('term-a'));

    // Equation changes; first settling commit brings new terms — refocus lands.
    rerender(<Harness equationKey="1" candidatePathsKey="empty" refocusNonce={0} terms={[]} />);
    rerender(<Harness equationKey="1" candidatePathsKey="b1" refocusNonce={0} terms={['c', 'd']} />);
    expect(document.activeElement).toBe(getByTestId('term-c'));

    // A re-parent blurs the focused term to body (it stays mounted), then a second
    // settling commit arrives. Focus must be re-landed, not left on body.
    act(() => (document.activeElement as HTMLElement)?.blur());
    rerender(<Harness equationKey="1" candidatePathsKey="b2" refocusNonce={0} terms={['c', 'd']} />);
    expect(document.activeElement).toBe(getByTestId('term-c'));
  });

  it('does not refocus on a mouse selection (focus was never in the tree)', () => {
    const { rerender, getByTestId } = render(
      <Harness equationKey="0" candidatePathsKey="a" refocusNonce={0} terms={['a', 'b']} selectionKey={null} />,
    );
    act(() => getByTestId('outside').focus());

    rerender(<Harness equationKey="0" candidatePathsKey="sel" refocusNonce={0} terms={['a', 'target']} selectionKey="a" />);

    expect(document.activeElement).toBe(getByTestId('outside'));
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
