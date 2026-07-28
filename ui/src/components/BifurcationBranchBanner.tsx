// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { GitBranch, ArrowRight, Info } from 'lucide-react';
import { bifurcationStateAtom, currentNodeIdAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { Tooltip } from './Tooltip';

const getPedagogicalExplanation = (label: string, branchIndex: number, totalBranches: number): string => {
  const clean = label.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();

  if (clean.includes('root') || clean.includes('sqrt')) {
    const caseText = branchIndex === 1 ? 'positive' : 'negative';
    return `Taking an even root produces positive and negative cases. This is the ${caseText} branch.`;
  }

  if (clean.includes('abs')) {
    const caseText = branchIndex === 1 ? 'positive' : 'negative';
    return `Removing absolute value bars splits into positive and negative cases. This is the ${caseText} branch.`;
  }

  if (clean.includes('zero') || clean.includes('product')) {
    return `A product equals zero when at least one factor is zero. This evaluates factor ${branchIndex} of ${totalBranches}.`;
  }

  if (clean.includes('quadratic')) {
    const caseText = branchIndex === 1 ? 'positive' : 'negative';
    return `The quadratic formula plus-minus term produces two solutions. This is the ${caseText} root branch.`;
  }

  return `This operation branched the equation into ${totalBranches} solution paths. This is branch ${branchIndex}.`;
};

export const BifurcationBranchBanner: React.FC = () => {
  const state = useAtomValue(bifurcationStateAtom);
  const setCurrentNodeId = useSetAtom(currentNodeIdAtom);

  if (!state || state.allComplete || !state.nextUnresolvedBranch) return null;

  const { activeBranchIndex, activeBranchLabel, totalBranches, nextUnresolvedBranch } = state;
  const cleanLabel = activeBranchLabel ? activeBranchLabel.replace(/\s*\([^)]*\)/g, '').trim() : '';
  const bannerText = cleanLabel
    ? `${cleanLabel} split · ${activeBranchIndex} of ${totalBranches}`
    : `Branch ${activeBranchIndex} of ${totalBranches}`;

  const detailExplanation = getPedagogicalExplanation(activeBranchLabel, activeBranchIndex, totalBranches);

  return (
    <div className={THEME_GLASS.BIFURCATION_BRANCH_BANNER}>
      <div className="flex items-center gap-1.5 min-w-0">
        <GitBranch size={14} className={THEME_GLASS.BIFURCATION_BRANCH_BANNER_ICON} />
        <span className="truncate">{bannerText}</span>
        <Tooltip
          content={detailExplanation}
          position="top"
          className="w-max max-w-[240px] text-center text-sm"
        >
          <span className="inline-flex items-center text-amber-400/80 hover:text-amber-300 cursor-help transition-colors">
            <Info size={13} />
          </span>
        </Tooltip>
      </div>

      {nextUnresolvedBranch && (
        <button
          type="button"
          onClick={() => setCurrentNodeId(nextUnresolvedBranch.leafNodeId)}
          className={THEME_GLASS.BIFURCATION_BRANCH_BANNER_CTA}
        >
          <span>Jump to {nextUnresolvedBranch.branchIndex} of {totalBranches}</span>
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
};
