// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PenTool, HelpCircle, AlertCircle, Check, BookOpen, ArrowRight, ChevronDown } from 'lucide-react';
import {
  equationInputModalOpenAtom,
  resetToEquationStringAtom
} from '../store/equation';
import { PreviewEquationNode } from './PreviewEquationNode';
import { parseEquation, Equation, RelationOperator } from 'math-engine-client';
import { THEME_GLASS } from '../constants/theme';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { trackEvent } from '../utils/analytics';
import { useFocusTrap } from '../hooks/useFocusTrap';

// Relation operators the input modal lets the user choose between (#34).
const RELATION_OPTIONS: RelationOperator[] = ['=', '<', '>', '<=', '>='];
// Detects a relation operator in pasted/typed text (two-char forms first).
const RELATION_REGEX = /<=|>=|<|>|=/;

const CHEVRON_SIZE = 12;

export const EquationInputModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(equationInputModalOpenAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);

  const [lhsStr, setLhsStr] = React.useState('');
  const [rhsStr, setRhsStr] = React.useState('');
  const [relation, setRelation] = React.useState<RelationOperator>('=');
  // Submit-time failures from resetToEquation (the live validation below is
  // derived from the inputs, so it doesn't live in state).
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const lhsRef = React.useRef<HTMLInputElement>(null);
  const rhsRef = React.useRef<HTMLInputElement>(null);

  // Reset inputs when the modal opens — render-phase previous-prop pattern
  // (not an effect) so the cleared state is in place before paint.
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setLhsStr('');
      setRhsStr('');
      setRelation('=');
      setSubmitError(null);
    }
  }

  // Real-time parser validation — derived from the inputs during render
  // (via useMemo) rather than synchronized into state through an effect.
  const { parsedEq, errorStr: validationError, infoStr } = React.useMemo<{
    parsedEq: Equation | null;
    errorStr: string | null;
    infoStr: string | null;
  }>(() => {
    const lhsTrim = lhsStr.trim();
    const rhsTrim = rhsStr.trim();

    if (!lhsTrim && !rhsTrim) {
      return { parsedEq: null, errorStr: null, infoStr: null };
    }

    // If either side is missing, show incomplete typing helper
    if (!lhsTrim || !rhsTrim) {
      return {
        parsedEq: null,
        errorStr: null,
        infoStr: 'Add algebraic terms to both sides of the relation sign',
      };
    }

    const combined = `${lhsTrim} ${relation} ${rhsTrim}`;

    try {
      return { parsedEq: parseEquation(combined), errorStr: null, infoStr: null };
    } catch (err) {
      let rawMsg = err instanceof Error ? err.message : String(err);

      if (rawMsg.toLowerCase().includes('value expected') || rawMsg.toLowerCase().includes('unexpected operator')) {
        rawMsg = `${rawMsg} (Hint: use "*" for multiplication like "3*x" instead of "3x")`;
      }
      return { parsedEq: null, errorStr: rawMsg, infoStr: null };
    }
  }, [lhsStr, rhsStr, relation]);

  // Show a live validation error, falling back to any submit-time failure.
  const errorStr = validationError ?? submitError;

  // Relation operators are owned by the dedicated selector, never the side
  // inputs — strip any the user types/pastes into a side (#34).
  const stripRelationChars = (val: string) => val.replace(/[=<>]/g, '');

  const handleLhsChange = (val: string) => {
    setLhsStr(stripRelationChars(val));
    setSubmitError(null);
  };

  const handleRhsChange = (val: string) => {
    setRhsStr(stripRelationChars(val));
    setSubmitError(null);
  };

  // Typing a single-character relation in a side input sets the relation and
  // advances focus to the right side (mirrors the original `=` shortcut).
  const handleRelationKey = (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (e.key === '=' || e.key === '<' || e.key === '>') {
      e.preventDefault();
      setRelation(e.key as RelationOperator);
      rhsRef.current?.focus();
      return true;
    }
    return false;
  };

  const handleLhsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleRelationKey(e);
  };

  const handleRhsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && rhsStr === '') {
      e.preventDefault();
      lhsRef.current?.focus();
      if (lhsRef.current) {
        const len = lhsStr.length;
        lhsRef.current.setSelectionRange(len, len);
      }
      return;
    }
    
    if (e.key === '=' || e.key === '<' || e.key === '>') {
      e.preventDefault();
      setRelation(e.key as RelationOperator);
      lhsRef.current?.focus();
      if (lhsRef.current) {
        const len = lhsStr.length;
        lhsRef.current.setSelectionRange(len, len);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const match = pastedText.match(RELATION_REGEX);
    if (match) {
      e.preventDefault();
      const splitIndex = match.index ?? 0;
      const op = match[0] as RelationOperator;
      const lhs = stripRelationChars(pastedText.slice(0, splitIndex)).trim();
      const rhs = stripRelationChars(pastedText.slice(splitIndex + op.length)).trim();
      setLhsStr(lhs);
      setRelation(op);
      setRhsStr(rhs);
      setTimeout(() => {
        rhsRef.current?.focus();
        if (rhsRef.current) {
          const len = rhs.length;
          rhsRef.current.setSelectionRange(len, len);
        }
      }, 0);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Focus trap + scroll lock + Escape-to-close + focus restore. The LHS input
  // takes initial focus rather than the first tab stop (the close button).
  const dialogRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: handleClose,
    initialFocusRef: lhsRef,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const combined = `${lhsStr.trim()} ${relation} ${rhsStr.trim()}`;
    if (!lhsStr.trim() || !rhsStr.trim() || validationError) return;

    try {
      // resetToEquation also moves keyboard/screen-reader focus to the new
      // equation's first term (#231), covering this modal and the library alike.
      resetToEquation(combined);
      trackEvent({
        action: 'load_custom_equation',
        category: 'presets',
        label: combined,
      });
      setIsOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="equation-input-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.12 }}
            className={`w-full h-full max-h-screen rounded-none md:rounded-2xl p-6 md:max-w-xl md:h-auto md:max-h-[90vh] overflow-hidden relative z-10 flex flex-col ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Ambient background glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none shrink-0">
              <div className="flex items-center gap-2.5">
                <PenTool className="text-indigo-400 w-5 h-5" />
                <h2 id="equation-input-title" className="text-lg font-bold text-white tracking-wide">Enter Equation</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form & Input Area (Top) */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-semibold select-none">
                  Equation Input
                </label>
                <div className="flex items-center gap-2 w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all select-none">
                  <input
                    ref={lhsRef}
                    type="text"
                    value={lhsStr}
                    onChange={(e) => handleLhsChange(e.target.value)}
                    onKeyDown={handleLhsKeyDown}
                    onPaste={handlePaste}
                    placeholder="Left side (e.g. 3*x)"
                    className="flex-1 min-w-0 bg-transparent text-white placeholder-white/20 text-sm focus:outline-none text-right font-mono"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  <div className="relative flex items-center shrink-0">
                    <select
                      value={relation}
                      onChange={(e) => setRelation(e.target.value as RelationOperator)}
                      aria-label="Relation operator"
                      className={THEME_GLASS.RELATION_SELECT}
                    >
                      {RELATION_OPTIONS.map((op) => (
                        <option key={op} value={op} className="bg-neutral-900 text-white">
                          {RELATION_DISPLAY[op]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={CHEVRON_SIZE} className={THEME_GLASS.RELATION_SELECT_CHEVRON} />
                  </div>
                  <input
                    ref={rhsRef}
                    type="text"
                    value={rhsStr}
                    onChange={(e) => handleRhsChange(e.target.value)}
                    onKeyDown={handleRhsKeyDown}
                    onPaste={handlePaste}
                    placeholder="Right side (e.g. 12)"
                    className="flex-1 min-w-0 bg-transparent text-white placeholder-white/20 text-sm focus:outline-none text-left font-mono"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  {lhsStr.trim() && rhsStr.trim() && !errorStr && (
                    <div className="text-emerald-400 animate-pulse shrink-0 ml-1">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              </div>

              {/* Preview or Error Area (Below Input) */}
              <div className="flex-1 min-h-[120px] flex flex-col gap-1.5">
                <span className="text-xs text-white/60 font-semibold select-none">
                  Status & Preview
                </span>
                
                <div className="flex-1 bg-neutral-950/80 border border-white/5 rounded-xl p-4 flex items-center justify-center relative min-h-[100px]">
                  {/* Empty state */}
                  {!lhsStr.trim() && !rhsStr.trim() && (
                    <div className="text-center text-xs text-white/30 flex flex-col items-center gap-2 select-none">
                      <KeyboardIcon className="opacity-40" />
                      <span>Type an algebraic equation above to see its parsed preview.</span>
                    </div>
                  )}

                  {/* Incomplete / Typing Helper state */}
                  {infoStr && !errorStr && (
                    <div className="w-full text-left text-xs text-indigo-300/80 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 flex items-start gap-2.5 animate-[fadeIn_0.15s_ease-out]">
                      <HelpCircle size={14} className="shrink-0 mt-0.5 text-indigo-400/70" />
                      <span className="leading-relaxed">{infoStr}</span>
                    </div>
                  )}

                  {/* Error state */}
                  {errorStr && (
                    <div className="w-full text-left text-xs text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex items-start gap-2.5 animate-[fadeIn_0.15s_ease-out]">
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-400/70" />
                      <span className="leading-relaxed">{errorStr}</span>
                    </div>
                  )}

                  {/* Preview state (Valid Equation) */}
                  {parsedEq && !errorStr && (
                    <div className="flex flex-col items-center gap-3 w-full animate-[fadeIn_0.15s_ease-out]">
                      <span className="text-[0.5625rem] tracking-wider text-emerald-400 font-semibold select-none flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Valid Equation
                      </span>
                      
                      <div className="flex items-center justify-center gap-[0.4em] flex-nowrap w-max pointer-events-none select-none max-w-full overflow-x-auto py-2 text-base">
                        <div className="flex justify-end min-w-[2em]">
                          <PreviewEquationNode path="lhs" customEquation={parsedEq} />
                        </div>
                        <span className="text-[1.1em] font-light font-mono px-[0.5em] py-[0.15em] border border-white/10 rounded-[0.4em] text-white/70 bg-white/5">
                          {RELATION_DISPLAY[parsedEq.relation ?? '='] ?? '='}
                        </span>
                        <div className="flex justify-start min-w-[2em]">
                          <PreviewEquationNode path="rhs" customEquation={parsedEq} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-white/40 border-t border-white/5 pt-3 select-none shrink-0">
                <a
                  href="https://mathjs.org/docs/expressions/syntax.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors cursor-pointer group"
                >
                  <BookOpen size={12} className="group-hover:rotate-3 transition-transform" />
                  <span>Math.js Syntax Documentation</span>
                </a>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!parsedEq || !!errorStr}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-indigo-600/60 shadow-lg shadow-indigo-600/10 active:scale-95 disabled:active:scale-100 transition-all duration-150 flex items-center gap-1 cursor-pointer"
                >
                  <span>Use Equation</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const KeyboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <line x1="6" y1="8" x2="6" y2="8" />
    <line x1="10" y1="8" x2="10" y2="8" />
    <line x1="14" y1="8" x2="14" y2="8" />
    <line x1="18" y1="8" x2="18" y2="8" />
    <line x1="6" y1="12" x2="6" y2="12" />
    <line x1="10" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="14" y2="12" />
    <line x1="18" y1="12" x2="18" y2="12" />
    <line x1="7" y1="16" x2="17" y2="16" />
  </svg>
);
