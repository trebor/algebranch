// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { currentEquationAtom, rovingCursorPathAtom } from '../store/equation';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { THEME_GLASS } from '../constants/theme';
import { RovingTabindexProvider, useRovingTabindex } from '../hooks/useRovingTabindex';
import { useMathScale } from '../hooks/useMathScale';
import { getNodeByPath, nodeToSpeech } from 'math-engine-client';
import { PreviewEquationNode, ExploreContext } from './PreviewEquationNode';

/**
 * Exploration / Read view (#270): a clean, handle-free rendering of the current
 * equation a user walks to understand its STRUCTURE — the "reading" intent, distinct
 * from Interaction mode's actionable tree. Reuses the inert preview renderer via
 * ExploreContext.
 *
 * Narration is done with an explicit **live region**, NOT ARIA tree/focus semantics.
 * Two earlier attempts — roving focus and aria-activedescendant — both failed in
 * VoiceOver on the way UP: a parent stop always contains the child you came from in
 * the DOM, and VoiceOver refuses to announce "backing out" to a containing element.
 * So the visual equation is aria-hidden and an assertive live region speaks whatever
 * stop the cursor lands on, every move, regardless of nesting. As a bonus this also
 * drops the "outline row" treeitem chatter.
 *
 * Keys (on the container): Left/Right walk every stop depth-first so a listener can
 * never get stuck; Up jumps out to the enclosing term, Down drills into its first
 * part; Home/End to the ends; Escape leaves.
 */

const ExploreTreeInner: React.FC<{
  contentRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  isScaled: boolean;
  onExit?: () => void;
}> = ({ contentRef, scale, isScaled, onExit }) => {
  const currentEq = useAtomValue(currentEquationAtom);
  const roving = useRovingTabindex();

  const [narration, setNarration] = React.useState('');
  const flipRef = React.useRef(false);
  // Push a stop's spoken math into the live region. Alternate an invisible suffix so
  // two consecutive stops with identical speech (e.g. the two x's in x·x) still
  // register as a change and re-announce.
  const announce = React.useCallback((text: string) => {
    flipRef.current = !flipRef.current;
    setNarration(text + (flipRef.current ? '\u200B' : ''));
  }, []);

  // Narrate whichever stop the cursor points at — on entry and on every move.
  React.useEffect(() => {
    const key = roving.activeKey;
    if (!key || !currentEq) return;
    try {
      announce(nodeToSpeech(getNodeByPath(currentEq, key)));
    } catch {
      /* path no longer resolves (equation changed under us) — skip */
    }
  }, [roving.activeKey, currentEq, announce]);

  // The container is the single Tab stop and takes focus on entry so arrow-driving
  // works at once and a screen reader announces the reader.
  React.useEffect(() => {
    contentRef.current?.focus();
  }, [contentRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onExit?.();
      return;
    }
    const keys = roving.orderedKeys();
    if (keys.length === 0) return;
    const active = roving.activeKey;
    const idx = active ? keys.indexOf(active) : -1;
    // A stop's parent is its nearest REGISTERED ancestor, so a transparent paren in
    // between is skipped.
    const parentOf = (p: string): string | null =>
      keys.filter((k) => p.startsWith(k + '/')).sort((a, b) => b.length - a.length)[0] ?? null;
    // Move the cursor (updates the ring + fires the narration effect). Swallow the
    // key either way so the page never scrolls and Left/Right clamp at the ends.
    const go = (target: string | null | undefined) => {
      e.preventDefault();
      e.stopPropagation();
      if (target && target !== active) roving.setActive(target);
    };
    switch (e.key) {
      case 'ArrowRight':
        go(keys[Math.min(idx + 1, keys.length - 1)]);
        break;
      case 'ArrowLeft':
        go(keys[Math.max(idx - 1, 0)]);
        break;
      case 'Home':
        go(keys[0]);
        break;
      case 'End':
        go(keys[keys.length - 1]);
        break;
      case 'ArrowUp':
        if (active) go(parentOf(active));
        break;
      case 'ArrowDown':
        if (active) go(keys.find((k) => parentOf(k) === active));
        break;
    }
  };

  return (
    <>
      {/* Assertive so each move interrupts the previous as the user arrows quickly. */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {narration}
      </div>
      <div
        ref={contentRef}
        role="application"
        aria-label="Equation reader — use the arrow keys to read each part"
        aria-roledescription="equation reader"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        // Auto-scaled to fill the canvas; hidden until the first measurement so it
        // never flashes at 1em then snaps to size (mirrors the interactive tree).
        style={{ fontSize: `${scale}em`, opacity: isScaled ? 1 : 0 }}
        className="flex items-center justify-center gap-[0.4em] sm:gap-[0.6em] lg:gap-[0.8em] flex-nowrap w-max outline-none"
      >
        {/* The visual equation is hidden from the a11y tree — the live region above
            is the sole narration, so VoiceOver never reads the nested structure (no
            "group"/"row" chatter). No min-width side reservations (unlike Interaction
            mode): the bare expression centers as one unit. */}
        <div aria-hidden="true" className="flex items-center justify-center gap-[inherit] flex-nowrap">
          <PreviewEquationNode path="lhs" />
          <span className={`font-mono px-0.5 select-none ${THEME_GLASS.MATH_OP_MUTED_STATIC}`}>
            {RELATION_DISPLAY[currentEq?.relation ?? '='] ?? '='}
          </span>
          <PreviewEquationNode path="rhs" />
        </div>
      </div>
    </>
  );
};

export const ExploreEquationTree: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const currentEq = useAtomValue(currentEquationAtom);
  // Cross-mode cursor carry-over (#373): seed the reader's cursor from the path
  // the user left Interaction on, and mirror the reader's cursor back out as they
  // walk, so returning to Interaction restores their place. No seedFocus — the
  // reader narrates the cursor via its live region while DOM focus stays on the
  // application container, so nothing per-stop needs focusing.
  const [rovingCursorPath, setRovingCursorPath] = useAtom(rovingCursorPathAtom);
  // containerRef measures the available space; contentRef (the application) is the
  // element the hook scales, and doubles as the focus target. A higher max than
  // Interaction mode's 2.8 (#270): the clean, box-free render is compact, so a short
  // equation can grow much larger to fill the workspace.
  const { containerRef, contentRef, scale, isScaled } = useMathScale(currentEq, [], 24, 0.4, 5);

  const exploreValue = React.useMemo(() => ({ active: true, onExit }), [onExit]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-auto px-8 sm:px-12 lg:px-20 py-8"
    >
      <RovingTabindexProvider seedKey={rovingCursorPath} onActiveKeyChange={setRovingCursorPath}>
        <ExploreContext.Provider value={exploreValue}>
          <ExploreTreeInner contentRef={contentRef} scale={scale} isScaled={isScaled} onExit={onExit} />
        </ExploreContext.Provider>
      </RovingTabindexProvider>
    </div>
  );
};
