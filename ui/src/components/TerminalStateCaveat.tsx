// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { CircleSlash, Check, TriangleAlert } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { undefinedPathsAtom, terminalStatusAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';

/**
 * Standing terminal-state caveat under the main equation (#487).
 *
 * When the engine freezes the whole tree — no moves anywhere — this states *why*,
 * so the learner meeting a silent, handle-less canvas understands it rather than
 * assuming it broke. It is the single halt surface: the three freeze conditions
 * are mutually exclusive by construction, so at most one line ever renders here
 * (there is never a stack of halt banners). It sits beside the domain-restriction
 * caveat (#486) in the same flex column, and the two *can* co-occur — e.g. an
 * answer reached "given x ≠ 0" that turns out to be an identity shows both.
 *
 *  - ÷0 (undefined): a dead end, not a valid answer — the branch is unsound, so
 *    the copy points back to undo. Checked first, mirroring the engine's priority.
 *  - contradiction (`3 = -3`): no solution — a reached conclusion, framed as the
 *    answer, not a mistake.
 *  - identity (`0 = 0`): always true — likewise a conclusion.
 *
 * Colours mirror the matching history-tree state badges (÷0 and contradiction
 * share the red dead-end family, distinguished by icon; identity is emerald), so
 * the canvas line and the tree badge read as one system.
 */
export const TerminalStateCaveat: React.FC = () => {
  const undefinedPaths = useAtomValue(undefinedPathsAtom);
  const status = useAtomValue(terminalStatusAtom);

  // ÷0 wins priority (an undefined state carries no terminalStatus in the engine).
  const kind: 'undefined' | 'contradiction' | 'identity' | null =
    undefinedPaths.length > 0 ? 'undefined' : status;
  if (kind === null) return null;

  const isIdentity = kind === 'identity';
  const { label, Icon } = {
    undefined: {
      label: 'Undefined — this branch divides by zero, a dead end. Undo to try another path.',
      Icon: TriangleAlert,
    },
    contradiction: {
      label: 'No solution — this statement is false. You’ve reached a conclusion.',
      Icon: CircleSlash,
    },
    identity: {
      label: 'Always true — every value works. You’ve reached a conclusion.',
      Icon: Check,
    },
  }[kind];

  return (
    <div
      role="note"
      aria-label={label}
      className={`${THEME_GLASS.TERMINAL_STATE_CAVEAT} ${
        isIdentity ? THEME_GLASS.TERMINAL_STATE_CAVEAT_IDENTITY : THEME_GLASS.TERMINAL_STATE_CAVEAT_DEADEND
      }`}
    >
      <Icon
        size={14}
        className={
          isIdentity ? THEME_GLASS.TERMINAL_STATE_CAVEAT_ICON_IDENTITY : THEME_GLASS.TERMINAL_STATE_CAVEAT_ICON_DEADEND
        }
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
};
